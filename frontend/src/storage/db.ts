// db.ts - Unified Offline-First Database Driver & Sync Coordinator
import { DEFAULT_SETTINGS } from '../lib/settings';

export interface DBDriver {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<void>;
  sync(apiToken: string, apiBaseUrl: string): Promise<void>;
  invalidateCache(preserveDirty: boolean): Promise<void>;
  onChange(listener: () => void): void;
}

// Check if running inside Tauri WebView
const isTauri = () => {
  return typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
};

// Default body measurements shown to guests with an empty local store (mirrors
// FitNotes defaults). unit_id: 1 = cm, 2 = inches, 3 = percent.
// Fixed UUIDs keep selection stable across reloads and remain valid if a record
// logged against one is later persisted and synced (server measurement_records
// references measurements(id) as UUID). Logged-in users pull real server-seeded
// measurements instead, so these virtual rows only surface before any exist.
const DEFAULT_MEASUREMENTS: Array<{ id: string; name: string; unit_id: number }> = [
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string => (
  typeof value === 'string' && UUID_RE.test(value)
);

const legacyIdToUuid = (id: string): string => {
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

const normalizeUuid = (value: unknown): unknown => {
  if (value == null || value === '') return null;
  if (isUuid(value)) return value;
  if (typeof value === 'string') return legacyIdToUuid(value);
  return value;
};

const normalizeTimestamp = (value: unknown): string => {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
};

const normalizeForSync = (item: any, uuidFields: string[] = []) => {
  const normalized = { ...item };
  delete normalized.user_id;
  normalized.id = normalizeUuid(normalized.id);
  normalized.last_modified = normalizeTimestamp(normalized.last_modified);

  uuidFields.forEach(field => {
    normalized[field] = normalizeUuid(normalized[field]);
  });

  return normalized;
};

// In-Memory/LocalStorage Local Database Driver for Browser Mode
class BrowserLocalDriver implements DBDriver {
  private changeListeners: (() => void)[] = [];

  onChange(listener: () => void): void {
    this.changeListeners.push(listener);
  }

  private notifyListeners(): void {
    this.changeListeners.forEach(l => {
      try { l(); } catch (e) { console.error(e); }
    });
  }

  private getStore(table: string): any[] {
    const data = localStorage.getItem(`fn_${table}`);
    return data ? JSON.parse(data) : [];
  }

  private setStore(table: string, data: any[]) {
    localStorage.setItem(`fn_${table}`, JSON.stringify(data));
  }

  // Simple SQL router to mock SQLite queries in the browser
  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const normalized = sql.toLowerCase().trim();

    if (normalized.startsWith('select * from categories')) {
      const items = this.getStore('categories').filter(x => !x.is_deleted);
      return items.sort((a, b) => a.sort_order - b.sort_order) as T[];
    }

    if (normalized.startsWith('select * from exercises')) {
      let items = this.getStore('exercises').filter(x => !x.is_deleted);
      if (normalized.includes('category_id =')) {
        const catId = params[0];
        items = items.filter(x => x.category_id === catId);
      }
      return items.sort((a, b) => a.name.localeCompare(b.name)) as T[];
    }

    if (normalized.startsWith('select * from training_logs')) {
      let items = this.getStore('training_logs').filter(x => !x.is_deleted);
      if (normalized.includes('date =')) {
        const targetDate = params[0];
        items = items.filter(x => x.date === targetDate);
      }
      return items as T[];
    }

    if (normalized.startsWith('select * from body_weights')) {
      const items = this.getStore('body_weights').filter(x => !x.is_deleted);
      return items.sort((a, b) => a.date.localeCompare(b.date)) as T[];
    }

    if (normalized.startsWith('select * from plates')) {
      const items = this.getStore('plates').filter(x => !x.is_deleted);
      if (items.length === 0) {
        // Return default plates if empty
        return [
          { id: 'p1', weight: 20, unit: 1, count: 6, enabled: true, colour: 4278190080, width_ratio: 0.18, height_ratio: 0.9, last_modified: new Date().toISOString(), is_deleted: false, is_dirty: false },
          { id: 'p2', weight: 15, unit: 1, count: 2, enabled: true, colour: 4293926400, width_ratio: 0.16, height_ratio: 0.85, last_modified: new Date().toISOString(), is_deleted: false, is_dirty: false },
          { id: 'p3', weight: 10, unit: 1, count: 4, enabled: true, colour: 4278222848, width_ratio: 0.14, height_ratio: 0.75, last_modified: new Date().toISOString(), is_deleted: false, is_dirty: false },
          { id: 'p4', weight: 5, unit: 1, count: 4, enabled: true, colour: 4294901760, width_ratio: 0.12, height_ratio: 0.6, last_modified: new Date().toISOString(), is_deleted: false, is_dirty: false },
          { id: 'p5', weight: 2.5, unit: 1, count: 4, enabled: true, colour: 4286578688, width_ratio: 0.1, height_ratio: 0.5, last_modified: new Date().toISOString(), is_deleted: false, is_dirty: false }
        ] as T[];
      }
      return items as T[];
    }

    if (normalized.startsWith('select * from barbells')) {
      const items = this.getStore('barbells').filter(x => !x.is_deleted);
      if (items.length === 0) {
        return [{ id: 'b1', weight: 20, unit: 1, exercise_id: null, last_modified: new Date().toISOString(), is_deleted: false, is_dirty: false }] as T[];
      }
      return items as T[];
    }

    if (normalized.startsWith('select * from workout_comments')) {
      const items = this.getStore('workout_comments').filter(x => !x.is_deleted);
      if (normalized.includes('date =')) {
        const d = params[0];
        return items.filter(x => x.date === d) as T[];
      }
      return items as T[];
    }

    if (normalized.startsWith('select * from routines')) {
      const items = this.getStore('routines').filter(x => !x.is_deleted);
      return items as T[];
    }

    if (normalized.startsWith('select * from routine_sections')) {
      const items = this.getStore('routine_sections').filter(x => !x.is_deleted);
      if (normalized.includes('routine_id =')) {
        const routineId = params[0];
        return items.filter(x => x.routine_id === routineId).sort((a, b) => a.sort_order - b.sort_order) as T[];
      }
      return items as T[];
    }

    if (normalized.startsWith('select * from routine_section_exercises')) {
      const items = this.getStore('routine_section_exercises').filter(x => !x.is_deleted);
      if (normalized.includes('routine_section_id =')) {
        const sectionId = params[0];
        return items.filter(x => x.routine_section_id === sectionId).sort((a, b) => a.sort_order - b.sort_order) as T[];
      }
      return items as T[];
    }

    if (normalized.startsWith('select * from routine_section_exercise_sets')) {
      const items = this.getStore('routine_section_exercise_sets').filter(x => !x.is_deleted);
      if (normalized.includes('routine_section_exercise_id =')) {
        const rseId = params[0];
        return items.filter(x => x.routine_section_exercise_id === rseId).sort((a, b) => a.sort_order - b.sort_order) as T[];
      }
      return items as T[];
    }

    if (normalized.startsWith('select * from settings')) {
      const raw = localStorage.getItem('fn_settings');
      if (raw) return [JSON.parse(raw)] as T[];
      return [{ ...DEFAULT_SETTINGS, is_dirty: 0, last_modified: new Date().toISOString() }] as T[];
    }

    if (normalized.startsWith('select * from goals')) {
      const items = this.getStore('goals').filter(x => !x.is_deleted);
      return items.sort((a, b) => a.sort_order - b.sort_order) as T[];
    }

    if (normalized.startsWith('select * from exercise_comments')) {
      const items = this.getStore('exercise_comments').filter(x => !x.is_deleted);
      if (normalized.includes('date =')) return items.filter(x => x.date === params[0]) as T[];
      return items as T[];
    }

    if (normalized.startsWith('select * from workout_times')) {
      const items = this.getStore('workout_times').filter(x => !x.is_deleted);
      if (normalized.includes('date =')) return items.filter(x => x.date === params[0]) as T[];
      return items as T[];
    }

    if (normalized.startsWith('select * from custom_units')) {
      return this.getStore('custom_units').filter(x => !x.is_deleted) as T[];
    }

    if (normalized.startsWith('select * from graph_favourites')) {
      return this.getStore('graph_favourites').filter(x => !x.is_deleted) as T[];
    }

    if (normalized.startsWith('select * from measurement_records')) {
      const items = this.getStore('measurement_records').filter(x => !x.is_deleted);
      if (normalized.includes('measurement_id =')) {
        const mid = params[0];
        return items.filter(x => x.measurement_id === mid).sort((a, b) => b.date.localeCompare(a.date)) as T[];
      }
      return items.sort((a, b) => b.date.localeCompare(a.date)) as T[];
    }

    if (normalized.startsWith('select * from measurements')) {
      const items = this.getStore('measurements').filter(x => !x.is_deleted);
      if (items.length === 0) {
        return DEFAULT_MEASUREMENTS.map((m, i) => ({
          id: m.id, name: m.name, unit_id: m.unit_id, goal_type: null, goal_value: null,
          custom: false, enabled: true, sort_order: i,
          last_modified: new Date().toISOString(), is_deleted: false, is_dirty: 0,
        })) as T[];
      }
      return items.sort((a, b) => a.sort_order - b.sort_order) as T[];
    }

    if (normalized.startsWith('select * from workout_groups')) {
      const items = this.getStore('workout_groups').filter(x => !x.is_deleted);
      if (normalized.includes('date =')) {
        const date = params[0];
        return items.filter(x => x.date === date) as T[];
      }
      return items as T[];
    }

    if (normalized.startsWith('select * from workout_group_exercises')) {
      const items = this.getStore('workout_group_exercises').filter(x => !x.is_deleted);
      if (normalized.includes('date =')) {
        const date = params[0];
        return items.filter(x => x.date === date) as T[];
      }
      return items as T[];
    }

    return [] as T[];
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    const normalized = sql.toLowerCase().trim();

    if (normalized.startsWith('delete from')) {
      const parts = normalized.split(' ');
      const tableName = parts[2];
      if (tableName) {
        const store = this.getStore(tableName);
        let updatedStore = [];
        if (normalized.includes('where id =')) {
          const targetId = params[0];
          updatedStore = store.filter(x => x.id !== targetId);
        } else if (normalized.includes('where routine_section_exercise_id =')) {
          const targetRseId = params[0];
          updatedStore = store.filter(x => x.routine_section_exercise_id !== targetRseId);
        } else {
          updatedStore = store;
        }
        this.setStore(tableName, updatedStore);
      }
      return;
    }

    const insertOrReplace = (table: string, item: any) => {
      const store = this.getStore(table);
      const idx = store.findIndex(x => x.id === item.id);
      item.is_dirty = 1;
      item.last_modified = new Date().toISOString();
      if (idx >= 0) store[idx] = item;
      else store.push(item);
      this.setStore(table, store);
    };

    if (normalized.startsWith('insert into categories') || normalized.startsWith('update categories') || normalized.startsWith('replace into categories')) {
      insertOrReplace('categories', params[0]);
    }

    else if (normalized.startsWith('insert into exercises') || normalized.startsWith('update exercises') || normalized.startsWith('replace into exercises')) {
      insertOrReplace('exercises', params[0]);
    }

    else if (normalized.startsWith('insert into training_logs') || normalized.startsWith('update training_logs') || normalized.startsWith('replace into training_logs')) {
      insertOrReplace('training_logs', params[0]);
    }

    else if (normalized.startsWith('insert into body_weights') || normalized.startsWith('update body_weights') || normalized.startsWith('replace into body_weights')) {
      insertOrReplace('body_weights', params[0]);
    }

    else if (normalized.startsWith('insert into plates') || normalized.startsWith('update plates') || normalized.startsWith('replace into plates')) {
      insertOrReplace('plates', params[0]);
    }

    else if (normalized.startsWith('insert into barbells') || normalized.startsWith('update barbells') || normalized.startsWith('replace into barbells')) {
      insertOrReplace('barbells', params[0]);
    }

    else if (normalized.startsWith('insert into workout_comments') || normalized.startsWith('update workout_comments') || normalized.startsWith('replace into workout_comments')) {
      insertOrReplace('workout_comments', params[0]);
    }

    else if (normalized.startsWith('insert into routines') || normalized.startsWith('update routines') || normalized.startsWith('replace into routines')) {
      insertOrReplace('routines', params[0]);
    }

    else if (normalized.startsWith('insert into routine_sections') || normalized.startsWith('update routine_sections') || normalized.startsWith('replace into routine_sections')) {
      insertOrReplace('routine_sections', params[0]);
    }

    else if (normalized.startsWith('insert into routine_section_exercises') || normalized.startsWith('update routine_section_exercises') || normalized.startsWith('replace into routine_section_exercises')) {
      insertOrReplace('routine_section_exercises', params[0]);
    }

    else if (normalized.startsWith('insert into routine_section_exercise_sets') || normalized.startsWith('update routine_section_exercise_sets') || normalized.startsWith('replace into routine_section_exercise_sets')) {
      insertOrReplace('routine_section_exercise_sets', params[0]);
    }

    else if (normalized.startsWith('insert into workout_groups') || normalized.startsWith('update workout_groups') || normalized.startsWith('replace into workout_groups')) {
      insertOrReplace('workout_groups', params[0]);
    }

    else if (normalized.startsWith('insert into workout_group_exercises') || normalized.startsWith('update workout_group_exercises') || normalized.startsWith('replace into workout_group_exercises')) {
      insertOrReplace('workout_group_exercises', params[0]);
    }

    else if (normalized.startsWith('insert into goals') || normalized.startsWith('update goals') || normalized.startsWith('replace into goals')) {
      insertOrReplace('goals', params[0]);
    }

    else if (normalized.startsWith('insert into measurement_records') || normalized.startsWith('update measurement_records') || normalized.startsWith('replace into measurement_records')) {
      insertOrReplace('measurement_records', params[0]);
    }

    else if (normalized.startsWith('insert into measurements') || normalized.startsWith('update measurements') || normalized.startsWith('replace into measurements')) {
      insertOrReplace('measurements', params[0]);
    }

    else if (normalized.startsWith('insert into exercise_comments') || normalized.startsWith('update exercise_comments') || normalized.startsWith('replace into exercise_comments')) {
      insertOrReplace('exercise_comments', params[0]);
    }

    else if (normalized.startsWith('insert into workout_times') || normalized.startsWith('update workout_times') || normalized.startsWith('replace into workout_times')) {
      insertOrReplace('workout_times', params[0]);
    }

    else if (normalized.startsWith('insert into custom_units') || normalized.startsWith('update custom_units') || normalized.startsWith('replace into custom_units')) {
      insertOrReplace('custom_units', params[0]);
    }

    else if (normalized.startsWith('insert into graph_favourites') || normalized.startsWith('update graph_favourites') || normalized.startsWith('replace into graph_favourites')) {
      insertOrReplace('graph_favourites', params[0]);
    }

    // Settings is a per-user singleton, not a list - merge into the stored row.
    else if (normalized.startsWith('insert into settings') || normalized.startsWith('update settings') || normalized.startsWith('replace into settings')) {
      const raw = localStorage.getItem('fn_settings');
      const current = raw ? JSON.parse(raw) : { ...DEFAULT_SETTINGS };
      const merged = { ...current, ...params[0], is_dirty: 1, last_modified: new Date().toISOString() };
      localStorage.setItem('fn_settings', JSON.stringify(merged));
    }

    this.notifyListeners();
  }

  // Frontend synchronization implementation when operating directly in browser mode
  async sync(apiToken: string, apiBaseUrl: string): Promise<void> {
    if (!apiToken) return;

    const rawLastSync = localStorage.getItem('fn_last_sync_timestamp');
    const lastSync = rawLastSync && !Number.isNaN(Date.parse(rawLastSync))
      ? new Date(Date.parse(rawLastSync)).toISOString()
      : new Date(0).toISOString();

    const getDirty = (table: string, uuidFields: string[] = []) => {
      return this.getStore(table)
        .filter(x => x.is_dirty === 1)
        .map(x => normalizeForSync(x, uuidFields));
    };

    // Settings is a singleton; push it only when locally modified.
    const rawSettings = localStorage.getItem('fn_settings');
    const localSettings = rawSettings ? JSON.parse(rawSettings) : null;
    const dirtySettings = localSettings && localSettings.is_dirty === 1
      ? (() => {
          const normalized = { ...localSettings };
          delete normalized.user_id;
          normalized.last_modified = normalizeTimestamp(normalized.last_modified);
          return normalized;
        })()
      : null;

    const payload = {
      last_sync_timestamp: lastSync,
      categories: getDirty('categories'),
      exercises: getDirty('exercises', ['category_id']),
      // Routine templates: parents must precede children so the server upserts
      // them in FK-safe order (routines -> sections -> exercises -> sets).
      routines: getDirty('routines'),
      routine_sections: getDirty('routine_sections', ['routine_id']),
      routine_section_exercises: getDirty('routine_section_exercises', ['routine_section_id', 'exercise_id']),
      routine_section_exercise_sets: getDirty('routine_section_exercise_sets', ['routine_section_exercise_id']),
      training_logs: getDirty('training_logs', ['exercise_id', 'routine_section_exercise_set_id']),
      body_weights: getDirty('body_weights'),
      plates: getDirty('plates'),
      barbells: getDirty('barbells', ['exercise_id']),
      workout_comments: getDirty('workout_comments'),
      workout_groups: getDirty('workout_groups', ['routine_section_id']),
      workout_group_exercises: getDirty('workout_group_exercises', ['exercise_id', 'routine_section_id', 'workout_group_id']),
      goals: getDirty('goals', ['exercise_id']),
      measurements: getDirty('measurements'),
      measurement_records: getDirty('measurement_records', ['measurement_id']),
      exercise_comments: getDirty('exercise_comments', ['exercise_id']),
      workout_times: getDirty('workout_times'),
      custom_units: getDirty('custom_units'),
      graph_favourites: getDirty('graph_favourites', ['exercise_id']),
      settings: dirtySettings,
    };

    try {
      const res = await fetch(`${apiBaseUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Sync failed on server');

      const serverData = await res.json();

      // Upsert server updates and clear dirty markers
      const applyUpdates = (table: string, serverItems: any[]) => {
        const localItems = this.getStore(table);
        
        // 1. Clear dirty state for successfully pushed items
        localItems.forEach(x => {
          if (x.is_dirty === 1) {
            x.is_dirty = 0;
          }
        });

        // 2. Merge server items (Pull updates)
        serverItems.forEach(srv => {
          const idx = localItems.findIndex(x => x.id === srv.id);
          if (idx >= 0) {
            localItems[idx] = { ...srv, is_dirty: 0 };
          } else {
            localItems.push({ ...srv, is_dirty: 0 });
          }
        });

        this.setStore(table, localItems);
      };

      applyUpdates('categories', serverData.categories || []);
      applyUpdates('exercises', serverData.exercises || []);
      applyUpdates('routines', serverData.routines || []);
      applyUpdates('routine_sections', serverData.routine_sections || []);
      applyUpdates('routine_section_exercises', serverData.routine_section_exercises || []);
      applyUpdates('routine_section_exercise_sets', serverData.routine_section_exercise_sets || []);
      applyUpdates('training_logs', serverData.training_logs || []);
      applyUpdates('body_weights', serverData.body_weights || []);
      applyUpdates('plates', serverData.plates || []);
      applyUpdates('barbells', serverData.barbells || []);
      applyUpdates('workout_comments', serverData.workout_comments || []);
      applyUpdates('workout_groups', serverData.workout_groups || []);
      applyUpdates('workout_group_exercises', serverData.workout_group_exercises || []);
      applyUpdates('goals', serverData.goals || []);
      applyUpdates('measurements', serverData.measurements || []);
      applyUpdates('measurement_records', serverData.measurement_records || []);
      applyUpdates('exercise_comments', serverData.exercise_comments || []);
      applyUpdates('workout_times', serverData.workout_times || []);
      applyUpdates('custom_units', serverData.custom_units || []);
      applyUpdates('graph_favourites', serverData.graph_favourites || []);

      // Settings singleton: clear the pushed dirty flag, then apply the server copy
      // (last-write-wins) if one came back.
      if (dirtySettings) {
        localStorage.setItem('fn_settings', JSON.stringify({ ...localSettings, is_dirty: 0 }));
      }
      if (serverData.settings) {
        localStorage.setItem('fn_settings', JSON.stringify({ ...serverData.settings, is_dirty: 0 }));
      }

      localStorage.setItem('fn_last_sync_timestamp', serverData.server_time);
      console.log('Synchronization complete at server time:', serverData.server_time);
    } catch (e) {
      console.error('Error during synchronization:', e);
      throw e;
    }
  }

  async invalidateCache(preserveDirty: boolean): Promise<void> {
    localStorage.removeItem('fn_last_sync_timestamp');
    const tables = [
      'categories',
      'exercises',
      'training_logs',
      'body_weights',
      'plates',
      'barbells',
      'workout_comments',
      'workout_groups',
      'workout_group_exercises',
      'routines',
      'routine_sections',
      'routine_section_exercises',
      'routine_section_exercise_sets',
      'goals',
      'measurements',
      'measurement_records',
      'exercise_comments',
      'workout_times',
      'custom_units',
      'graph_favourites'
    ];

    tables.forEach(table => {
      const key = `fn_${table}`;
      if (preserveDirty) {
        const store = this.getStore(table);
        const dirty = store.filter(x => x.is_dirty === 1);
        localStorage.setItem(key, JSON.stringify(dirty));
      } else {
        localStorage.removeItem(key);
      }
    });

    if (!preserveDirty) {
      localStorage.removeItem('fn_settings');
    } else {
      const raw = localStorage.getItem('fn_settings');
      if (raw) {
        try {
          const settingsObj = JSON.parse(raw);
          if (settingsObj.is_dirty !== 1) {
            localStorage.removeItem('fn_settings');
          }
        } catch {
          localStorage.removeItem('fn_settings');
        }
      }
    }
  }
}

// Tauri native sqlite driver implementation that makes IPC calls to Rust side
class TauriNativeDriver implements DBDriver {
  private changeListeners: (() => void)[] = [];

  onChange(listener: () => void): void {
    this.changeListeners.push(listener);
  }

  private notifyListeners(): void {
    this.changeListeners.forEach(l => {
      try { l(); } catch (e) { console.error(e); }
    });
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    // @ts-ignore
    const tauriModule = '@tauri' + '-apps/api/core';
    const { invoke } = await import(/* @vite-ignore */ tauriModule);
    return (invoke as any)('tauri_query', { sql, params }) as Promise<T[]>;
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    // @ts-ignore
    const tauriModule = '@tauri' + '-apps/api/core';
    const { invoke } = await import(/* @vite-ignore */ tauriModule);
    await (invoke as any)('tauri_execute', { sql, params });
    this.notifyListeners();
  }

  async sync(apiToken: string, apiBaseUrl: string): Promise<void> {
    // @ts-ignore
    const tauriModule = '@tauri' + '-apps/api/core';
    const { invoke } = await import(/* @vite-ignore */ tauriModule);
    await (invoke as any)('tauri_sync', { apiToken, apiBaseUrl });
  }

  async invalidateCache(preserveDirty: boolean): Promise<void> {
    // @ts-ignore
    const tauriModule = '@tauri' + '-apps/api/core';
    const { invoke } = await import(/* @vite-ignore */ tauriModule);
    await (invoke as any)('tauri_invalidate_cache', { preserveDirty });
  }
}

// Export active driver singleton based on runtime platform
export const db: DBDriver = isTauri() ? new TauriNativeDriver() : new BrowserLocalDriver();
export { isTauri };
