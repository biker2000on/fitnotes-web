import { describe, expect, it, vi } from 'vitest';
import {
  persistRoutineSuperset,
  addRoutineSection,
  switchRoutineSectionExercise,
  addRoutineSectionExercise,
  deleteRoutineSectionExercise,
  deleteRoutineGraph,
  reorderRoutineSectionExercises,
  reorderRoutineSections,
  updateRoutineSectionExerciseRecord,
  updateRoutineSectionExerciseSetRecord,
  validateRoutineSectionExerciseAddition,
} from './useRoutinesSlice';
import type { DBDriver } from '../../storage/shared';
import type {
  Exercise, Routine, RoutineSection, RoutineSectionExercise, RoutineSectionExerciseSet,
  WorkoutGroup, WorkoutGroupExercise,
} from '../../types';

const routineExercise = (overrides: Partial<RoutineSectionExercise>): RoutineSectionExercise => ({
  id: 'rse-1', routine_section_id: 'section-1', exercise_id: 'exercise-old', sort_order: 1,
  populate_sets_type: 1, progression_enabled: true, progression_increment: 2.5, progression_reps_step: 2,
  ...overrides,
});

type TestDriver = Pick<DBDriver, 'query' | 'execute' | 'executeBatch'> & {
  execute: ReturnType<typeof vi.fn>;
  executeBatch?: ReturnType<typeof vi.fn>;
};

const driverWith = ({
  sectionExercises,
  groupLinks = [],
  exercises = [{ id: 'exercise-new', is_deleted: false } as Exercise],
  execute = vi.fn(async () => undefined),
  executeBatch,
}: {
  sectionExercises: RoutineSectionExercise[];
  groupLinks?: WorkoutGroupExercise[];
  exercises?: Exercise[];
  execute?: ReturnType<typeof vi.fn>;
  executeBatch?: ReturnType<typeof vi.fn>;
}): TestDriver => {
  const query: DBDriver['query'] = async <T>(sql: string): Promise<T[]> => {
    if (sql.includes('routine_section_exercises')) return sectionExercises as T[];
    if (sql.includes('workout_group_exercises')) return groupLinks as T[];
    if (sql.includes('exercises')) return exercises as T[];
    return [];
  };
  return {
    query,
    execute,
    ...(executeBatch ? { executeBatch } : {}),
  };
};

const statefulDriverWith = ({
  sectionExercises,
  sets = [],
  groupLinks = [],
  groups = [],
  sections = [],
  routines = [],
  exercises = [{ id: 'exercise-new', is_deleted: false } as Exercise],
}: {
  sectionExercises: RoutineSectionExercise[];
  sets?: RoutineSectionExerciseSet[];
  groupLinks?: WorkoutGroupExercise[];
  groups?: WorkoutGroup[];
  sections?: RoutineSection[];
  routines?: Routine[];
  exercises?: Exercise[];
}) => {
  const tables: Record<string, Array<{ id: string }>> = {
    routine_section_exercise_sets: sets,
    routine_section_exercises: sectionExercises,
    workout_group_exercises: groupLinks,
    workout_groups: groups,
    routine_sections: sections,
    routines,
    exercises,
  };
  const tableFor = (sql: string) => Object.keys(tables).find(table => new RegExp(`\\b${table}\\b`).test(sql));
  const apply = async (sql: string, params: unknown[] = []) => {
    const tableName = tableFor(sql);
    if (!tableName) return;
    const table = tables[tableName];
    if (/^DELETE\b/i.test(sql)) {
      const id = params[0];
      const index = table.findIndex(row => row.id === id);
      if (index >= 0) table.splice(index, 1);
      return;
    }
    const row = params[0] as { id: string };
    const index = table.findIndex(item => item.id === row.id);
    if (/^UPDATE\b/i.test(sql)) {
      if (index >= 0) table[index] = { ...table[index], ...row };
      return;
    }
    if (/^INSERT\b/i.test(sql)) {
      if (index >= 0) table[index] = { ...table[index], ...row };
      else table.push({ ...row });
    }
  };
  const query: DBDriver['query'] = async <T>(sql: string): Promise<T[]> => {
    const tableName = tableFor(sql);
    return (tableName ? tables[tableName] : []) as T[];
  };
  const execute = vi.fn(apply);
  const executeBatch = vi.fn(async operations => {
    for (const operation of operations) await apply(operation.sql, operation.params || []);
  });
  return {
    driver: { query, execute, executeBatch } as TestDriver,
    state: { sectionExercises, sets, groupLinks, groups, sections, routines },
  };
};

