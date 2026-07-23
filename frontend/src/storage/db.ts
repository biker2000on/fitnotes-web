// db.ts - Unified Offline-First Database Driver & Sync Coordinator
//
// Three drivers implement the same DBDriver interface:
//  - TauriNativeDriver: mobile/desktop app, real SQLite via Rust IPC.
//  - SqliteWasmDriver: web browsers, real SQLite (WASM) persisted to OPFS.
//  - BrowserLocalDriver: legacy localStorage mock, kept as the fallback for
//    browsers without OPFS support (and for second tabs, since the OPFS pool
//    takes exclusive file handles).
import { invoke } from '@tauri-apps/api/core';
import { DEFAULT_SETTINGS } from '../lib/settings';
import {
  DBDriver,
  AuthExpiredError,
  UUID_FIELDS,
  buildShorthandStatements,
  isBuiltInSeedRow,
  normalizeForSync,
  normalizeTimestamp,
  settingsFromKeyValueRows,
  virtualDefaultBarbells,
  virtualDefaultMeasurements,
  virtualDefaultPlates,
} from './shared';
import { SqliteWasmDriver } from './sqliteDriver';

export type { DBDriver } from './shared';
export { AuthExpiredError } from './shared';

// Check if running inside Tauri WebView
const isTauri = () => {
  return typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
};

// In-Memory/LocalStorage Local Database Driver for Browser Mode
export class BrowserLocalDriver implements DBDriver {
  private changeListeners: (() => void)[] = [];

