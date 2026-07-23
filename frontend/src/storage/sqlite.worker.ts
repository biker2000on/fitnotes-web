/// <reference lib="webworker" />
// sqlite.worker.ts - Dedicated worker hosting the SQLite WASM database.
// OPFS SyncAccessHandles are worker-only, so all SQL runs here; the main
// thread talks to us through a tiny {id, op} message protocol.
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

interface WorkerRequest {
  id: number;
  op: 'init' | 'query' | 'exec' | 'batch';
  sql?: string;
  params?: any[];
  statements?: Array<{ sql: string; params?: any[] }>;
  ddl?: string[];
}

let db: any = null;

// SQLite WASM cannot bind undefined/boolean; coerce to null/0/1 (matching how
// rusqlite stores the same values on mobile).
const coerceParam = (p: any) => {
  if (p === undefined) return null;
  if (typeof p === 'boolean') return p ? 1 : 0;
  return p;
};

const bindFor = (params?: any[]) => (params && params.length ? params.map(coerceParam) : undefined);

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, op, sql, params, statements, ddl } = event.data;
  try {
    if (op === 'init') {
      const sqlite3 = await (sqlite3InitModule as any)({
        print: () => {},
        printErr: (msg: string) => console.error('[sqlite-wasm]', msg),
      });
      // OPFS SAHPool VFS: persistent, no COOP/COEP headers required. It takes
      // exclusive access handles, so a second tab falls back to localStorage
      // mode (the driver handles that).
      const poolUtil = await sqlite3.installOpfsSAHPoolVfs({ name: 'fitnotes' });
      db = new poolUtil.OpfsSAHPoolDb('/fitnotes.db');
      for (const stmt of ddl || []) db.exec(stmt);
      (self as any).postMessage({ id, ok: true });
      return;
    }

    if (!db) throw new Error('SQLite worker not initialized');

    if (op === 'query') {
      const rows: any[] = [];
      db.exec({ sql, bind: bindFor(params), rowMode: 'object', resultRows: rows });
      (self as any).postMessage({ id, ok: true, rows });
      return;
    }

    if (op === 'exec') {
      db.exec({ sql, bind: bindFor(params) });
      (self as any).postMessage({ id, ok: true });
      return;
    }

    if (op === 'batch') {
      db.exec('BEGIN');
      try {
        for (const s of statements || []) {
          db.exec({ sql: s.sql, bind: bindFor(s.params) });
        }
        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch { /* already rolled back */ }
        throw err;
      }
      (self as any).postMessage({ id, ok: true });
      return;
    }

    throw new Error(`Unknown op: ${op}`);
  } catch (err: any) {
    (self as any).postMessage({ id, ok: false, error: String(err?.message ?? err) });
  }
};