describe('routine editor superset persistence', () => {
  it('resolves selected RSE ids to real exercise ids before creating links', async () => {
    const driver = driverWith({
      sectionExercises: [
        routineExercise({ id: 'rse-a', exercise_id: 'exercise-a' }),
        routineExercise({ id: 'rse-b', exercise_id: 'exercise-b', sort_order: 2 }),
      ],
    });
    const ids = ['group-1', 'link-1', 'link-2'];

    const result = await persistRoutineSuperset(driver, {
      sectionId: 'section-1', routineSectionExerciseIds: ['rse-a', 'rse-b'], name: 'Pair', colour: 123, makeId: () => ids.shift()!,
    });

    expect(result).toEqual({ ok: true });
    expect(driver.execute).toHaveBeenNthCalledWith(1, 'INSERT INTO workout_groups', [expect.objectContaining({ id: 'group-1', name: 'Pair' })]);
    expect(driver.execute).toHaveBeenNthCalledWith(2, 'INSERT INTO workout_group_exercises', [expect.objectContaining({ exercise_id: 'exercise-a', workout_group_id: 'group-1' })]);
    expect(driver.execute).toHaveBeenNthCalledWith(3, 'INSERT INTO workout_group_exercises', [expect.objectContaining({ exercise_id: 'exercise-b', workout_group_id: 'group-1' })]);
  });

  it('rejects duplicate real exercises instead of creating ambiguous links', async () => {
    const driver = driverWith({
      sectionExercises: [routineExercise({ id: 'rse-a' }), routineExercise({ id: 'rse-b', sort_order: 2 })],
    });

    const result = await persistRoutineSuperset(driver, {
      sectionId: 'section-1', routineSectionExerciseIds: ['rse-a', 'rse-b'], name: 'Pair', colour: 123, makeId: () => 'unused',
    });

    expect(result).toMatchObject({ ok: false });
    expect(driver.execute).not.toHaveBeenCalled();
  });

  it('serializes concurrent submissions and atomically batches the winning create', async () => {
    const { driver } = statefulDriverWith({
      sectionExercises: [
        routineExercise({ id: 'rse-a', exercise_id: 'exercise-a' }),
        routineExercise({ id: 'rse-b', exercise_id: 'exercise-b', sort_order: 2 }),
      ],
    });
    const ids = ['group-1', 'link-1', 'link-2'];

    const [first, second] = await Promise.all([
      persistRoutineSuperset(driver, { sectionId: 'section-1', routineSectionExerciseIds: ['rse-a', 'rse-b'], name: 'Pair', colour: 123, makeId: () => ids.shift()! }),
      persistRoutineSuperset(driver, { sectionId: 'section-1', routineSectionExerciseIds: ['rse-a', 'rse-b'], name: 'Pair', colour: 123, makeId: () => 'duplicate' }),
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toMatchObject({ ok: false, message: expect.stringMatching(/already.*superset/i) });
    expect(driver.executeBatch).toHaveBeenCalledTimes(1);
    expect(driver.execute).not.toHaveBeenCalled();
  });

  it('reports rollback failure after a fallback write fails mid-create', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('link write failed'))
      .mockRejectedValueOnce(new Error('group rollback failed'));
    const driver = driverWith({
      sectionExercises: [
        routineExercise({ id: 'rse-a', exercise_id: 'exercise-a' }),
        routineExercise({ id: 'rse-b', exercise_id: 'exercise-b', sort_order: 2 }),
      ],
      execute,
    });

    await expect(persistRoutineSuperset(driver, {
      sectionId: 'section-1', routineSectionExerciseIds: ['rse-a', 'rse-b'], name: 'Pair', colour: 123, makeId: (() => {
        const ids = ['group-1', 'link-1', 'link-2']; return () => ids.shift()!;
      })(),
    })).rejects.toThrow(/may be inconsistent/i);
  });
});

