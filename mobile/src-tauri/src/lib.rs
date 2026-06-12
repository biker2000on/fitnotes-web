// lib.rs - Tauri v2 app library: commands + run(). main.rs is a thin entry point.

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::error::Error;
use std::fs;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, State};

struct DbConnection(Mutex<Connection>);

fn error_chain(error: &dyn Error) -> String {
    let mut message = error.to_string();
    let mut current = error.source();
    while let Some(source) = current {
        message.push_str(": ");
        message.push_str(&source.to_string());
        current = source.source();
    }
    message
}

fn sync_http_client() -> std::result::Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", error_chain(&e)))
}

#[tauri::command]
fn tauri_query(
    sql: &str,
    params: Vec<Value>,
    db_state: State<'_, DbConnection>,
) -> std::result::Result<Vec<Value>, String> {
    let conn = db_state.0.lock().unwrap();
    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| format!("Query prepare failed for `{}`: {}", sql, e))?;

    // Map incoming dynamic JSON parameters to SQLite parameters
    let sql_params: Vec<Box<dyn rusqlite::ToSql>> = params
        .iter()
        .map(|v| -> Box<dyn rusqlite::ToSql> {
            match v {
                Value::Null => Box::new(rusqlite::types::Null),
                Value::Bool(b) => Box::new(*b),
                Value::Number(num) => {
                    if let Some(i) = num.as_i64() {
                        Box::new(i)
                    } else {
                        Box::new(num.as_f64().unwrap_or(0.0))
                    }
                }
                Value::String(s) => Box::new(s.clone()),
                _ => Box::new(v.to_string()),
            }
        })
        .collect();

    let sql_params_ref: Vec<&dyn rusqlite::ToSql> = sql_params.iter().map(|b| b.as_ref()).collect();

    // Map dynamic column names and row values to structured JSON objects.
    // Capture column names before query() borrows stmt mutably.
    let col_count = stmt.column_count();
    let col_names: Vec<String> = (0..col_count)
        .map(|i| {
            stmt.column_name(i)
                .map(|s| s.to_string())
                .map_err(|e| e.to_string())
        })
        .collect::<std::result::Result<_, _>>()?;
    let mut rows = stmt
        .query(&sql_params_ref[..])
        .map_err(|e| format!("Query failed for `{}`: {}", sql, e))?;

    let mut result = Vec::new();

    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut row_map = serde_json::Map::new();
        for i in 0..col_count {
            let col_name = &col_names[i];
            let val = row.get_ref(i).map_err(|e| e.to_string())?;
            let json_val = match val {
                rusqlite::types::ValueRef::Null => Value::Null,
                rusqlite::types::ValueRef::Integer(i) => Value::Number(i.into()),
                rusqlite::types::ValueRef::Real(f) => {
                    if let Some(n) = serde_json::Number::from_f64(f) {
                        Value::Number(n)
                    } else {
                        Value::Null
                    }
                }
                rusqlite::types::ValueRef::Text(t) => {
                    Value::String(String::from_utf8_lossy(t).into_owned())
                }
                rusqlite::types::ValueRef::Blob(b) => Value::String(hex::encode(b)),
            };
            row_map.insert(col_name.to_string(), json_val);
        }
        result.push(Value::Object(row_map));
    }

    Ok(result)
}

#[tauri::command]
fn tauri_execute(
    sql: &str,
    params: Vec<Value>,
    db_state: State<'_, DbConnection>,
) -> std::result::Result<(), String> {
    let conn = db_state.0.lock().unwrap();

    let sql_params: Vec<Box<dyn rusqlite::ToSql>> = params
        .iter()
        .map(|v| -> Box<dyn rusqlite::ToSql> {
            match v {
                Value::Null => Box::new(rusqlite::types::Null),
                Value::Bool(b) => Box::new(*b),
                Value::Number(num) => {
                    if let Some(i) = num.as_i64() {
                        Box::new(i)
                    } else {
                        Box::new(num.as_f64().unwrap_or(0.0))
                    }
                }
                Value::String(s) => Box::new(s.clone()),
                _ => Box::new(v.to_string()),
            }
        })
        .collect();

    let sql_params_ref: Vec<&dyn rusqlite::ToSql> = sql_params.iter().map(|b| b.as_ref()).collect();

    conn.execute(sql, &sql_params_ref[..])
        .map_err(|e| format!("Execute failed for `{}`: {}", sql, e))?;

    Ok(())
}

#[derive(Serialize, Deserialize, Debug)]
struct SyncPayload {
    last_sync_timestamp: String,
    categories: Vec<Value>,
    exercises: Vec<Value>,
    routines: Vec<Value>,
    routine_sections: Vec<Value>,
    routine_section_exercises: Vec<Value>,
    routine_section_exercise_sets: Vec<Value>,
    training_logs: Vec<Value>,
    body_weights: Vec<Value>,
    plates: Vec<Value>,
    barbells: Vec<Value>,
    workout_comments: Vec<Value>,
    workout_groups: Vec<Value>,
    workout_group_exercises: Vec<Value>,
    workout_routines: Vec<Value>,
    goals: Vec<Value>,
    measurements: Vec<Value>,
    measurement_records: Vec<Value>,
    exercise_comments: Vec<Value>,
    workout_times: Vec<Value>,
    custom_units: Vec<Value>,
    graph_favourites: Vec<Value>,
    settings: Option<Value>,
}

