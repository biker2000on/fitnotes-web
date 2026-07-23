// shared.ts - Storage-layer contracts and schema metadata shared by every
// DBDriver implementation (localStorage mock, SQLite WASM, Tauri native).
import { DEFAULT_SETTINGS } from '../lib/settings';

export interface DBDriver {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<void>;
  // Resolves with the number of rows pulled from the server, or null when the
  // driver cannot tell (lets callers skip UI refreshes after no-op syncs).
  sync(apiToken: string, apiBaseUrl: string): Promise<number | null>;
  invalidateCache(preserveDirty: boolean): Promise<void>;
  onChange(listener: () => void): () => void;
}

export class AuthExpiredError extends Error {
  constructor(message = 'Session expired. Please sign in again.') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

// Column lists per synced table. This is the single source of truth for the
// web SQLite schema, the shorthand INSERT/UPDATE expansion, and the sync
// payload/apply column mapping. Order matters: tables are listed FK-parents
// first so sync payloads upsert in FK-safe order.
export const TABLE_COLUMNS: Record<string, string[]> = {
  categories: ["id", "name", "colour", "sort_order", "last_modified", "is_deleted", "is_dirty"],
  exercises: ["id", "name", "category_id", "exercise_type_id", "notes", "weight_increment", "default_rest_time", "weight_unit_id", "is_favourite", "aliases", "instructions", "video_url", "equipment", "primary_muscles", "secondary_muscles", "regressions", "progressions", "substitutions", "last_modified", "is_deleted", "is_dirty"],
  routines: ["id", "name", "notes", "category", "version", "program_weeks", "current_week", "start_date", "is_archived", "last_modified", "is_deleted", "is_dirty"],
  routine_sections: ["id", "routine_id", "name", "sort_order", "week_number", "day_of_week", "phase", "last_modified", "is_deleted", "is_dirty"],
  routine_section_exercises: ["id", "routine_section_id", "exercise_id", "sort_order", "populate_sets_type", "progression_enabled", "progression_increment", "progression_reps_step", "last_modified", "is_deleted", "is_dirty"],
  routine_section_exercise_sets: ["id", "routine_section_exercise_id", "metric_weight", "reps", "sort_order", "distance", "duration_seconds", "unit", "min_reps", "max_reps", "set_type", "target_rir", "tempo", "notes", "last_modified", "is_deleted", "is_dirty"],
  training_logs: ["id", "exercise_id", "date", "metric_weight", "reps", "unit", "routine_section_exercise_set_id", "is_personal_record", "is_complete", "distance", "duration_seconds", "comment", "rpe", "rir", "set_type", "last_modified", "is_deleted", "is_dirty"],
  body_weights: ["id", "date", "measured_at", "body_weight_metric", "body_fat", "comments", "last_modified", "is_deleted", "is_dirty"],
  plates: ["id", "weight", "unit", "count", "enabled", "colour", "width_ratio", "height_ratio", "last_modified", "is_deleted", "is_dirty"],
  barbells: ["id", "weight", "unit", "exercise_id", "last_modified", "is_deleted", "is_dirty"],
  workout_comments: ["id", "date", "comment", "last_modified", "is_deleted", "is_dirty"],
  workout_groups: ["id", "name", "date", "colour", "routine_section_id", "auto_jump_enabled", "rest_timer_auto_start_enabled", "last_modified", "is_deleted", "is_dirty"],
  workout_group_exercises: ["id", "exercise_id", "date", "routine_section_id", "workout_group_id", "last_modified", "is_deleted", "is_dirty"],
  workout_routines: ["id", "date", "routine_id", "routine_section_id", "last_modified", "is_deleted", "is_dirty"],
  goals: ["id", "type_id", "exercise_id", "metric_weight", "reps", "unit", "title", "target_date", "sort_order", "distance", "duration_seconds", "start_date", "last_modified", "is_deleted", "is_dirty"],
  measurements: ["id", "name", "unit_id", "goal_type", "goal_value", "custom", "enabled", "sort_order", "last_modified", "is_deleted", "is_dirty"],
  measurement_records: ["id", "measurement_id", "date", "time", "value", "comment", "last_modified", "is_deleted", "is_dirty"],
  exercise_comments: ["id", "exercise_id", "date", "comment", "last_modified", "is_deleted", "is_dirty"],
  workout_times: ["id", "date", "start_time", "end_time", "duration_seconds", "last_modified", "is_deleted", "is_dirty"],
  custom_units: ["id", "name", "abbreviation", "type", "conversion_to_base", "last_modified", "is_deleted", "is_dirty"],
  graph_favourites: ["id", "exercise_id", "graph_type", "time_period", "rep_filter", "last_modified", "is_deleted", "is_dirty"],
};

export const SYNC_TABLES = Object.keys(TABLE_COLUMNS);

// Foreign-key / UUID reference columns per table, normalized before pushing to
// the server (legacy non-UUID ids are hashed into stable UUIDs).
export const UUID_FIELDS: Record<string, string[]> = {
  categories: [],
  exercises: ['category_id'],
  routines: [],
  routine_sections: ['routine_id'],
  routine_section_exercises: ['routine_section_id', 'exercise_id'],
  routine_section_exercise_sets: ['routine_section_exercise_id'],
  training_logs: ['exercise_id', 'routine_section_exercise_set_id'],
  body_weights: [],
  plates: [],
  barbells: ['exercise_id'],
  workout_comments: [],
  workout_groups: ['routine_section_id'],
  workout_group_exercises: ['exercise_id', 'routine_section_id', 'workout_group_id'],
  workout_routines: ['routine_id', 'routine_section_id'],
  goals: ['exercise_id'],
  measurements: [],
  measurement_records: ['measurement_id'],
  exercise_comments: ['exercise_id'],
  workout_times: [],
  custom_units: [],
  graph_favourites: ['exercise_id'],
};

// Columns the Go models type as bool. SQLite stores them as 0/1, but the sync
// API's JSON decoder requires real booleans on push.
export const BOOL_COLUMNS: Record<string, string[]> = {
  categories: ['is_deleted'],
  exercises: ['is_favourite', 'is_deleted'],
  routines: ['is_archived', 'is_deleted'],
  routine_sections: ['is_deleted'],
  routine_section_exercises: ['progression_enabled', 'is_deleted'],
  routine_section_exercise_sets: ['is_deleted'],
  training_logs: ['is_personal_record', 'is_complete', 'is_deleted'],
  body_weights: ['is_deleted'],
  plates: ['enabled', 'is_deleted'],
  barbells: ['is_deleted'],
  workout_comments: ['is_deleted'],
  workout_groups: ['auto_jump_enabled', 'rest_timer_auto_start_enabled', 'is_deleted'],
  workout_group_exercises: ['is_deleted'],
  workout_routines: ['is_deleted'],
  goals: ['is_deleted'],
  measurements: ['custom', 'enabled', 'is_deleted'],
  measurement_records: ['is_deleted'],
  exercise_comments: ['is_deleted'],
  workout_times: ['is_deleted'],
  custom_units: ['is_deleted'],
  graph_favourites: ['is_deleted'],
};

// Default body measurements shown to guests with an empty local store (mirrors
// FitNotes defaults). unit_id: 1 = cm, 2 = inches, 3 = percent.
// Fixed UUIDs keep selection stable across reloads and remain valid if a record
// logged against one is later persisted and synced (server measurement_records
// references measurements(id) as UUID). Logged-in users pull real server-seeded
// measurements instead, so these virtual rows only surface before any exist.
export const DEFAULT_MEASUREMENTS: Array<{ id: string; name: string; unit_id: number }> = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Body Fat', unit_id: 3 },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Neck', unit_id: 1 },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Shoulders', unit_id: 1 },
  { id: '00000000-0000-4000-8000-000000000004', name: 'Chest', unit_id: 1 },
  { id: '00000000-0000-4000-8000-000000000005', name: 'Waist', unit_id: 1 },
  { id: '00000000-0000-4000-8000-000000000006', name: 'Hips', unit_id: 1 },
  { id: '00000000-0000-4000-8000-000000000007', name: 'Thigh', unit_id: 1 },
  { id: '00000000-0000-4000-8000-000000000008', name: 'Calf', unit_id: 1 },
  { id: '00000000-0000-4000-8000-000000000009', name: 'Bicep', unit_id: 1 },
  { id: '00000000-0000-4000-8000-00000000000a', name: 'Forearm', unit_id: 1 },
];