describe('switchRoutineSectionExercise', () => {
  it('updates only the target RSE and its routine-section superset links', async () => {
    const target = routineExercise({ id: 'rse-a' });
    const untouched = routineExercise({ id: 'rse-b', exercise_id: 'exercise-other', sort_order: 2 });
    const link: WorkoutGroupExercise = {
      id: 'link-1', exercise_id: 'exercise-old', date: '', routine_section_id: 'section-1', workout_group_id: 'group-1',
    };
    const otherSectionLink: WorkoutGroupExercise = {
      id: 'link-2', exercise_id: 'exercise-old', date: '', routine_section_id: 'section-2', workout_group_id: 'group-2',
    };
    const driver = driverWith({ sectionExercises: [target, untouched], groupLinks: [link, otherSectionLink] });

    const result = await switchRoutineSectionExercise(driver, {
      routineSectionExerciseId: 'rse-a', sectionId: 'section-1', nextExerciseId: 'exercise-new',
    });

    expect(result).toEqual({ ok: true });
    expect(driver.execute).toHaveBeenNthCalledWith(1, 'UPDATE routine_section_exercises', [expect.objectContaining({
      id: 'rse-a', exercise_id: 'exercise-new', progression_enabled: true, progression_increment: 2.5, progression_reps_step: 2,
    })]);
    expect(driver.execute).toHaveBeenNthCalledWith(2, 'UPDATE workout_group_exercises', [expect.objectContaining({ id: 'link-1', exercise_id: 'exercise-new' })]);
    expect(driver.execute).toHaveBeenCalledTimes(2);
  });

  it('refuses a replacement that already exists in the same workout day', async () => {
    const driver = driverWith({
      sectionExercises: [routineExercise({ id: 'rse-a' }), routineExercise({ id: 'rse-b', exercise_id: 'exercise-new', sort_order: 2 })],
    });

    const result = await switchRoutineSectionExercise(driver, {
      routineSectionExerciseId: 'rse-a', sectionId: 'section-1', nextExerciseId: 'exercise-new',
    });

    expect(result).toMatchObject({ ok: false });
    expect(driver.execute).not.toHaveBeenCalled();
  });

  it('refuses a deleted or missing replacement exercise from a stale picker', async () => {
    const driver = driverWith({
      sectionExercises: [routineExercise({ id: 'rse-a' })],
      exercises: [{ id: 'exercise-new', is_deleted: true } as Exercise],
    });

    const result = await switchRoutineSectionExercise(driver, {
      routineSectionExerciseId: 'rse-a', sectionId: 'section-1', nextExerciseId: 'exercise-new',
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/no longer available/i) });
    expect(driver.execute).not.toHaveBeenCalled();
  });

  it('revalidates the target row after acquiring the cooperative section lock', async () => {
    let sectionReadCount = 0;
    const active = routineExercise({ id: 'rse-a' });
    const driver = {
      query: async <T>(sql: string): Promise<T[]> => {
        if (sql.includes('routine_section_exercises')) {
          sectionReadCount += 1;
          return (sectionReadCount === 1 ? [active] : [{ ...active, is_deleted: true }]) as T[];
        }
        if (sql.includes('exercises')) return [{ id: 'exercise-new', is_deleted: false } as Exercise] as T[];
        return [];
      },
      execute: vi.fn(async () => undefined),
    } as TestDriver;

    const result = await switchRoutineSectionExercise(driver, {
      routineSectionExerciseId: 'rse-a', sectionId: 'section-1', nextExerciseId: 'exercise-new',
    });

    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/changed|removed/i) });
    expect(driver.execute).not.toHaveBeenCalled();
  });

  it('reports inconsistent-state risk when fallback switch rollback also fails', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('link write failed'))
      .mockRejectedValueOnce(new Error('link rollback failed'))
      .mockResolvedValueOnce(undefined);
    const driver = driverWith({
      sectionExercises: [routineExercise({ id: 'rse-a' })],
      groupLinks: [{ id: 'link-1', exercise_id: 'exercise-old', date: '', routine_section_id: 'section-1', workout_group_id: 'group-1' }],
      execute,
    });

    await expect(switchRoutineSectionExercise(driver, {
      routineSectionExerciseId: 'rse-a', sectionId: 'section-1', nextExerciseId: 'exercise-new',
    })).rejects.toThrow(/may be inconsistent/i);
  });
});