fn parse_setting_value(value: &str) -> Value {
    if value.eq_ignore_ascii_case("true") {
        return Value::Bool(true);
    }
    if value.eq_ignore_ascii_case("false") {
        return Value::Bool(false);
    }
    if let Ok(i) = value.parse::<i64>() {
        return Value::Number(i.into());
    }
    if let Ok(f) = value.parse::<f64>() {
        if let Some(n) = serde_json::Number::from_f64(f) {
            return Value::Number(n);
        }
    }
    Value::String(value.to_string())
}

fn default_settings_map() -> serde_json::Map<String, Value> {
    let mut settings = serde_json::Map::new();
    let mut insert_bool = |key: &str, value: bool| {
        settings.insert(key.to_string(), Value::Bool(value));
    };
    insert_bool("metric", true);
    insert_bool("body_weight_goal", false);
    insert_bool("body_weight_show_in_workout_log", true);
    insert_bool("estimated_1rm_max_apply_to_graph", true);
    insert_bool("track_personal_records", true);
    insert_bool("mark_sets_complete", true);
    insert_bool("auto_select_next_set", true);
    insert_bool("keep_screen_on", false);
    insert_bool("graph_show_points", true);
    insert_bool("graph_show_trend_line", false);
    insert_bool("graph_start_at_zero", false);
    insert_bool("rest_timer_vibrate", true);
    insert_bool("rest_timer_sound", true);
    insert_bool("rest_timer_auto_start", false);
    insert_bool("calendar_detail_visible", true);
    insert_bool("calendar_category_dots_visible", true);
    insert_bool("calendar_navigation_bar_visible", true);
    insert_bool("calendar_history_category_dots_visible", true);
    insert_bool("calendar_history_category_names_visible", true);
    insert_bool("calendar_history_sets_visible", true);
    insert_bool("category_show_colours", true);
    insert_bool("measurement_tracker_initial_load", true);
    insert_bool("measurement_show_in_workout_log", true);
    insert_bool("workout_timer_auto_start_enabled", false);
    insert_bool("workout_timer_auto_stop_enabled", false);
    insert_bool("home_screen_skip_empty_dates", false);

    let mut insert_i64 = |key: &str, value: i64| {
        settings.insert(key.to_string(), Value::Number(value.into()));
    };
    insert_i64("first_day_of_week", 2);
    insert_i64("selected_navigation_item_id", 0);
    insert_i64("estimated_1rm_max_reps_to_include", 10);
    insert_i64("rest_timer_seconds", 90);
    insert_i64("rest_timer_volume", 100);
    insert_i64("category_sort_order", 0);
    insert_i64("workout_graph_default_graph_type", 0);
    insert_i64("workout_graph_default_time_period", 0);
    insert_i64("analysis_breakdown_breakdown_type", 0);
    insert_i64("analysis_breakdown_time_period", 0);
    insert_i64("exercise_list_detail_type_id", 0);
    insert_i64("home_screen_limit_type_id", 0);
    insert_i64("home_screen_limit_value", 0);
    insert_i64("home_screen_category_visibility_id", 1);
    insert_i64("app_theme_id", 0);
    insert_i64("distance_unit", 1);

    settings.insert(
        "weight_increment".to_string(),
        Value::Number(serde_json::Number::from_f64(2.5).unwrap()),
    );
    settings.insert(
        "body_weight_increment".to_string(),
        Value::Number(serde_json::Number::from_f64(0.1).unwrap()),
    );
    settings.insert("body_weight_goal_weight".to_string(), Value::Null);

    settings
}

fn extract_dirty_settings(conn: &Connection) -> Result<Option<Value>> {
    let is_dirty: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'settings_is_dirty'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "0".to_string());

    if is_dirty != "1" {
        return Ok(None);
    }

    let mut settings = default_settings_map();
    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    let rows = stmt.query_map([], |row| {
        let key: String = row.get(0)?;
        let value: Option<String> = row.get(1)?;
        Ok((key, value.unwrap_or_default()))
    })?;

    for row in rows {
        let (key, value) = row?;
        match key.as_str() {
            "last_sync_timestamp" | "settings_is_dirty" => {}
            "settings_last_modified" => {
                settings.insert("last_modified".to_string(), Value::String(value));
            }
            _ => {
                settings.insert(key, parse_setting_value(&value));
            }
        }
    }

    if !settings.contains_key("last_modified") {
        settings.insert(
            "last_modified".to_string(),
            Value::String("1970-01-01T00:00:00Z".to_string()),
        );
    }

    Ok(Some(Value::Object(settings)))
}

fn is_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 36 {
        return false;
    }

    for (idx, byte) in bytes.iter().enumerate() {
        match idx {
            8 | 13 | 18 | 23 => {
                if *byte != b'-' {
                    return false;
                }
            }
            14 => {
                if !(b'1'..=b'5').contains(byte) {
                    return false;
                }
            }
            19 => {
                if !matches!(*byte, b'8' | b'9' | b'a' | b'b' | b'A' | b'B') {
                    return false;
                }
            }
            _ => {
                if !byte.is_ascii_hexdigit() {
                    return false;
                }
            }
        }
    }

    true
}

