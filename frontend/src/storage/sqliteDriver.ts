// sqliteDriver.ts - Web SQLite (WASM + OPFS) implementation of DBDriver.
// Runs real SQLite in a dedicated worker (see sqlite.worker.ts) with data
// persisted to the Origin Private File System. Mirrors the Tauri native
// driver's semantics: pass-through SQL queries, shorthand object executes,
// key-value settings table, and last_sync_timestamp stored in settings.
import {
  DBDriver,
  AuthExpiredError,
  TABLE_COLUMNS,
  SYNC_TABLES,
  UUID_FIELDS,
  BOOL_COLUMNS,
  buildDdlStatements,
  buildShorthandStatements,
  isBuiltInSeedRow,
  normalizeForSync,
  normalizeTimestamp,
  settingsFromKeyValueRows,
  virtualDefaultBarbells,
  virtualDefaultMeasurements,
  virtualDefaultPlates,
  SqlStatement,
} from './shared';

interface WorkerResponse {
  id: number;
  ok: boolean;
  rows?: any[];
  error?: string;
}

const MIGRATED_KEY = 'localstorage_migrated';

export class SqliteWasmDriver implements DBDriver {
  private changeListeners: (() => void)[] = [];
  private worker: Worker | null = null;
  private pending = new Map<number, { resolve: (r: WorkerResponse) => void }>();
  private nextId = 1;
  private mode: 'sqlite' | 'fallback' = 'sqlite';
  private readonly initPromise: Promise<void>;

  // fallback: driver used when OPFS/WASM init fails at runtime (unsupported
  // browser, or a second tab holding the OPFS access handles).
  constructor(private readonly fallback: DBDriver) {
    this.initPromise = this.initialize().catch(err => {
      console.warn('SQLite WASM unavailable, falling back to localStorage driver:', err);
      this.mode = 'fallback';
      this.worker?.terminate();
      this.worker = null;
    });
  }