export const virtualDefaultMeasurements = () => DEFAULT_MEASUREMENTS.map((m, i) => ({
  id: m.id, name: m.name, unit_id: m.unit_id, goal_type: null, goal_value: null,
  custom: false, enabled: true, sort_order: i,
  last_modified: new Date().toISOString(), is_deleted: false, is_dirty: 0,
}));

export const virtualDefaultPlates = () => ([
  { id: 'p1', weight: 20, unit: 1, count: 6, enabled: true, colour: 4278190080, width_ratio: 0.18, height_ratio: 0.9, last_modified: new Date().toISOString(), is_deleted: false, is_dirty: false },
  { id: 'p2', weight: 15, unit: 1, count: 2, enabled: true, colour: 4293926400, width_ratio: 0.16, height_ratio: 0.85, last_modified: new Date().toISOString(), is_deleted: false, is_dirty: false },
  { id: 'p3', weight: 10, unit: 1, count: 4, enabled: true, colour: 4278222848, width_ratio: 0.14, height_ratio: 0.75, last_modified: new Date().toISOString(), is_deleted: false, is_dirty: false },
  { id: 'p4', weight: 5, unit: 1, count: 4, enabled: true, colour: 4294901760, width_ratio: 0.12, height_ratio: 0.6, last_modified: new Date().toISOString(), is_deleted: false, is_dirty: false },
  { id: 'p5', weight: 2.5, unit: 1, count: 4, enabled: true, colour: 4286578688, width_ratio: 0.1, height_ratio: 0.5, last_modified: new Date().toISOString(), is_deleted: false, is_dirty: false },
]);