fn legacy_id_to_uuid(id: &str) -> String {
    let chars: Vec<u8> = if id.is_empty() {
        vec![0]
    } else {
        id.as_bytes().to_vec()
    };
    let mut hash: u32 = 2166136261;
    for byte in &chars {
        hash ^= *byte as u32;
        hash = hash.wrapping_mul(16777619);
    }

    let mut hex_chars = Vec::with_capacity(32);
    for i in 0..32 {
        hash ^= chars[i % chars.len()] as u32 + i as u32;
        hash = hash.wrapping_mul(16777619);
        let nibble = ((hash >> ((i % 4) * 8)) & 0xf) as u8;
        hex_chars.push(std::char::from_digit(nibble as u32, 16).unwrap());
    }

    hex_chars[12] = '4';
    let variant = hex_chars[16].to_digit(16).unwrap_or(0);
    hex_chars[16] = std::char::from_digit((variant & 0x3) | 0x8, 16).unwrap();

    let value: String = hex_chars.into_iter().collect();
    format!(
        "{}-{}-{}-{}-{}",
        &value[0..8],
        &value[8..12],
        &value[12..16],
        &value[16..20],
        &value[20..32]
    )
}

fn normalize_uuid_value(value: &mut Value) {
    match value {
        Value::Null => {}
        Value::String(s) if s.is_empty() => {
            *value = Value::Null;
        }
        Value::String(s) if !is_uuid(s) => {
            *value = Value::String(legacy_id_to_uuid(s));
        }
        _ => {}
    }
}

fn normalize_bool_value(value: &mut Value) {
    match value {
        Value::Bool(_) => {}
        Value::Number(n) => {
            *value = Value::Bool(n.as_i64().unwrap_or(0) != 0);
        }
        Value::String(s) => {
            let normalized = s.to_lowercase();
            if normalized == "true" || normalized == "1" {
                *value = Value::Bool(true);
            } else if normalized == "false" || normalized == "0" || normalized.is_empty() {
                *value = Value::Bool(false);
            }
        }
        Value::Null => {
            *value = Value::Bool(false);
        }
        _ => {}
    }
}

fn normalize_signed_int32_value(value: &mut Value) {
    let n = match value {
        Value::Number(n) => n.as_i64(),
        Value::String(s) => s.parse::<i64>().ok(),
        _ => None,
    };

    if let Some(raw) = n {
        if raw > i32::MAX as i64 {
            *value = Value::Number((raw - 4_294_967_296_i64).into());
        }
    }
}

fn normalize_sync_item(mut item: Value, uuid_fields: &[&str], bool_fields: &[&str]) -> Value {
    if let Value::Object(ref mut map) = item {
        map.remove("user_id");
        map.remove("is_dirty");

        if let Some(id) = map.get_mut("id") {
            normalize_uuid_value(id);
        }

        for field in uuid_fields {
            if let Some(value) = map.get_mut(*field) {
                normalize_uuid_value(value);
            }
        }

        for field in bool_fields {
            if let Some(value) = map.get_mut(*field) {
                normalize_bool_value(value);
            }
        }

        if let Some(value) = map.get_mut("colour") {
            normalize_signed_int32_value(value);
        }
    }

    item
}

fn purge_builtin_seed_rows(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM categories WHERE id GLOB 'c-[0-9]*'", [])?;
    conn.execute("DELETE FROM exercises WHERE id LIKE 'e-%'", [])?;
    conn.execute("DELETE FROM routines WHERE id = 'r-ppl-push'", [])?;
    conn.execute("DELETE FROM routine_sections WHERE id = 'rs-push'", [])?;
    conn.execute(
        "DELETE FROM routine_section_exercises WHERE id LIKE 'rse-%'",
        [],
    )?;
    conn.execute(
        "DELETE FROM routine_section_exercise_sets WHERE id LIKE 'rses-%'",
        [],
    )?;
    Ok(())
}

#[derive(Deserialize, Debug)]
struct SyncResponse {
    server_time: String,
    categories: Option<Vec<Value>>,
    exercises: Option<Vec<Value>>,
    routines: Option<Vec<Value>>,
    routine_sections: Option<Vec<Value>>,
    routine_section_exercises: Option<Vec<Value>>,
    routine_section_exercise_sets: Option<Vec<Value>>,
    training_logs: Option<Vec<Value>>,
    body_weights: Option<Vec<Value>>,
    plates: Option<Vec<Value>>,
    barbells: Option<Vec<Value>>,
    workout_comments: Option<Vec<Value>>,
    workout_groups: Option<Vec<Value>>,
    workout_group_exercises: Option<Vec<Value>>,
    workout_routines: Option<Vec<Value>>,
    goals: Option<Vec<Value>>,
    measurements: Option<Vec<Value>>,
    measurement_records: Option<Vec<Value>>,
    exercise_comments: Option<Vec<Value>>,
    workout_times: Option<Vec<Value>>,
    custom_units: Option<Vec<Value>>,
    graph_favourites: Option<Vec<Value>>,
    settings: Option<Value>,
}

