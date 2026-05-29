// lib.rs - Tauri v2 app library: commands + run(). main.rs is a thin entry point.

use std::fs;
use std::sync::Mutex;
use tauri::{Manager, State};
use serde::{Serialize, Deserialize};
use serde_json::Value;
use rusqlite::{params, Connection, Result};

struct DbConnection(Mutex<Connection>);

#[tauri::command]
fn tauri_query(
    sql: &str,
    params: Vec<Value>,
    db_state: State<'_, DbConnection>,
) -> std::result::Result<Vec<Value>, String> {
    let conn = db_state.0.lock().unwrap();
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

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

    let sql_params_ref: Vec<&dyn rusqlite::ToSql> = sql_params
        .iter()
        .map(|b| b.as_ref())
        .collect();

    // Map dynamic column names and row values to structured JSON objects.
    // Capture column names before query() borrows stmt mutably.
    let col_count = stmt.column_count();
    let col_names: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).map(|s| s.to_string()).map_err(|e| e.to_string()))
        .collect::<std::result::Result<_, _>>()?;
    let mut rows = stmt
        .query(&sql_params_ref[..])
        .map_err(|e| e.to_string())?;

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

    let sql_params_ref: Vec<&dyn rusqlite::ToSql> = sql_params
        .iter()
        .map(|b| b.as_ref())
        .collect();

    conn.execute(sql, &sql_params_ref[..])
        .map_err(|e| e.to_string())?;

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
    goals: Vec<Value>,
    measurements: Vec<Value>,
    measurement_records: Vec<Value>,
    exercise_comments: Vec<Value>,
    workout_times: Vec<Value>,
    custom_units: Vec<Value>,
    graph_favourites: Vec<Value>,
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
    goals: Option<Vec<Value>>,
    measurements: Option<Vec<Value>>,
    measurement_records: Option<Vec<Value>>,
    exercise_comments: Option<Vec<Value>>,
    workout_times: Option<Vec<Value>>,
    custom_units: Option<Vec<Value>>,
    graph_favourites: Option<Vec<Value>>,
}