export const virtualDefaultBarbells = () => ([
  { id: 'b1', weight: 20, unit: 1, exercise_id: null, last_modified: new Date().toISOString(), is_deleted: false, is_dirty: false },
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => (
  typeof value === 'string' && UUID_RE.test(value)
);

export const legacyIdToUuid = (id: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const hex = Array.from({ length: 32 }, (_, i) => {
    hash ^= id.charCodeAt(i % id.length) + i;
    hash = Math.imul(hash, 16777619);
    return ((hash >>> ((i % 4) * 8)) & 0xf).toString(16);
  });

  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};

export const normalizeUuid = (value: unknown): unknown => {
  if (value == null || value === '') return null;
  if (isUuid(value)) return value;
  if (typeof value === 'string') return legacyIdToUuid(value);
  return value;
};

export const normalizeTimestamp = (value: unknown): string => {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
};

export const normalizeSignedInt32 = (value: unknown): unknown => {
  if (typeof value !== 'number') return value;
  return value > 2147483647 ? value - 4294967296 : value;
};

export const normalizeForSync = (item: any, uuidFields: string[] = []) => {
  const normalized = { ...item };
  delete normalized.user_id;
  normalized.id = normalizeUuid(normalized.id);
  normalized.last_modified = normalizeTimestamp(normalized.last_modified);

  uuidFields.forEach(field => {
    normalized[field] = normalizeUuid(normalized[field]);
  });
  if ('colour' in normalized) {
    normalized.colour = normalizeSignedInt32(normalized.colour);
  }

  return normalized;
};

export function isBuiltInSeedRow(table: string, row: any): boolean {
  const id = String(row?.id ?? '');
  if (table === 'categories') return /^c-\d+$/.test(id);
  if (table === 'exercises') return id.startsWith('e-');
  if (table === 'routines') return id === 'r-ppl-push';
  if (table === 'routine_sections') return id === 'rs-push';
  if (table === 'routine_section_exercises') return id.startsWith('rse-');
  if (table === 'routine_section_exercise_sets') return id.startsWith('rses-');
  return false;
}

export const parseSettingsValue = (value: unknown): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  // The settings key-value store stringifies writes, so a null setting (e.g.
  // body_weight_goal_weight with no goal) round-trips as the literal string
  // "null". Surface those as real nulls - pushing the string into the sync
  // API fails Go's decoder for numeric-nullable fields (400 invalid payload).
  if (value === 'null' || value === 'undefined' || value === '') return null;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
};

// Rebuild the Settings singleton object from key-value rows (the storage shape
// used by both the Tauri sqlite DB and the web SQLite WASM DB). Values are
// coerced to the JS types DEFAULT_SETTINGS declares: the kv store stringifies
// everything, and parseSettingsValue alone cannot tell a bool stored as "1"
// (e.g. metric migrated from legacy data) from a real number - pushing that
// number into the sync API fails Go's bool decoding with a 400.
export const settingsFromKeyValueRows = (rows: Array<{ key: string; value: unknown }>): Record<string, unknown> => {
  const settings = { ...DEFAULT_SETTINGS, is_dirty: 0 } as Record<string, unknown>;
  rows.forEach(row => {
    if (row.key === 'settings_is_dirty') {
      settings.is_dirty = Number(row.value) || 0;
    } else if (row.key === 'settings_last_modified') {
      settings.last_modified = row.value;
    } else if (row.key !== 'last_sync_timestamp' && row.key !== 'localstorage_migrated') {
      settings[row.key] = parseSettingsValue(row.value);
    }
  });
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const v = settings[key];
    if (v === null || v === undefined) continue;
    if (typeof def === 'boolean' && typeof v !== 'boolean') {
      settings[key] = v === 1 || v === '1' || v === 'true' || v === true;
    } else if (typeof def === 'number' && typeof v !== 'number') {
      const n = Number(v);
      if (!Number.isNaN(n)) settings[key] = n;
    }
  }
  return settings;
};