  onChange(listener: () => void): () => void {
    const unsubscribeFallback = this.fallback.onChange(listener);
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter(l => l !== listener);
      unsubscribeFallback();
    };
  }

  private notifyListeners(): void {
    this.changeListeners.forEach(l => {
      try { l(); } catch (e) { console.error(e); }
    });
  }

  private call(op: 'init' | 'query' | 'exec' | 'batch', payload: Partial<{ sql: string; params: any[]; statements: SqlStatement[]; ddl: string[] }>): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('SQLite worker not running'));
        return;
      }
      const id = this.nextId++;
      this.pending.set(id, {
        resolve: (r: WorkerResponse) => (r.ok ? resolve(r) : reject(new Error(r.error || 'SQLite worker error'))),
      });
      this.worker.postMessage({ id, op, ...payload });
    });
  }

  private async rawQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    const res = await this.call('query', { sql, params });
    return (res.rows || []) as T[];
  }

  private async rawExec(sql: string, params: any[] = []): Promise<void> {
    await this.call('exec', { sql, params });
  }

  private async rawBatch(statements: SqlStatement[]): Promise<void> {
    if (statements.length === 0) return;
    await this.call('batch', { statements });
  }

  private async initialize(): Promise<void> {
    if (typeof Worker === 'undefined' || typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
      throw new Error('OPFS not supported');
    }
    this.worker = new Worker(new URL('./sqlite.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const entry = this.pending.get(event.data.id);
      if (entry) {
        this.pending.delete(event.data.id);
        entry.resolve(event.data);
      }
    };
    this.worker.onerror = (event) => {
      console.error('SQLite worker error:', event.message);
    };

    // Init with a watchdog so a wedged worker cannot hang the whole app.
    await Promise.race([
      this.call('init', { ddl: buildDdlStatements() }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SQLite worker init timed out')), 20000)),
    ]);

    await this.ensureColumns();
    await this.migrateFromLocalStorage();
  }

  // Add any columns that TABLE_COLUMNS defines but an older on-disk DB lacks
  // (mirrors the ensure-column pattern the Tauri Rust side uses).
  private async ensureColumns(): Promise<void> {
    for (const [table, columns] of Object.entries(TABLE_COLUMNS)) {
      const info = await this.rawQuery<{ name: string }>(`PRAGMA table_info(${table})`);
      const existing = new Set(info.map(c => c.name));
      for (const col of columns) {
        if (!existing.has(col)) {
          await this.rawExec(`ALTER TABLE ${table} ADD COLUMN ${col}`);
        }
      }
    }
  }

  // One-time import of the previous localStorage-based store so existing web
  // users keep their offline data (including unsynced dirty rows). The
  // localStorage copy is left in place as a rollback safety net.
  private async migrateFromLocalStorage(): Promise<void> {
    const marker = await this.rawQuery<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?', [MIGRATED_KEY],
    );
    if (marker.length > 0) return;

    const statements: SqlStatement[] = [];

    for (const table of SYNC_TABLES) {
      const raw = localStorage.getItem(`fn_${table}`);
      if (!raw) continue;
      let rows: any[];
      try { rows = JSON.parse(raw); } catch { continue; }
      if (!Array.isArray(rows)) continue;
      const columns = TABLE_COLUMNS[table];
      const placeholders = columns.map(() => '?').join(', ');
      for (const row of rows) {
        statements.push({
          sql: `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          params: columns.map(col => {
            const v = row[col];
            if (v === undefined) return col === 'is_dirty' || col === 'is_deleted' ? 0 : null;
            return v;
          }),
        });
      }
    }

    const rawSettings = localStorage.getItem('fn_settings');
    if (rawSettings) {
      try {
        const settings = JSON.parse(rawSettings);
        for (const [k, v] of Object.entries(settings)) {
          if (k === 'user_id') continue;
          const key = k === 'is_dirty' ? 'settings_is_dirty' : k === 'last_modified' ? 'settings_last_modified' : k;
          const valStr = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
          statements.push({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', params: [key, valStr] });
        }
      } catch { /* unreadable settings are not worth failing migration over */ }
    }

    const lastSync = localStorage.getItem('fn_last_sync_timestamp');
    if (lastSync) {
      statements.push({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', params: ['last_sync_timestamp', lastSync] });
    }

    statements.push({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', params: [MIGRATED_KEY, new Date().toISOString()] });
    await this.rawBatch(statements);
  }

  private async useSqlite(): Promise<boolean> {
    await this.initPromise;
    return this.mode === 'sqlite';
  }

  async query<T>(sql: string, params: any[] = []): Promise<T[]> {
    if (!(await this.useSqlite())) return this.fallback.query<T>(sql, params);

    const normalized = sql.toLowerCase().trim();
    if (normalized === 'select * from settings') {
      const rows = await this.rawQuery<{ key: string; value: unknown }>('SELECT * FROM settings');
      return [settingsFromKeyValueRows(rows)] as T[];
    }

    const rows = await this.rawQuery<T>(sql, params);

    // Guests with an empty store still get sensible plate/barbell/measurement
    // defaults (virtual rows, never persisted — matches the old mock driver).
    if (rows.length === 0 && !normalized.includes('where')) {
      if (normalized.startsWith('select * from plates')) return virtualDefaultPlates() as T[];
      if (normalized.startsWith('select * from barbells')) return virtualDefaultBarbells() as T[];
      if (normalized.startsWith('select * from measurements') && !normalized.startsWith('select * from measurement_records')) {
        return virtualDefaultMeasurements() as T[];
      }
    }
    return rows;
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!(await this.useSqlite())) return this.fallback.execute(sql, params);

    const shorthand = buildShorthandStatements(sql, params);
    if (shorthand) {
      await this.rawBatch(shorthand);
    } else {
      await this.rawExec(sql, params);
    }
    this.notifyListeners();
  }

  async sync(apiToken: string, apiBaseUrl: string): Promise<number | null> {
    if (!(await this.useSqlite())) return this.fallback.sync(apiToken, apiBaseUrl);
    if (!apiToken) return 0;

    const lastSyncRows = await this.rawQuery<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'last_sync_timestamp'",
    );
    const rawLastSync = lastSyncRows[0]?.value;
    const lastSync = rawLastSync && !Number.isNaN(Date.parse(rawLastSync))
      ? new Date(Date.parse(rawLastSync)).toISOString()
      : new Date(0).toISOString();

    // Collect dirty rows per table, remembering which ids we pushed so we only
    // clear those dirty flags afterwards (edits made mid-sync stay dirty).
    const pushedIds: Record<string, string[]> = {};
    const payload: Record<string, any> = { last_sync_timestamp: lastSync };

    for (const table of SYNC_TABLES) {
      const dirty = (await this.rawQuery<any>(`SELECT * FROM ${table} WHERE is_dirty = 1`))
        .filter(row => !isBuiltInSeedRow(table, row));
      pushedIds[table] = dirty.map(row => String(row.id));
      const bools = BOOL_COLUMNS[table] || [];
      payload[table] = dirty.map(row => {
        const normalized = normalizeForSync(row, UUID_FIELDS[table]);
        for (const col of bools) normalized[col] = !!normalized[col];
        return normalized;
      });
    }

    // Settings singleton; push only when locally modified.
    const settingsRows = await this.rawQuery<{ key: string; value: unknown }>('SELECT * FROM settings');
    const localSettings = settingsFromKeyValueRows(settingsRows);
    const settingsDirty = Number(localSettings.is_dirty) === 1;
    payload.settings = settingsDirty
      ? (() => {
          const normalized: Record<string, unknown> = { ...localSettings };
          delete normalized.is_dirty;
          normalized.last_modified = normalizeTimestamp(normalized.last_modified);
          return normalized;
        })()
      : null;

    const res = await fetch(`${apiBaseUrl}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) throw new AuthExpiredError();
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(body || 'Sync failed on server');
    }

    const serverData = await res.json();
    let pulledCount = 0;
    const statements: SqlStatement[] = [];

    for (const table of SYNC_TABLES) {
      // 1. Clear dirty flags for the rows we successfully pushed.
      for (const id of pushedIds[table]) {
        statements.push({ sql: `UPDATE ${table} SET is_dirty = 0 WHERE id = ?`, params: [id] });
      }
      // 2. Upsert server rows (pull).
      const serverRows: any[] = serverData[table] || [];
      pulledCount += serverRows.length;
      const columns = TABLE_COLUMNS[table];
      const placeholders = columns.map(() => '?').join(', ');
      for (const row of serverRows) {
        statements.push({
          sql: `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          params: columns.map(col => {
            if (col === 'is_dirty') return 0;
            const v = row[col];
            return v === undefined ? null : v;
          }),
        });
      }
    }

    // Settings singleton: clear the pushed dirty flag, then apply the server
    // copy (last-write-wins) if one came back.
    if (settingsDirty) {
      statements.push({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', params: ['settings_is_dirty', '0'] });
    }
    if (serverData.settings) {
      pulledCount += 1;
      for (const [k, v] of Object.entries(serverData.settings)) {
        if (k === 'user_id') continue;
        const key = k === 'last_modified' ? 'settings_last_modified' : k;
        const valStr = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
        statements.push({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', params: [key, valStr] });
      }
      statements.push({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', params: ['settings_is_dirty', '0'] });
    }

    statements.push({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', params: ['last_sync_timestamp', serverData.server_time] });
    await this.rawBatch(statements);

    console.log('Synchronization complete at server time:', serverData.server_time);
    return pulledCount;
  }

  async invalidateCache(preserveDirty: boolean): Promise<void> {
    if (!(await this.useSqlite())) return this.fallback.invalidateCache(preserveDirty);

    const statements: SqlStatement[] = [
      { sql: "DELETE FROM settings WHERE key = 'last_sync_timestamp'", params: [] },
    ];

    for (const table of SYNC_TABLES) {
      if (preserveDirty) {
        statements.push({ sql: `DELETE FROM ${table} WHERE is_dirty != 1`, params: [] });
      } else {
        statements.push({ sql: `DELETE FROM ${table}`, params: [] });
      }
    }
    await this.rawBatch(statements);

    if (preserveDirty) {
      // Built-in guest seed rows are never pushed, so drop them even if dirty.
      const cleanup: SqlStatement[] = [];
      for (const table of SYNC_TABLES) {
        const rows = await this.rawQuery<{ id: string }>(`SELECT id FROM ${table}`);
        for (const row of rows) {
          if (isBuiltInSeedRow(table, row)) {
            cleanup.push({ sql: `DELETE FROM ${table} WHERE id = ?`, params: [row.id] });
          }
        }
      }
      await this.rawBatch(cleanup);

      // Keep settings only when locally dirty (mirrors the old driver).
      const dirtyRow = await this.rawQuery<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'settings_is_dirty'",
      );
      if (Number(dirtyRow[0]?.value) !== 1) {
        await this.rawExec(`DELETE FROM settings WHERE key NOT IN ('${MIGRATED_KEY}')`);
      }
    } else {
      await this.rawExec(`DELETE FROM settings WHERE key NOT IN ('${MIGRATED_KEY}')`);
    }
  }
}