#[tauri::command]
async fn tauri_sync(
    api_token: &str,
    api_base_url: &str,
    db_state: State<'_, DbConnection>,
) -> std::result::Result<(), String> {
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

        let extract_dirty = |table: &str| -> Result<Vec<Value>> {
            let mut stmt = conn.prepare(&format!("SELECT * FROM {} WHERE is_dirty = 1", table))?;
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
                        rusqlite::types::ValueRef::Real(f) => serde_json::Number::from_f64(f).map(Value::Number).unwrap_or(Value::Null),
                        rusqlite::types::ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
                        rusqlite::types::ValueRef::Blob(b) => Value::String(hex::encode(b)),
                    };
                    map.insert(col_name.to_string(), json_val);
                }
                list.push(Value::Object(map));
            }
            Ok(list)
        };

        SyncPayload {
            last_sync_timestamp: last_sync,
            categories: extract_dirty("categories").unwrap_or_default(),
            exercises: extract_dirty("exercises").unwrap_or_default(),
            routines: extract_dirty("routines").unwrap_or_default(),
            routine_sections: extract_dirty("routine_sections").unwrap_or_default(),
            routine_section_exercises: extract_dirty("routine_section_exercises").unwrap_or_default(),
            routine_section_exercise_sets: extract_dirty("routine_section_exercise_sets").unwrap_or_default(),
            training_logs: extract_dirty("training_logs").unwrap_or_default(),
            body_weights: extract_dirty("body_weights").unwrap_or_default(),
            plates: extract_dirty("plates").unwrap_or_default(),
            barbells: extract_dirty("barbells").unwrap_or_default(),
            workout_comments: extract_dirty("workout_comments").unwrap_or_default(),
            workout_groups: extract_dirty("workout_groups").unwrap_or_default(),
            workout_group_exercises: extract_dirty("workout_group_exercises").unwrap_or_default(),
            goals: extract_dirty("goals").unwrap_or_default(),
            measurements: extract_dirty("measurements").unwrap_or_default(),
            measurement_records: extract_dirty("measurement_records").unwrap_or_default(),
            exercise_comments: extract_dirty("exercise_comments").unwrap_or_default(),
            workout_times: extract_dirty("workout_times").unwrap_or_default(),
            custom_units: extract_dirty("custom_units").unwrap_or_default(),
            graph_favourites: extract_dirty("graph_favourites").unwrap_or_default(),
        }
    };

    // 3. Dispatch HTTP Post Sync request to Go API
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/sync", api_base_url))
        .header("Authorization", format!("Bearer {}", api_token))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Server returned failure code: {}", res.status()));
    }

    let sync_res: SyncResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse server sync payload: {}", e))?;

    // 4. Ingest server updates (PULL) inside a local SQLite transaction
    {
        let mut conn = db_state.0.lock().unwrap();
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        // Helper upsert function to map server payload directly to SQLite
        let upsert_table = |table: &str, items: &[Value], columns: &[&str]| -> std::result::Result<(), String> {
            // 1. Reset dirty flag on our items
            tx.execute(
                &format!("UPDATE {} SET is_dirty = 0 WHERE is_dirty = 1", table),
                [],
            )
            .map_err(|e| e.to_string())?;

            // 2. Insert or replace server items
            for item in items {
                let map = item.as_object().ok_or("Expected JSON object")?;
                let placeholders: Vec<String> = (1..=columns.len()).map(|i| format!("?{}", i)).collect();
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

                let sql_params_ref: Vec<&dyn rusqlite::ToSql> = sql_params
                    .iter()
                    .map(|b| b.as_ref())
                    .collect();

                tx.execute(&sql, &sql_params_ref[..])
                    .map_err(|e| e.to_string())?;
            }
            Ok(())
        };

        if let Some(items) = sync_res.categories {
            upsert_table("categories", items.as_slice(), &["id", "name", "colour", "sort_order", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.exercises {
            upsert_table("exercises", items.as_slice(), &["id", "name", "category_id", "exercise_type_id", "notes", "weight_increment", "default_rest_time", "weight_unit_id", "is_favourite", "last_modified", "is_deleted"])?;
        }
        // Routine templates: parents before children.
        if let Some(items) = sync_res.routines {
            upsert_table("routines", items.as_slice(), &["id", "name", "notes", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.routine_sections {
            upsert_table("routine_sections", items.as_slice(), &["id", "routine_id", "name", "sort_order", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.routine_section_exercises {
            upsert_table("routine_section_exercises", items.as_slice(), &["id", "routine_section_id", "exercise_id", "sort_order", "populate_sets_type", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.routine_section_exercise_sets {
            upsert_table("routine_section_exercise_sets", items.as_slice(), &["id", "routine_section_exercise_id", "metric_weight", "reps", "sort_order", "distance", "duration_seconds", "unit", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.training_logs {
            upsert_table("training_logs", items.as_slice(), &["id", "exercise_id", "date", "metric_weight", "reps", "unit", "routine_section_exercise_set_id", "is_personal_record", "is_complete", "distance", "duration_seconds", "comment", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.body_weights {
            upsert_table("body_weights", items.as_slice(), &["id", "date", "body_weight_metric", "body_fat", "comments", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.plates {
            upsert_table("plates", items.as_slice(), &["id", "weight", "unit", "count", "enabled", "colour", "width_ratio", "height_ratio", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.barbells {
            upsert_table("barbells", items.as_slice(), &["id", "weight", "unit", "exercise_id", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.workout_comments {
            upsert_table("workout_comments", items.as_slice(), &["id", "date", "comment", "last_modified", "is_deleted"])?;
        }
        // Supersets: groups before their exercise links (routine_sections already upserted above).
        if let Some(items) = sync_res.workout_groups {
            upsert_table("workout_groups", items.as_slice(), &["id", "name", "date", "colour", "routine_section_id", "auto_jump_enabled", "rest_timer_auto_start_enabled", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.workout_group_exercises {
            upsert_table("workout_group_exercises", items.as_slice(), &["id", "exercise_id", "date", "routine_section_id", "workout_group_id", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.goals {
            upsert_table("goals", items.as_slice(), &["id", "type_id", "exercise_id", "metric_weight", "reps", "unit", "title", "target_date", "sort_order", "distance", "duration_seconds", "start_date", "last_modified", "is_deleted"])?;
        }
        // Measurements before measurement_records.
        if let Some(items) = sync_res.measurements {
            upsert_table("measurements", items.as_slice(), &["id", "name", "unit_id", "goal_type", "goal_value", "custom", "enabled", "sort_order", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.measurement_records {
            upsert_table("measurement_records", items.as_slice(), &["id", "measurement_id", "date", "time", "value", "comment", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.exercise_comments {
            upsert_table("exercise_comments", items.as_slice(), &["id", "exercise_id", "date", "comment", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.workout_times {
            upsert_table("workout_times", items.as_slice(), &["id", "date", "start_time", "end_time", "duration_seconds", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.custom_units {
            upsert_table("custom_units", items.as_slice(), &["id", "name", "abbreviation", "type", "conversion_to_base", "last_modified", "is_deleted"])?;
        }
        if let Some(items) = sync_res.graph_favourites {
            upsert_table("graph_favourites", items.as_slice(), &["id", "exercise_id", "graph_type", "time_period", "rep_filter", "last_modified", "is_deleted"])?;
        }

        // Save server timestamp as settings: last_sync_timestamp
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync_timestamp', ?1)",
            params![sync_res.server_time],
        )
        .map_err(|e| e.to_string())?;

        tx.commit().map_err(|e| e.to_string())?;
    }

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
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
                "#,
            )
            .expect("Failed to initialize database tables");

            app.manage(DbConnection(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tauri_query,
            tauri_execute,
            tauri_sync
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