#[tauri::command]
async fn tauri_sync(
    api_token: &str,
    api_base_url: &str,
    db_state: State<'_, DbConnection>,
) -> std::result::Result<u32, String> {
    println!("tauri_sync: starting sync to {}", api_base_url);
    {
        let conn = db_state.0.lock().unwrap();
        purge_builtin_seed_rows(&conn).map_err(|e| e.to_string())?;
    }

    // 1. Gather local changes where is_dirty = 1 and build the push payload.
    let payload = {
        let conn = db_state.0.lock().unwrap();

        // Get last sync timestamp
        let last_sync: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'last_sync_timestamp'",
                [],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string());

        let extract_dirty =
            |table: &str, uuid_fields: &[&str], bool_fields: &[&str]| -> Result<Vec<Value>> {
                let mut stmt =
                    conn.prepare(&format!("SELECT * FROM {} WHERE is_dirty = 1", table))?;
                let col_count = stmt.column_count();
                let col_names: Vec<String> = (0..col_count)
                    .map(|i| stmt.column_name(i).map(|s| s.to_string()))
                    .collect::<Result<_>>()?;
                let mut rows = stmt.query([])?;
                let mut list = Vec::new();
                while let Some(row) = rows.next()? {
                    let mut map = serde_json::Map::new();
                    for i in 0..col_count {
                        let col_name = &col_names[i];
                        let val = row.get_ref(i)?;
                        let json_val = match val {
                            rusqlite::types::ValueRef::Null => Value::Null,
                            rusqlite::types::ValueRef::Integer(i) => Value::Number(i.into()),
                            rusqlite::types::ValueRef::Real(f) => serde_json::Number::from_f64(f)
                                .map(Value::Number)
                                .unwrap_or(Value::Null),
                            rusqlite::types::ValueRef::Text(t) => {
                                Value::String(String::from_utf8_lossy(t).into_owned())
                            }
                            rusqlite::types::ValueRef::Blob(b) => Value::String(hex::encode(b)),
                        };
                        map.insert(col_name.to_string(), json_val);
                    }
                    list.push(normalize_sync_item(
                        Value::Object(map),
                        uuid_fields,
                        bool_fields,
                    ));
                }
                Ok(list)
            };

        SyncPayload {
            last_sync_timestamp: last_sync,
            categories: extract_dirty("categories", &[], &["is_deleted"]).unwrap_or_default(),
            exercises: extract_dirty(
                "exercises",
                &["category_id"],
                &["is_favourite", "is_deleted"],
            )
            .unwrap_or_default(),
            routines: extract_dirty("routines", &[], &["is_deleted"]).unwrap_or_default(),
            routine_sections: extract_dirty("routine_sections", &["routine_id"], &["is_deleted"])
                .unwrap_or_default(),
            routine_section_exercises: extract_dirty(
                "routine_section_exercises",
                &["routine_section_id", "exercise_id"],
                &["is_deleted"],
            )
            .unwrap_or_default(),
            routine_section_exercise_sets: extract_dirty(
                "routine_section_exercise_sets",
                &["routine_section_exercise_id"],
                &["is_deleted"],
            )
            .unwrap_or_default(),
            training_logs: extract_dirty(
                "training_logs",
                &["exercise_id", "routine_section_exercise_set_id"],
                &["is_personal_record", "is_complete", "is_deleted"],
            )
            .unwrap_or_default(),
            body_weights: extract_dirty("body_weights", &[], &["is_deleted"]).unwrap_or_default(),
            plates: extract_dirty("plates", &[], &["enabled", "is_deleted"]).unwrap_or_default(),
            barbells: extract_dirty("barbells", &["exercise_id"], &["is_deleted"])
                .unwrap_or_default(),
            workout_comments: extract_dirty("workout_comments", &[], &["is_deleted"])
                .unwrap_or_default(),
            workout_groups: extract_dirty(
                "workout_groups",
                &["routine_section_id"],
                &[
                    "auto_jump_enabled",
                    "rest_timer_auto_start_enabled",
                    "is_deleted",
                ],
            )
            .unwrap_or_default(),
            workout_group_exercises: extract_dirty(
                "workout_group_exercises",
                &["exercise_id", "routine_section_id", "workout_group_id"],
                &["is_deleted"],
            )
            .unwrap_or_default(),
            workout_routines: extract_dirty(
                "workout_routines",
                &["routine_id", "routine_section_id"],
                &["is_deleted"],
            )
            .unwrap_or_default(),
            goals: extract_dirty("goals", &["exercise_id"], &["is_deleted"]).unwrap_or_default(),
            measurements: extract_dirty("measurements", &[], &["custom", "enabled", "is_deleted"])
                .unwrap_or_default(),
            measurement_records: extract_dirty(
                "measurement_records",
                &["measurement_id"],
                &["is_deleted"],
            )
            .unwrap_or_default(),
            exercise_comments: extract_dirty(
                "exercise_comments",
                &["exercise_id"],
                &["is_deleted"],
            )
            .unwrap_or_default(),
            workout_times: extract_dirty("workout_times", &[], &["is_deleted"]).unwrap_or_default(),
            custom_units: extract_dirty("custom_units", &[], &["is_deleted"]).unwrap_or_default(),
            graph_favourites: extract_dirty("graph_favourites", &["exercise_id"], &["is_deleted"])
                .unwrap_or_default(),
            settings: extract_dirty_settings(&conn).unwrap_or_default(),
        }
    };

    // 3. Dispatch HTTP Post Sync request to Go API
    println!("tauri_sync: posting sync payload");
    let client = sync_http_client()?;
    let res = client
        .post(format!("{}/api/sync", api_base_url))
        .header("Authorization", format!("Bearer {}", api_token))
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            let message = format!("HTTP request failed: {}", error_chain(&e));
            eprintln!("tauri_sync: {}", message);
            message
        })?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res
            .text()
            .await
            .unwrap_or_else(|e| format!("failed to read response body: {}", e));
        let message = format!("Server returned failure code: {}: {}", status, body);
        eprintln!("tauri_sync: {}", message);
        return Err(message);
    }

    let sync_res: SyncResponse = res.json().await.map_err(|e| {
        let message = format!("Failed to parse server sync payload: {}", e);
        eprintln!("tauri_sync: {}", message);
        message
    })?;

    // Rows pulled from the server; the frontend uses this to skip UI refreshes
    // after no-op background syncs.
    let pulled_count: u32 = [
        &sync_res.categories,
        &sync_res.exercises,
        &sync_res.routines,
        &sync_res.routine_sections,
        &sync_res.routine_section_exercises,
        &sync_res.routine_section_exercise_sets,
        &sync_res.training_logs,
        &sync_res.body_weights,
        &sync_res.plates,
        &sync_res.barbells,
        &sync_res.workout_comments,
        &sync_res.workout_groups,
        &sync_res.workout_group_exercises,
        &sync_res.workout_routines,
        &sync_res.goals,
        &sync_res.measurements,
        &sync_res.measurement_records,
        &sync_res.exercise_comments,
        &sync_res.workout_times,
        &sync_res.custom_units,
        &sync_res.graph_favourites,
    ]
    .iter()
    .map(|t| t.as_ref().map_or(0, Vec::len))
    .sum::<usize>() as u32
        + sync_res.settings.is_some() as u32;

    // 4. Ingest server updates (PULL) inside a local SQLite transaction
    {
        let mut conn = db_state.0.lock().unwrap();
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // Helper upsert function to map server payload directly to SQLite
        let upsert_table = |table: &str,
                            items: &[Value],
                            columns: &[&str],
                            pushed_items: &[Value]|
         -> std::result::Result<(), String> {
            // 1. Reset dirty flag only on items included in this sync request.
            for item in pushed_items {
                if let Some(id) = item.get("id").and_then(Value::as_str) {
                    tx.execute(
                        &format!("UPDATE {} SET is_dirty = 0 WHERE id = ?1", table),
                        params![id],
                    )
                    .map_err(|e| e.to_string())?;
                }
            }

            // 2. Insert or replace server items
            for item in items {
                let map = item.as_object().ok_or("Expected JSON object")?;
                let placeholders: Vec<String> =
                    (1..=columns.len()).map(|i| format!("?{}", i)).collect();
                let sql = format!(
                    "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
                    table,
                    columns.join(", "),
                    placeholders.join(", ")
                );

                let mut params = Vec::new();
                for col in columns {
                    let val = map.get(*col).unwrap_or(&Value::Null);
                    params.push(val);
                }

                let sql_params: Vec<Box<dyn rusqlite::ToSql>> = params
                    .iter()
                    .map(|v| -> Box<dyn rusqlite::ToSql> {
                        match v {
                            Value::Null => Box::new(rusqlite::types::Null),
                            Value::Bool(b) => Box::new(*b),
                            Value::Number(num) => {
                                if let Some(i) = num.as_i64() {
                                    Box::new(i)
                                } else {
                                    Box::new(num.as_f64().unwrap_or(0.0))
                                }
                            }
                            Value::String(s) => Box::new(s.clone()),
                            _ => Box::new(v.to_string()),
                        }
                    })
                    .collect();

                let sql_params_ref: Vec<&dyn rusqlite::ToSql> =
                    sql_params.iter().map(|b| b.as_ref()).collect();

                tx.execute(&sql, &sql_params_ref[..])
                    .map_err(|e| e.to_string())?;
            }
            Ok(())
        };

        if let Some(items) = sync_res.categories {
            upsert_table(
                "categories",
                items.as_slice(),
                &[
                    "id",
                    "name",
                    "colour",
                    "sort_order",
                    "last_modified",
                    "is_deleted",
                ],
                payload.categories.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.exercises {
            upsert_table(
                "exercises",
                items.as_slice(),
                &[
                    "id",
                    "name",
                    "category_id",
                    "exercise_type_id",
                    "notes",
                    "weight_increment",
                    "default_rest_time",
                    "weight_unit_id",
                    "is_favourite",
                    "last_modified",
                    "is_deleted",
                ],
                payload.exercises.as_slice(),
            )?;
        }
        // Routine templates: parents before children.
        if let Some(items) = sync_res.routines {
            upsert_table(
                "routines",
                items.as_slice(),
                &["id", "name", "notes", "last_modified", "is_deleted"],
                payload.routines.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.routine_sections {
            upsert_table(
                "routine_sections",
                items.as_slice(),
                &[
                    "id",
                    "routine_id",
                    "name",
                    "sort_order",
                    "last_modified",
                    "is_deleted",
                ],
                payload.routine_sections.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.routine_section_exercises {
            upsert_table(
                "routine_section_exercises",
                items.as_slice(),
                &[
                    "id",
                    "routine_section_id",
                    "exercise_id",
                    "sort_order",
                    "populate_sets_type",
                    "last_modified",
                    "is_deleted",
                ],
                payload.routine_section_exercises.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.routine_section_exercise_sets {
            upsert_table(
                "routine_section_exercise_sets",
                items.as_slice(),
                &[
                    "id",
                    "routine_section_exercise_id",
                    "metric_weight",
                    "reps",
                    "sort_order",
                    "distance",
                    "duration_seconds",
                    "unit",
                    "last_modified",
                    "is_deleted",
                ],
                payload.routine_section_exercise_sets.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.training_logs {
            upsert_table(
                "training_logs",
                items.as_slice(),
                &[
                    "id",
                    "exercise_id",
                    "date",
                    "metric_weight",
                    "reps",
                    "unit",
                    "routine_section_exercise_set_id",
                    "is_personal_record",
                    "is_complete",
                    "distance",
                    "duration_seconds",
                    "comment",
                    "last_modified",
                    "is_deleted",
                ],
                payload.training_logs.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.body_weights {
            upsert_table(
                "body_weights",
                items.as_slice(),
                &[
                    "id",
                    "date",
                    "body_weight_metric",
                    "body_fat",
                    "comments",
                    "last_modified",
                    "is_deleted",
                ],
                payload.body_weights.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.plates {
            upsert_table(
                "plates",
                items.as_slice(),
                &[
                    "id",
                    "weight",
                    "unit",
                    "count",
                    "enabled",
                    "colour",
                    "width_ratio",
                    "height_ratio",
                    "last_modified",
                    "is_deleted",
                ],
                payload.plates.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.barbells {
            upsert_table(
                "barbells",
                items.as_slice(),
                &[
                    "id",
                    "weight",
                    "unit",
                    "exercise_id",
                    "last_modified",
                    "is_deleted",
                ],
                payload.barbells.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.workout_comments {
            upsert_table(
                "workout_comments",
                items.as_slice(),
                &["id", "date", "comment", "last_modified", "is_deleted"],
                payload.workout_comments.as_slice(),
            )?;
        }
        // Supersets: groups before their exercise links (routine_sections already upserted above).
        if let Some(items) = sync_res.workout_groups {
            upsert_table(
                "workout_groups",
                items.as_slice(),
                &[
                    "id",
                    "name",
                    "date",
                    "colour",
                    "routine_section_id",
                    "auto_jump_enabled",
                    "rest_timer_auto_start_enabled",
                    "last_modified",
                    "is_deleted",
                ],
                payload.workout_groups.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.workout_group_exercises {
            upsert_table(
                "workout_group_exercises",
                items.as_slice(),
                &[
                    "id",
                    "exercise_id",
                    "date",
                    "routine_section_id",
                    "workout_group_id",
                    "last_modified",
                    "is_deleted",
                ],
                payload.workout_group_exercises.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.goals {
            upsert_table(
                "goals",
                items.as_slice(),
                &[
                    "id",
                    "type_id",
                    "exercise_id",
                    "metric_weight",
                    "reps",
                    "unit",
                    "title",
                    "target_date",
                    "sort_order",
                    "distance",
                    "duration_seconds",
                    "start_date",
                    "last_modified",
                    "is_deleted",
                ],
                payload.goals.as_slice(),
            )?;
        }
        // Measurements before measurement_records.
        if let Some(items) = sync_res.measurements {
            upsert_table(
                "measurements",
                items.as_slice(),
                &[
                    "id",
                    "name",
                    "unit_id",
                    "goal_type",
                    "goal_value",
                    "custom",
                    "enabled",
                    "sort_order",
                    "last_modified",
                    "is_deleted",
                ],
                payload.measurements.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.measurement_records {
            upsert_table(
                "measurement_records",
                items.as_slice(),
                &[
                    "id",
                    "measurement_id",
                    "date",
                    "time",
                    "value",
                    "comment",
                    "last_modified",
                    "is_deleted",
                ],
                payload.measurement_records.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.exercise_comments {
            upsert_table(
                "exercise_comments",
                items.as_slice(),
                &[
                    "id",
                    "exercise_id",
                    "date",
                    "comment",
                    "last_modified",
                    "is_deleted",
                ],
                payload.exercise_comments.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.workout_times {
            upsert_table(
                "workout_times",
                items.as_slice(),
                &[
                    "id",
                    "date",
                    "start_time",
                    "end_time",
                    "duration_seconds",
                    "last_modified",
                    "is_deleted",
                ],
                payload.workout_times.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.workout_routines {
            upsert_table(
                "workout_routines",
                items.as_slice(),
                &[
                    "id",
                    "date",
                    "routine_id",
                    "routine_section_id",
                    "last_modified",
                    "is_deleted",
                ],
                payload.workout_routines.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.custom_units {
            upsert_table(
                "custom_units",
                items.as_slice(),
                &[
                    "id",
                    "name",
                    "abbreviation",
                    "type",
                    "conversion_to_base",
                    "last_modified",
                    "is_deleted",
                ],
                payload.custom_units.as_slice(),
            )?;
        }
        if let Some(items) = sync_res.graph_favourites {
            upsert_table(
                "graph_favourites",
                items.as_slice(),
                &[
                    "id",
                    "exercise_id",
                    "graph_type",
                    "time_period",
                    "rep_filter",
                    "last_modified",
                    "is_deleted",
                ],
                payload.graph_favourites.as_slice(),
            )?;
        }

        let pushed_settings_last_modified = payload
            .settings
            .as_ref()
            .and_then(|settings| settings.get("last_modified"))
            .and_then(Value::as_str)
            .map(|value| value.to_string());
        let current_settings_last_modified: Option<String> = tx
            .query_row(
                "SELECT value FROM settings WHERE key = 'settings_last_modified'",
                [],
                |row| row.get(0),
            )
            .ok();
        let current_settings_dirty: String = tx
            .query_row(
                "SELECT value FROM settings WHERE key = 'settings_is_dirty'",
                [],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "0".to_string());
        let settings_changed_during_sync = current_settings_dirty == "1"
            && match pushed_settings_last_modified.as_ref() {
                Some(pushed) => current_settings_last_modified.as_ref() != Some(pushed),
                None => true,
            };

        if !settings_changed_during_sync {
            if let Some(settings) = sync_res.settings {
                if let Some(map) = settings.as_object() {
                    for (key, value) in map {
                        if key == "user_id" {
                            continue;
                        }

                        let value_string = match value {
                            Value::Null => String::new(),
                            Value::Bool(b) => b.to_string(),
                            Value::Number(n) => n.to_string(),
                            Value::String(s) => s.clone(),
                            _ => value.to_string(),
                        };

                        let local_key = if key == "last_modified" {
                            "settings_last_modified"
                        } else {
                            key.as_str()
                        };

                        tx.execute(
                            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
                            params![local_key, value_string],
                        )
                        .map_err(|e| e.to_string())?;
                    }
                }
            }

            if payload.settings.is_some() {
                tx.execute(
                    "INSERT OR REPLACE INTO settings (key, value) VALUES ('settings_is_dirty', '0')",
                    [],
                )
                .map_err(|e| e.to_string())?;
            }
        }

        // Save server timestamp as settings: last_sync_timestamp
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync_timestamp', ?1)",
            params![sync_res.server_time],
        )
        .map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;
    }

    println!("tauri_sync: complete, pulled {} rows", pulled_count);
    Ok(pulled_count)
}

#[tauri::command]
async fn tauri_invalidate_cache(
    preserve_dirty: bool,
    db_state: State<'_, DbConnection>,
) -> std::result::Result<(), String> {
    let mut conn = db_state.0.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let tables = [
        "categories",
        "exercises",
        "routines",
        "routine_sections",
        "routine_section_exercises",
        "routine_section_exercise_sets",
        "training_logs",
        "body_weights",
        "plates",
        "barbells",
        "workout_comments",
        "workout_groups",
        "workout_group_exercises",
        "workout_routines",
        "goals",
        "measurements",
        "measurement_records",
        "exercise_comments",
        "workout_times",
        "custom_units",
        "graph_favourites",
    ];

    for table in &tables {
        if preserve_dirty {
            tx.execute(&format!("DELETE FROM {} WHERE is_dirty != 1", table), [])
                .map_err(|e| e.to_string())?;
        } else {
            tx.execute(&format!("DELETE FROM {}", table), [])
                .map_err(|e| e.to_string())?;
        }
    }
    if preserve_dirty {
        purge_builtin_seed_rows(&tx).map_err(|e| e.to_string())?;
    }

    tx.execute("DELETE FROM settings WHERE key = 'last_sync_timestamp'", [])
        .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let mut rows = stmt.query([])?;

    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column {
            return Ok(true);
        }
    }

    Ok(false)
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<()> {
    if !column_exists(conn, table, column)? {
        conn.execute(
            &format!("ALTER TABLE {} ADD COLUMN {}", table, definition),
            [],
        )?;
    }

    Ok(())
}

fn run_sqlite_upgrades(conn: &Connection) -> Result<()> {
    add_column_if_missing(conn, "training_logs", "comment", "comment TEXT")?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Setup local sqlite file inside user App Data directory
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");
            let db_path = app_data_dir.join("fitnotes_local.db");

            let conn = Connection::open(db_path).expect("Failed to open local SQLite database");

            // Execute local database table generation
            conn.execute_batch(
                r#"
                CREATE TABLE IF NOT EXISTS categories (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    colour INTEGER NOT NULL,
                    sort_order INTEGER NOT NULL,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS exercises (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
                    exercise_type_id INTEGER NOT NULL,
                    notes TEXT,
                    weight_increment REAL,
                    default_rest_time INTEGER,
                    weight_unit_id INTEGER,
                    is_favourite INTEGER DEFAULT 0 NOT NULL,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS training_logs (
                    id TEXT PRIMARY KEY,
                    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
                    date TEXT NOT NULL,
                    metric_weight REAL,
                    reps INTEGER,
                    unit INTEGER,
                    routine_section_exercise_set_id TEXT,
                    is_personal_record INTEGER DEFAULT 0 NOT NULL,
                    is_complete INTEGER DEFAULT 0 NOT NULL,
                    distance REAL,
                    duration_seconds INTEGER,
                    comment TEXT,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS body_weights (
                    id TEXT PRIMARY KEY,
                    date TEXT NOT NULL,
                    body_weight_metric REAL NOT NULL,
                    body_fat REAL,
                    comments TEXT,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS plates (
                    id TEXT PRIMARY KEY,
                    weight REAL NOT NULL,
                    unit INTEGER NOT NULL,
                    count INTEGER NOT NULL,
                    enabled INTEGER DEFAULT 1 NOT NULL,
                    colour INTEGER NOT NULL,
                    width_ratio REAL NOT NULL,
                    height_ratio REAL NOT NULL,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS barbells (
                    id TEXT PRIMARY KEY,
                    weight REAL NOT NULL,
                    unit INTEGER NOT NULL,
                    exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workout_comments (
                    id TEXT PRIMARY KEY,
                    date TEXT UNIQUE NOT NULL,
                    comment TEXT,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS routines (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    notes TEXT,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS routine_sections (
                    id TEXT PRIMARY KEY,
                    routine_id TEXT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS routine_section_exercises (
                    id TEXT PRIMARY KEY,
                    routine_section_id TEXT NOT NULL REFERENCES routine_sections(id) ON DELETE CASCADE,
                    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
                    sort_order INTEGER NOT NULL,
                    populate_sets_type INTEGER NOT NULL,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS routine_section_exercise_sets (
                    id TEXT PRIMARY KEY,
                    routine_section_exercise_id TEXT NOT NULL REFERENCES routine_section_exercises(id) ON DELETE CASCADE,
                    metric_weight REAL,
                    reps INTEGER,
                    sort_order INTEGER NOT NULL,
                    distance REAL,
                    duration_seconds INTEGER,
                    unit INTEGER,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workout_groups (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    date TEXT NOT NULL,
                    colour INTEGER NOT NULL,
                    routine_section_id TEXT REFERENCES routine_sections(id) ON DELETE SET NULL,
                    auto_jump_enabled INTEGER DEFAULT 0 NOT NULL,
                    rest_timer_auto_start_enabled INTEGER DEFAULT 0 NOT NULL,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workout_group_exercises (
                    id TEXT PRIMARY KEY,
                    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
                    date TEXT NOT NULL,
                    routine_section_id TEXT REFERENCES routine_sections(id) ON DELETE SET NULL,
                    workout_group_id TEXT NOT NULL REFERENCES workout_groups(id) ON DELETE CASCADE,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS goals (
                    id TEXT PRIMARY KEY,
                    type_id INTEGER NOT NULL,
                    exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
                    metric_weight REAL,
                    reps INTEGER,
                    unit INTEGER,
                    title TEXT,
                    target_date TEXT,
                    sort_order INTEGER NOT NULL,
                    distance REAL,
                    duration_seconds INTEGER,
                    start_date TEXT,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS measurements (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    unit_id INTEGER NOT NULL,
                    goal_type INTEGER,
                    goal_value REAL,
                    custom INTEGER DEFAULT 1 NOT NULL,
                    enabled INTEGER DEFAULT 1 NOT NULL,
                    sort_order INTEGER NOT NULL,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS measurement_records (
                    id TEXT PRIMARY KEY,
                    measurement_id TEXT NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
                    date TEXT NOT NULL,
                    time TEXT NOT NULL,
                    value REAL NOT NULL,
                    comment TEXT,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS exercise_comments (
                    id TEXT PRIMARY KEY,
                    exercise_id TEXT NOT NULL,
                    date TEXT NOT NULL,
                    comment TEXT,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workout_times (
                    id TEXT PRIMARY KEY,
                    date TEXT NOT NULL,
                    start_time TEXT,
                    end_time TEXT,
                    duration_seconds INTEGER,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS custom_units (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    abbreviation TEXT NOT NULL,
                    type INTEGER NOT NULL,
                    conversion_to_base REAL NOT NULL,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS graph_favourites (
                    id TEXT PRIMARY KEY,
                    exercise_id TEXT,
                    graph_type INTEGER NOT NULL,
                    time_period INTEGER NOT NULL,
                    rep_filter TEXT,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS workout_routines (
                    id TEXT PRIMARY KEY,
                    date TEXT NOT NULL,
                    routine_id TEXT NOT NULL,
                    routine_section_id TEXT,
                    last_modified TEXT NOT NULL,
                    is_deleted INTEGER DEFAULT 0 NOT NULL,
                    is_dirty INTEGER DEFAULT 0 NOT NULL
                );
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
                "#,
            )
            .expect("Failed to initialize database tables");

            run_sqlite_upgrades(&conn).expect("Failed to upgrade local SQLite schema");

            app.manage(DbConnection(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tauri_query,
            tauri_execute,
            tauri_sync,
            tauri_invalidate_cache
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Android does not reliably deliver focus/visibilitychange to the
            // WebView when the activity returns to the foreground; surface the
            // native resume so the frontend can run its background pull-sync.
            let resumed = match &event {
                tauri::RunEvent::Resumed => true,
                tauri::RunEvent::WindowEvent {
                    event: tauri::WindowEvent::Focused(true),
                    ..
                } => true,
                _ => false,
            };
            if resumed {
                use tauri::Emitter;
                if let Err(e) = app_handle.emit("app-resumed", ()) {
                    eprintln!("lifecycle: failed to emit app-resumed: {}", e);
                }
            }
        });
}
