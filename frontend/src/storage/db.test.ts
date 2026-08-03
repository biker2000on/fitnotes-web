import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserLocalDriver } from './db';

const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

const installStorage = (failForKey?: string, failOnce = false) => {
  const values = new Map<string, string>();
  let hasFailed = false;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === failForKey && (!failOnce || !hasFailed)) {
        hasFailed = true;
        throw new Error(`write failed for ${key}`);
      }
      values.set(key, value);
    },
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: () => null,
    get length() { return values.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  return storage;
};

afterEach(() => {
  if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('BrowserLocalDriver.executeBatch', () => {
  it('commits related writes together and sends one change notification', async () => {
    const storage = installStorage();
    const driver = new BrowserLocalDriver();
    const listener = vi.fn();
    driver.onChange(listener);

    await driver.executeBatch!([
      { sql: 'INSERT INTO workout_groups', params: [{ id: 'group-1' }] },
      { sql: 'INSERT INTO workout_group_exercises', params: [{ id: 'link-1', workout_group_id: 'group-1' }] },
    ]);

    expect(JSON.parse(storage.getItem('fn_workout_groups')!)).toEqual([expect.objectContaining({ id: 'group-1' })]);
    expect(JSON.parse(storage.getItem('fn_workout_group_exercises')!)).toEqual([expect.objectContaining({ id: 'link-1' })]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('restores the snapshot when any batch write fails', async () => {
    const storage = installStorage('fn_workout_group_exercises');
    const driver = new BrowserLocalDriver();

    await expect(driver.executeBatch!([
      { sql: 'INSERT INTO workout_groups', params: [{ id: 'group-1' }] },
      { sql: 'INSERT INTO workout_group_exercises', params: [{ id: 'link-1', workout_group_id: 'group-1' }] },
    ])).rejects.toThrow(/write failed/i);

    expect(storage.getItem('fn_workout_groups')).toBeNull();
    expect(storage.getItem('fn_workout_group_exercises')).toBeNull();
  });

  it('queues overlapping batches so a failed rollback cannot erase a later commit', async () => {
    const storage = installStorage('fn_workout_group_exercises', true);
    const driver = new BrowserLocalDriver();
    const listener = vi.fn();
    driver.onChange(listener);

    const failed = driver.executeBatch!([
      { sql: 'INSERT INTO workout_groups', params: [{ id: 'group-failed' }] },
      { sql: 'INSERT INTO workout_group_exercises', params: [{ id: 'link-failed' }] },
    ]);
    const succeeding = driver.executeBatch!([
      { sql: 'INSERT INTO workout_groups', params: [{ id: 'group-committed' }] },
    ]);

    await expect(failed).rejects.toThrow(/write failed/i);
    await succeeding;

    expect(JSON.parse(storage.getItem('fn_workout_groups')!)).toEqual([expect.objectContaining({ id: 'group-committed' })]);
    expect(storage.getItem('fn_workout_group_exercises')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('BrowserLocalDriver.sync mid-request edits', () => {
  // The payload snapshot is taken before the fetch and applied after it. An
  // edit landing in that window used to be marked clean without ever being
  // pushed, and then overwritten by the server's echo of the old value.
  const syncWith = async (storage: ReturnType<typeof installStorage>, onFetch: () => void) => {
    const driver = new BrowserLocalDriver();
    vi.stubGlobal('fetch', vi.fn(async () => {
      onFetch();
      return {
        ok: true,
        status: 200,
        json: async () => ({
          server_time: '2026-08-03T10:00:00.000Z',
          training_logs: [{ id: 'log-1', reps: 5, last_modified: 'T1', is_deleted: false }],
        }),
      } as any;
    }));
    await driver.sync('token', 'https://example.invalid');
    return JSON.parse(storage.getItem('fn_training_logs')!);
  };

  afterEach(() => vi.unstubAllGlobals());

  it('keeps a row edited during the request dirty and unclobbered', async () => {
    const storage = installStorage();
    storage.setItem('fn_training_logs', JSON.stringify([
      { id: 'log-1', reps: 5, last_modified: 'T1', is_dirty: 1, is_deleted: false },
    ]));

    const rows = await syncWith(storage, () => {
      // User logs a correction while the request is in flight.
      storage.setItem('fn_training_logs', JSON.stringify([
        { id: 'log-1', reps: 8, last_modified: 'T2', is_dirty: 1, is_deleted: false },
      ]));
    });

    expect(rows[0].reps).toBe(8);
    expect(rows[0].is_dirty).toBe(1);
  });

  it('still cleans and applies the server copy for an untouched pushed row', async () => {
    const storage = installStorage();
    storage.setItem('fn_training_logs', JSON.stringify([
      { id: 'log-1', reps: 3, last_modified: 'T1', is_dirty: 1, is_deleted: false },
    ]));

    const rows = await syncWith(storage, () => {});

    expect(rows[0].reps).toBe(5);
    expect(rows[0].is_dirty).toBe(0);
  });
});

describe('BrowserLocalDriver UPDATE semantics', () => {
  it('does not upsert a missing row', async () => {
    const storage = installStorage();
    const driver = new BrowserLocalDriver();

    await driver.execute('UPDATE routine_section_exercises', [{
      id: 'missing-rse', routine_section_id: 'section-1', exercise_id: 'exercise-new', sort_order: 1,
    }]);

    expect(storage.getItem('fn_routine_section_exercises')).toBeNull();
  });
});