describe('validateRoutineSectionExerciseAddition', () => {
  it('prevents a normal add from creating a duplicate in the same workout day', () => {
    const result = validateRoutineSectionExerciseAddition(
      [routineExercise({ id: 'rse-a', exercise_id: 'exercise-a' })],
      'section-1',
      'exercise-a',
    );

    expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/already/i) });
  });
});

describe('addRoutineSectionExercise', () => {
  it('serializes concurrent adds for the same workout day', async () => {
    const { driver } = statefulDriverWith({ sectionExercises: [routineExercise({ id: 'rse-a', exercise_id: 'exercise-a' })] });

    const [first, second] = await Promise.all([
      addRoutineSectionExercise(driver, { sectionId: 'section-1', exerciseId: 'exercise-new', makeId: () => 'rse-new' }),
      addRoutineSectionExercise(driver, { sectionId: 'section-1', exerciseId: 'exercise-new', makeId: () => 'rse-duplicate' }),
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toMatchObject({ ok: false, message: expect.stringMatching(/already/i) });
    expect(driver.execute).toHaveBeenCalledTimes(1);
  });

  it('does not interleave an add with a switch in the same workout day', async () => {
    const { driver } = statefulDriverWith({ sectionExercises: [routineExercise({ id: 'rse-a', exercise_id: 'exercise-a' })] });

    const [add, switchResult] = await Promise.all([
      addRoutineSectionExercise(driver, { sectionId: 'section-1', exerciseId: 'exercise-new', makeId: () => 'rse-new' }),
      switchRoutineSectionExercise(driver, { routineSectionExerciseId: 'rse-a', sectionId: 'section-1', nextExerciseId: 'exercise-new' }),
    ]);

    expect(add).toEqual({ ok: true });
    expect(switchResult).toMatchObject({ ok: false, message: expect.stringMatching(/already/i) });
    expect(driver.execute).toHaveBeenCalledTimes(1);
  });
});

describe('section mutation contention', () => {
  it('does not interleave delete and switch for the same routine exercise', async () => {
    const { driver } = statefulDriverWith({ sectionExercises: [routineExercise({ id: 'rse-a', exercise_id: 'exercise-old' })] });

    const [deleteResult, switchResult] = await Promise.all([
      deleteRoutineSectionExercise(driver, 'rse-a', 'section-1'),
      switchRoutineSectionExercise(driver, { routineSectionExerciseId: 'rse-a', sectionId: 'section-1', nextExerciseId: 'exercise-new' }),
    ]);

    expect(deleteResult).toEqual({ ok: true });
    expect(switchResult).toMatchObject({ ok: false, message: expect.stringMatching(/no longer available/i) });
    expect(driver.executeBatch).toHaveBeenCalledTimes(1);
  });

  it('preserves a queued metadata update when a switch follows it', async () => {
    const { driver, state } = statefulDriverWith({ sectionExercises: [routineExercise({ id: 'rse-a', exercise_id: 'exercise-old' })] });

    const [metadataResult, switchResult] = await Promise.all([
      updateRoutineSectionExerciseRecord(driver, {
        routineSectionExerciseId: 'rse-a', sectionId: 'section-1', values: { progression_increment: 5 },
      }),
      switchRoutineSectionExercise(driver, { routineSectionExerciseId: 'rse-a', sectionId: 'section-1', nextExerciseId: 'exercise-new' }),
    ]);

    expect(metadataResult).toEqual({ ok: true });
    expect(switchResult).toEqual({ ok: true });
    expect(state.sectionExercises[0]).toMatchObject({ id: 'rse-a', exercise_id: 'exercise-new', progression_increment: 5 });
  });

  it('applies rapid metadata updates in arrival order without dropping the final value', async () => {
    const { driver, state } = statefulDriverWith({ sectionExercises: [routineExercise({ id: 'rse-a' })] });

    const results = await Promise.all([3, 4, 5].map(progression_increment =>
      updateRoutineSectionExerciseRecord(driver, {
        routineSectionExerciseId: 'rse-a', sectionId: 'section-1', values: { progression_increment },
      }),
    ));

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(state.sectionExercises[0].progression_increment).toBe(5);
    expect(driver.execute).toHaveBeenCalledTimes(3);
  });

  it('keeps a newer metadata update behind an earlier delayed lookup', async () => {
    const { driver, state } = statefulDriverWith({ sectionExercises: [routineExercise({ id: 'rse-a' })] });
    const originalQuery = driver.query;
    let sectionReads = 0;
    let markStarted!: () => void;
    let releaseFirst!: () => void;
    const firstStarted = new Promise<void>(resolve => { markStarted = resolve; });
    const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
    driver.query = async <T>(sql: string, params?: unknown[]): Promise<T[]> => {
      if (sql.includes('routine_section_exercises') && sectionReads++ === 0) {
        markStarted();
        await firstGate;
      }
      return originalQuery<T>(sql, params);
    };

    const first = updateRoutineSectionExerciseRecord(driver, {
      routineSectionExerciseId: 'rse-a', sectionId: 'section-1', values: { progression_increment: 3 },
    });
    await firstStarted;
    const second = updateRoutineSectionExerciseRecord(driver, {
      routineSectionExerciseId: 'rse-a', sectionId: 'section-1', values: { progression_increment: 9 },
    });
    await Promise.resolve();

    expect(sectionReads).toBe(1);
    releaseFirst();
    expect(await Promise.all([first, second])).toEqual([{ ok: true }, { ok: true }]);
    expect(state.sectionExercises[0].progression_increment).toBe(9);
  });

  it('applies rapid predefined-set updates in arrival order without dropping the final value', async () => {
    const set: RoutineSectionExerciseSet = {
      id: 'set-1', routine_section_exercise_id: 'rse-a', metric_weight: 50, reps: 5, sort_order: 1,
      distance: null, duration_seconds: null, unit: null, notes: 'first',
    };
    const { driver, state } = statefulDriverWith({ sectionExercises: [routineExercise({ id: 'rse-a' })], sets: [set] });

    const results = await Promise.all(['second', 'third', 'final'].map(notes =>
      updateRoutineSectionExerciseSetRecord(driver, { setId: 'set-1', sectionId: 'section-1', values: { notes } }),
    ));

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(state.sets[0].notes).toBe('final');
    expect(driver.execute).toHaveBeenCalledTimes(3);
  });

  it('preserves fresh sort order when exercise reorder and switch contend', async () => {
    const { driver, state } = statefulDriverWith({
      sectionExercises: [
        routineExercise({ id: 'rse-a', exercise_id: 'exercise-old', sort_order: 1 }),
        routineExercise({ id: 'rse-b', exercise_id: 'exercise-b', sort_order: 2 }),
      ],
    });

    const [reorderResult, switchResult] = await Promise.all([
      reorderRoutineSectionExercises(driver, { sectionId: 'section-1', orderedIds: ['rse-b', 'rse-a'] }),
      switchRoutineSectionExercise(driver, { routineSectionExerciseId: 'rse-a', sectionId: 'section-1', nextExerciseId: 'exercise-new' }),
    ]);

    expect(reorderResult).toEqual({ ok: true });
    expect(switchResult).toEqual({ ok: true });
    expect(state.sectionExercises.find(item => item.id === 'rse-a')).toMatchObject({ exercise_id: 'exercise-new', sort_order: 2 });
    expect(state.sectionExercises.find(item => item.id === 'rse-b')).toMatchObject({ sort_order: 1 });
  });

  it('prevents a queued switch from reviving an exercise after routine deletion', async () => {
    const { driver, state } = statefulDriverWith({
      routines: [{ id: 'routine-1', name: 'Routine' }],
      sections: [{ id: 'section-1', routine_id: 'routine-1', name: 'Day', sort_order: 1 }],
      sectionExercises: [routineExercise({ id: 'rse-a', exercise_id: 'exercise-old' })],
    });

    const [deleteResult, switchResult] = await Promise.all([
      deleteRoutineGraph(driver, 'routine-1'),
      switchRoutineSectionExercise(driver, { routineSectionExerciseId: 'rse-a', sectionId: 'section-1', nextExerciseId: 'exercise-new' }),
    ]);

    expect(deleteResult).toEqual({ ok: true });
    expect(switchResult).toMatchObject({ ok: false, message: expect.stringMatching(/no longer available/i) });
    expect(state.routines[0].is_deleted).toBe(true);
    expect(state.sections[0].is_deleted).toBe(true);
    expect(state.sectionExercises[0].is_deleted).toBe(true);
  });

  it('does not allow a workout day added after deletion starts to survive as an orphan', async () => {
    const { driver, state } = statefulDriverWith({
      routines: [{ id: 'routine-1', name: 'Routine' }],
      sections: [{ id: 'section-1', routine_id: 'routine-1', name: 'Day 1', sort_order: 1 }],
      sectionExercises: [],
    });
    const newSection: RoutineSection = { id: 'section-2', routine_id: 'routine-1', name: 'Day 2', sort_order: 0 };

    const [deleteResult, addResult] = await Promise.all([
      deleteRoutineGraph(driver, 'routine-1'),
      addRoutineSection(driver, newSection),
    ]);

    expect(deleteResult).toEqual({ ok: true });
    expect(addResult).toMatchObject({ ok: false, message: expect.stringMatching(/no longer available/i) });
    expect(state.sections.filter(section => !section.is_deleted)).toEqual([]);
  });

  it('includes a concurrently added workout day in the subsequent fresh reorder', async () => {
    const { driver, state } = statefulDriverWith({
      routines: [{ id: 'routine-1', name: 'Routine' }],
      sections: [{ id: 'section-1', routine_id: 'routine-1', name: 'Day 1', sort_order: 1 }],
      sectionExercises: [],
    });
    const newSection: RoutineSection = { id: 'section-2', routine_id: 'routine-1', name: 'Day 2', sort_order: 0 };

    const [addResult, reorderResult] = await Promise.all([
      addRoutineSection(driver, newSection),
      reorderRoutineSections(driver, { routineId: 'routine-1', orderedIds: ['section-1'] }),
    ]);

    expect(addResult).toEqual({ ok: true });
    expect(reorderResult).toEqual({ ok: true });
    expect(state.sections.find(section => section.id === 'section-1')?.sort_order).toBe(1);
    expect(state.sections.find(section => section.id === 'section-2')?.sort_order).toBe(2);
  });
});
