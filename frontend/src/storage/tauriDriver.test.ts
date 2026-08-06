import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));

import { TauriNativeDriver } from './db';

describe('TauriNativeDriver.executeBatch', () => {
  it('sends expanded shorthand statements to the native transactional command', async () => {
    const driver = new TauriNativeDriver();
    const listener = vi.fn();
    driver.onChange(listener);

    await driver.executeBatch!([
      { sql: 'INSERT INTO workout_groups', params: [{ id: 'group-1', name: 'Pair' }] },
      { sql: 'INSERT INTO workout_group_exercises', params: [{ id: 'link-1', exercise_id: 'exercise-1', workout_group_id: 'group-1' }] },
    ]);

    expect(mocks.invoke).toHaveBeenCalledWith('tauri_execute_batch', {
      statements: [
        expect.objectContaining({ sql: expect.stringMatching(/^INSERT INTO workout_groups .* ON CONFLICT\(id\) DO UPDATE SET /) }),
        expect.objectContaining({ sql: expect.stringMatching(/^INSERT INTO workout_group_exercises .* ON CONFLICT\(id\) DO UPDATE SET /) }),
      ],
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('TauriNativeDriver.query boolean normalization', () => {
  it('returns SQLite 0/1 boolean columns as real booleans', async () => {
    // A raw 0 reaching JSX renders as a literal "0" beside the value it
    // guards - the "10 lbs x 6 reps0" bug in the exercise history pane.
    mocks.invoke.mockResolvedValueOnce([
      { id: 'log-1', reps: 6, is_personal_record: 0, is_complete: 1, is_deleted: 0, is_dirty: 1 },
    ] as any);

    const driver = new TauriNativeDriver();
    const [row] = await driver.query<any>('SELECT * FROM training_logs');

    expect(row.is_personal_record).toBe(false);
    expect(row.is_complete).toBe(true);
    expect(row.is_deleted).toBe(false);
    expect(row.reps).toBe(6);
    // is_dirty is a local-only sync marker compared against 1; it stays numeric.
    expect(row.is_dirty).toBe(1);
  });
});