export interface SqlStatement { sql: string; params: any[] }

// Expand the store's shorthand `execute('INSERT INTO <table>', [rowObject])` /
// `execute('UPDATE <table>', [rowObject])` calls into concrete SQL statements.
// Returns null when the call is not shorthand (raw SQL passes through).
// Mirrors the historical TauriNativeDriver behavior exactly.
export function buildShorthandStatements(sql: string, params: any[]): SqlStatement[] | null {
  const normalized = sql.toLowerCase().trim();
  const hasObjectParam = (
    params.length === 1 &&
    typeof params[0] === 'object' &&
    params[0] !== null &&
    !Array.isArray(params[0])
  );
  if (!hasObjectParam) return null;

  const item = params[0];

  // Settings shorthand must be matched explicitly BEFORE the generic gate:
  // "settings" contains the substring "set", which the gate excludes (it is
  // meant to reject real SQL with SET clauses). With the generic gate alone,
  // settings writes fall through to raw SQL and fail.
  if (/^(insert\s+into|update|replace\s+into)\s+settings$/.test(normalized)) {
    const statements: SqlStatement[] = [];
    for (const [k, v] of Object.entries(item)) {
      if (k === 'is_dirty' || k === 'last_modified') continue;
      const valStr = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
      statements.push({ sql: `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, params: [k, valStr] });
    }
    statements.push({ sql: `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, params: ['settings_is_dirty', '1'] });
    statements.push({ sql: `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, params: ['settings_last_modified', new Date().toISOString()] });
    return statements;
  }

  const isShorthand = (
    !normalized.includes('values') &&
    !normalized.includes('set') &&
    !normalized.includes('(')
  );
  if (!isShorthand) return null;

  const parts = normalized.split(/\s+/);
  const table = parts[0] === 'update' ? parts[1] : parts[2]; // e.g. "exercises"

  const columns = TABLE_COLUMNS[table];
  if (!columns) return null;

  const enriched = {
    ...item,
    is_dirty: 1,
    last_modified: new Date().toISOString(),
  };

  if (normalized.startsWith('insert into') || normalized.startsWith('replace into') || normalized.startsWith('insert or replace into')) {
    const placeholders = columns.map(() => '?').join(', ');
    return [{
      sql: `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      params: columns.map(col => enriched[col] !== undefined ? enriched[col] : null),
    }];
  }
  if (normalized.startsWith('update')) {
    const setClause = columns.filter(col => col !== 'id').map(col => `${col} = ?`).join(', ');
    const updateParams = columns.filter(col => col !== 'id').map(col => enriched[col] !== undefined ? enriched[col] : null);
    updateParams.push(enriched.id);
    return [{ sql: `UPDATE ${table} SET ${setClause} WHERE id = ?`, params: updateParams }];
  }
  return null;
}

// DDL for the web SQLite database, generated from TABLE_COLUMNS so inserts and
// schema can never drift apart. SQLite's dynamic typing makes affinity mostly
// cosmetic; ids and timestamps get TEXT, flags get INTEGER defaults.
export function buildDdlStatements(): string[] {
  const statements: string[] = [];
  for (const [table, columns] of Object.entries(TABLE_COLUMNS)) {
    const colDefs = columns.map(col => {
      if (col === 'id') return 'id TEXT PRIMARY KEY';
      if (col === 'last_modified') return "last_modified TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))";
      if (col === 'is_deleted') return 'is_deleted INTEGER NOT NULL DEFAULT 0';
      if (col === 'is_dirty') return 'is_dirty INTEGER NOT NULL DEFAULT 0';
      return col;
    });
    statements.push(`CREATE TABLE IF NOT EXISTS ${table} (${colDefs.join(', ')})`);
  }
  statements.push('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
  statements.push('CREATE INDEX IF NOT EXISTS idx_training_logs_date ON training_logs (date)');
  statements.push('CREATE INDEX IF NOT EXISTS idx_training_logs_exercise ON training_logs (exercise_id)');
  statements.push('CREATE INDEX IF NOT EXISTS idx_workout_groups_date ON workout_groups (date)');
  statements.push('CREATE INDEX IF NOT EXISTS idx_workout_group_exercises_date ON workout_group_exercises (date)');
  statements.push('CREATE INDEX IF NOT EXISTS idx_measurement_records_measurement ON measurement_records (measurement_id)');
  statements.push('CREATE INDEX IF NOT EXISTS idx_body_weights_date ON body_weights (date)');
  return statements;
}