  onChange(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter(l => l !== listener);
    };
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
      return items.sort((a, b) => (a.measured_at || a.date).localeCompare(b.measured_at || b.date)) as T[];
    }

    if (normalized.startsWith('select * from plates')) {
      const items = this.getStore('plates').filter(x => !x.is_deleted);
      if (items.length === 0) {
        return virtualDefaultPlates() as T[];
      }
      return items as T[];
    }

    if (normalized.startsWith('select * from barbells')) {
      const items = this.getStore('barbells').filter(x => !x.is_deleted);
      if (items.length === 0) {
        return virtualDefaultBarbells() as T[];
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
        return virtualDefaultMeasurements() as T[];
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

    if (normalized.startsWith('select * from workout_routines')) {
      const items = this.getStore('workout_routines').filter(x => !x.is_deleted);
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

    // Settings is a per-user singleton, not a list - merge into the stored row.
    if (normalized.startsWith('insert into settings') || normalized.startsWith('update settings') || normalized.startsWith('replace into settings')) {
      const raw = localStorage.getItem('fn_settings');
      const current = raw ? JSON.parse(raw) : { ...DEFAULT_SETTINGS };
      const merged = { ...current, ...params[0], is_dirty: 1, last_modified: new Date().toISOString() };
      localStorage.setItem('fn_settings', JSON.stringify(merged));
      this.notifyListeners();
      return;
    }

    // Shorthand insert/update: match "INSERT INTO <table>" / "UPDATE <table>"
    // for any known synced table and upsert the row object.
    const parts = normalized.split(/\s+/);
    const table = parts[0] === 'update' ? parts[1] : parts[2];
    if (table && params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
      const store = this.getStore(table);
      const item = { ...params[0] };
      const idx = store.findIndex(x => x.id === item.id);
      item.is_dirty = 1;
      item.last_modified = new Date().toISOString();
      if (idx >= 0) store[idx] = item;
      else store.push(item);
      this.setStore(table, store);
    }

    this.notifyListeners();
  }

  // Frontend synchronization implementation when operating directly in browser mode
  async sync(apiToken: string, apiBaseUrl: string): Promise<number | null> {
    if (!apiToken) return 0;

    const rawLastSync = localStorage.getItem('fn_last_sync_timestamp');
    const lastSync = rawLastSync && !Number.isNaN(Date.parse(rawLastSync))
      ? new Date(Date.parse(rawLastSync)).toISOString()
      : new Date(0).toISOString();

    const getDirty = (table: string, uuidFields: string[] = []) => {
      return this.getStore(table)
        .filter(x => x.is_dirty === 1)
        .filter(x => !isBuiltInSeedRow(table, x))
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
      exercises: getDirty('exercises', UUID_FIELDS.exercises),
      // Routine templates: parents must precede children so the server upserts
      // them in FK-safe order (routines -> sections -> exercises -> sets).
      routines: getDirty('routines'),
      routine_sections: getDirty('routine_sections', UUID_FIELDS.routine_sections),
      routine_section_exercises: getDirty('routine_section_exercises', UUID_FIELDS.routine_section_exercises),
      routine_section_exercise_sets: getDirty('routine_section_exercise_sets', UUID_FIELDS.routine_section_exercise_sets),
      training_logs: getDirty('training_logs', UUID_FIELDS.training_logs),
      body_weights: getDirty('body_weights'),
      plates: getDirty('plates'),
      barbells: getDirty('barbells', UUID_FIELDS.barbells),
      workout_comments: getDirty('workout_comments'),
      workout_groups: getDirty('workout_groups', UUID_FIELDS.workout_groups),
      workout_group_exercises: getDirty('workout_group_exercises', UUID_FIELDS.workout_group_exercises),
      workout_routines: getDirty('workout_routines', UUID_FIELDS.workout_routines),
      goals: getDirty('goals', UUID_FIELDS.goals),
      measurements: getDirty('measurements'),
      measurement_records: getDirty('measurement_records', UUID_FIELDS.measurement_records),
      exercise_comments: getDirty('exercise_comments', UUID_FIELDS.exercise_comments),
      workout_times: getDirty('workout_times'),
      custom_units: getDirty('custom_units'),
      graph_favourites: getDirty('graph_favourites', UUID_FIELDS.graph_favourites),
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

      if (res.status === 401) {
        throw new AuthExpiredError();
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(body || 'Sync failed on server');
      }

      const serverData = await res.json();
      let pulledCount = 0;

      // Upsert server updates and clear dirty markers
      const applyUpdates = (table: string, serverItems: any[]) => {
        pulledCount += serverItems.length;
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
      applyUpdates('workout_routines', serverData.workout_routines || []);
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
        pulledCount += 1;
        localStorage.setItem('fn_settings', JSON.stringify({ ...serverData.settings, is_dirty: 0 }));
      }

      localStorage.setItem('fn_last_sync_timestamp', serverData.server_time);
      console.log('Synchronization complete at server time:', serverData.server_time);
      return pulledCount;
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
      'workout_routines',
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
        const dirty = store.filter(x => x.is_dirty === 1 && !isBuiltInSeedRow(table, x));
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

  onChange(listener: () => void): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.changeListeners.forEach(l => {
      try { l(); } catch (e) { console.error(e); }
    });
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    const normalized = sql.toLowerCase().trim();
    if (normalized === 'select * from settings') {
      const rows = await (invoke as any)('tauri_query', { sql, params }) as Array<{ key: string; value: unknown }>;
      return [settingsFromKeyValueRows(rows)] as T[];
    }

    return (invoke as any)('tauri_query', { sql, params }) as Promise<T[]>;
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    const statements = buildShorthandStatements(sql, params);
    if (statements) {
      for (const stmt of statements) {
        await (invoke as any)('tauri_execute', { sql: stmt.sql, params: stmt.params });
      }
    } else {
      await (invoke as any)('tauri_execute', { sql, params });
    }
    this.notifyListeners();
  }

  async sync(apiToken: string, apiBaseUrl: string): Promise<number | null> {
    try {
      const pulled = await (invoke as any)('tauri_sync', { apiToken, apiBaseUrl });
      // Older mobile binaries return no payload; treat that as "unknown".
      return typeof pulled === 'number' ? pulled : null;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/\b401\b|unauthorized|invalid or expired token/i.test(message)) {
        throw new AuthExpiredError();
      }
      throw e;
    }
  }

  async invalidateCache(preserveDirty: boolean): Promise<void> {
    await (invoke as any)('tauri_invalidate_cache', { preserveDirty });
  }
}

// Export active driver singleton based on runtime platform.
// Browsers get real SQLite (WASM + OPFS) with the localStorage mock as a
// runtime fallback for unsupported browsers / second tabs.
const createDriver = (): DBDriver => {
  if (isTauri()) return new TauriNativeDriver();
  const opfsCapable = typeof Worker !== 'undefined'
    && typeof navigator !== 'undefined'
    && !!navigator.storage?.getDirectory
    && typeof window !== 'undefined'
    && window.isSecureContext;
  if (opfsCapable) return new SqliteWasmDriver(new BrowserLocalDriver());
  return new BrowserLocalDriver();
};

export const db: DBDriver = createDriver();
export { isTauri };

// Dev console access for debugging the active driver.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).__fitnotesDb = db;
}
