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
