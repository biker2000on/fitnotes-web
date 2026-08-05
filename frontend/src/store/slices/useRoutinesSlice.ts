// Routines slice: routine templates (CRUD, copy/versioning), the routine
// editor (days, exercises, template sets), routine supersets, and loading /
// populating routines into the workout log. Code moved verbatim from
// FitNotesStore.tsx.
import { useState, useEffect, type Dispatch, type SetStateAction, type MutableRefObject } from 'react';
import { db } from '../../storage/db';
import type { DBDriver, DBOperation } from '../../storage/shared';
import { uuidv4 } from '../../lib/uuid';
import { getLocalDateString } from '../../lib/date';
import { hexToSignedArgb } from '../../lib/colors';
import { bySortOrder, type TabId } from './shared';
import type {
  Exercise, TrainingLog, Routine, RoutineSection, RoutineSectionExercise,
  RoutineSectionExerciseSet, WorkoutGroup, WorkoutGroupExercise,
} from '../../types';
import { POPULATE_SETS_TYPE } from '../../types';
import type { LateDeps, TriggerToast, TriggerConfirm } from './types';

export interface RoutinesSliceDeps {
  late: LateDeps;
  triggerToast: TriggerToast;
  triggerConfirm: TriggerConfirm;
  activeTab: TabId;
  setActiveTab: Dispatch<SetStateAction<TabId>>;
  selectedDate: string;
  selectedDateRef: MutableRefObject<string>;
  userUnit: 'kg' | 'lbs';
  exercises: Exercise[];
  allLogs: TrainingLog[];
  workoutGroups: WorkoutGroup[];
  supersetName: string;
  supersetColor: string;
  getHighest1RM: (exerciseId: string, beforeDate?: string) => number;
  recordWorkoutRoutine: (routineId: string, sectionId: string | null, date?: string) => Promise<void>;
}

type RoutineEditorDriver = Pick<DBDriver, 'query' | 'execute' | 'executeBatch'>;

export type RoutineEditorOperationResult = { ok: true } | { ok: false; message: string };

const routineSectionMutationQueues = new Map<string, Promise<void>>();
const routineMutationQueues = new Map<string, Promise<void>>();
let routineMutationEnqueueTail: Promise<void> = Promise.resolve();

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

// The promise queue preserves mutation arrival order within this tab. Web
// Locks additionally coordinate tabs that share the same backing store.
async function withRoutineSectionMutation<T>(sectionId: string, work: () => Promise<T>): Promise<T> {
  const previousTail = routineSectionMutationQueues.get(sectionId) ?? Promise.resolve();
  const run = previousTail.catch(() => undefined).then(async () => {
    const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
    return locks
      ? locks.request(`fitnotes:routine-section:${sectionId}`, { mode: 'exclusive' }, work)
      : work();
  });
  const tail = run.then(() => undefined, () => undefined);
  routineSectionMutationQueues.set(sectionId, tail);
  try {
    return await run;
  } finally {
    // Only the current tail may clean up; an older completion must never erase
    // a newer queued mutation.
    if (routineSectionMutationQueues.get(sectionId) === tail) {
      routineSectionMutationQueues.delete(sectionId);
    }
  }
}

async function withRoutineMutation<T>(routineId: string, work: () => Promise<T>): Promise<T> {
  const previousTail = routineMutationQueues.get(routineId) ?? Promise.resolve();
  const run = previousTail.catch(() => undefined).then(async () => {
    const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
    return locks
      ? locks.request(`fitnotes:routine:${routineId}`, { mode: 'exclusive' }, work)
      : work();
  });
  const tail = run.then(() => undefined, () => undefined);
  routineMutationQueues.set(routineId, tail);
  try {
    return await run;
  } finally {
    if (routineMutationQueues.get(routineId) === tail) routineMutationQueues.delete(routineId);
  }
}

// Resolve the section and append to its queue in invocation order. Holding the
// short global enqueue chain only through lookup prevents query latency from
// allowing a later controlled-input update to overtake an earlier one.
async function withResolvedRoutineSectionMutation<T>(
  resolveSectionId: () => Promise<string | null> | string | null,
  work: (sectionId: string) => Promise<T>,
  missing: () => T,
): Promise<T> {
  const previousTail = routineMutationEnqueueTail;
  const prepared = previousTail.catch(() => undefined).then(async () => {
    const sectionId = await resolveSectionId();
    return {
      run: sectionId == null
        ? Promise.resolve(missing())
        : withRoutineSectionMutation(sectionId, () => work(sectionId)),
    };
  });
  routineMutationEnqueueTail = prepared.then(() => undefined, () => undefined);
  return (await prepared).run;
}

const withOrderedRoutineSectionMutation = <T>(sectionId: string, work: () => Promise<T>): Promise<T> =>
  withResolvedRoutineSectionMutation(() => sectionId, work, () => {
    throw new Error('Routine section is no longer available.');
  });

// Routine-wide destructive/reorder work keeps the enqueue gate until it has
// finished, so no later section mutation can overtake it while it discovers
// and locks the routine's current section set.
async function withRoutineWideMutationInInvocationOrder<T>(work: () => Promise<T>): Promise<T> {
  const previousTail = routineMutationEnqueueTail;
  const run = previousTail.catch(() => undefined).then(work);
  routineMutationEnqueueTail = run.then(() => undefined, () => undefined);
  return run;
}

async function withRoutineSectionsMutation<T>(sectionIds: string[], work: () => Promise<T>): Promise<T> {
  const ordered = [...new Set(sectionIds)].sort();
  const acquire = (index: number): Promise<T> => (
    index >= ordered.length
      ? work()
      : withRoutineSectionMutation(ordered[index], () => acquire(index + 1))
  );
  return acquire(0);
}

export function validateRoutineSectionExerciseAddition(
  sectionExercises: RoutineSectionExercise[],
  sectionId: string,
  exerciseId: string,
): RoutineEditorOperationResult {
  return sectionExercises.some(item => !item.is_deleted && item.routine_section_id === sectionId && item.exercise_id === exerciseId)
    ? { ok: false, message: 'That exercise is already in this workout day.' }
    : { ok: true };
}

export async function addRoutineSectionExercise(
  driver: RoutineEditorDriver,
  { sectionId, exerciseId, makeId }: { sectionId: string; exerciseId: string; makeId: () => string },
): Promise<RoutineEditorOperationResult> {
  return withOrderedRoutineSectionMutation(sectionId, async () => {
    const existing = await driver.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
    const validation = validateRoutineSectionExerciseAddition(existing, sectionId, exerciseId);
    if (!validation.ok) return validation;

    const newRse: RoutineSectionExercise = {
      id: makeId(),
      routine_section_id: sectionId,
      exercise_id: exerciseId,
      sort_order: existing.filter(item => !item.is_deleted && item.routine_section_id === sectionId).length + 1,
      populate_sets_type: POPULATE_SETS_TYPE.PREDEFINED_SETS,
      progression_enabled: false,
      progression_increment: null,
      progression_reps_step: 1,
    };
    await driver.execute('INSERT INTO routine_section_exercises', [newRse]);
    return { ok: true };
  }) as Promise<RoutineEditorOperationResult>;
}

export async function updateRoutineSectionExerciseRecord(
  driver: RoutineEditorDriver,
  { routineSectionExerciseId, sectionId, values }: { routineSectionExerciseId: string; sectionId: string; values: Partial<RoutineSectionExercise> },
): Promise<RoutineEditorOperationResult> {
  return withOrderedRoutineSectionMutation(sectionId, async () => {
    const currentRows = await driver.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
    const target = currentRows.find(item => item.id === routineSectionExerciseId && !item.is_deleted);
    if (!target) return { ok: false, message: 'This routine exercise is no longer available.' };
    await driver.execute('UPDATE routine_section_exercises', [{ ...target, ...values, id: target.id, routine_section_id: target.routine_section_id }]);
    return { ok: true };
  }) as Promise<RoutineEditorOperationResult>;
}

export async function updateRoutineSectionExerciseSetRecord(
  driver: RoutineEditorDriver,
  { setId, sectionId, values }: { setId: string; sectionId: string; values: Partial<RoutineSectionExerciseSet> },
): Promise<RoutineEditorOperationResult> {
  return withOrderedRoutineSectionMutation(sectionId, async () => {
    const currentSets = await driver.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets');
    const target = currentSets.find(item => item.id === setId && !item.is_deleted);
    if (!target) return { ok: false, message: 'This predefined set is no longer available.' };
    await driver.execute('UPDATE routine_section_exercise_sets', [{
      ...target, ...values, id: target.id, routine_section_exercise_id: target.routine_section_exercise_id,
    }]);
    return { ok: true };
  }) as Promise<RoutineEditorOperationResult>;
}

export async function deleteRoutineSectionExercise(
  driver: RoutineEditorDriver,
  routineSectionExerciseId: string,
  sectionId: string,
): Promise<RoutineEditorOperationResult> {
  return withOrderedRoutineSectionMutation(sectionId, async () => {
    const sectionExercises = await driver.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
    const target = sectionExercises.find(item => item.id === routineSectionExerciseId && !item.is_deleted);
    if (!target) return { ok: false, message: 'This routine exercise is no longer available.' };

    const sets = (await driver.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets'))
      .filter(item => item.routine_section_exercise_id === target.id && !item.is_deleted);
    const hasSameExerciseSibling = sectionExercises.some(item =>
      item.id !== target.id && !item.is_deleted &&
      item.routine_section_id === target.routine_section_id && item.exercise_id === target.exercise_id,
    );
    const links = hasSameExerciseSibling ? [] : (await driver.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises'))
      .filter(item => !item.is_deleted && item.routine_section_id === target.routine_section_id && item.exercise_id === target.exercise_id);

    const pairs: Array<{ write: DBOperation; rollback: DBOperation }> = [
      ...links.map(item => ({
        write: { sql: 'DELETE FROM workout_group_exercises WHERE id = ?', params: [item.id] },
        rollback: { sql: 'INSERT INTO workout_group_exercises', params: [item] },
      })),
      ...sets.map(item => ({
        write: { sql: 'DELETE FROM routine_section_exercise_sets WHERE id = ?', params: [item.id] },
        rollback: { sql: 'INSERT INTO routine_section_exercise_sets', params: [item] },
      })),
      {
        write: { sql: 'DELETE FROM routine_section_exercises WHERE id = ?', params: [target.id] },
        rollback: { sql: 'INSERT INTO routine_section_exercises', params: [target] },
      },
    ];
    await executeAtomicallyOrRollback(
      driver,
      pairs.map(pair => pair.write),
      completedCount => pairs.slice(0, completedCount).reverse().map(pair => pair.rollback),
      'Deleting the routine exercise',
    );
    return { ok: true };
  }) as Promise<RoutineEditorOperationResult>;
}

export async function reorderRoutineSectionExercises(
  driver: RoutineEditorDriver,
  { sectionId, orderedIds }: { sectionId: string; orderedIds: string[] },
): Promise<RoutineEditorOperationResult> {
  return withOrderedRoutineSectionMutation(sectionId, async () => {
    const currentRows = (await driver.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises'))
      .filter(item => item.routine_section_id === sectionId && !item.is_deleted);
    const currentById = new Map(currentRows.map(item => [item.id, item]));
    if (orderedIds.some(id => !currentById.has(id))) {
      return { ok: false, message: 'The exercise order changed before it could be saved.' };
    }
    const listed = orderedIds.map(id => currentById.get(id)!);
    const unlisted = currentRows.filter(item => !orderedIds.includes(item.id)).sort(bySortOrder);
    const operations = [...listed, ...unlisted].map((item, index) => ({
      sql: 'UPDATE routine_section_exercises', params: [{ ...item, sort_order: index + 1 }],
    }));
    if (driver.executeBatch) await driver.executeBatch(operations);
    else for (const operation of operations) await driver.execute(operation.sql, operation.params);
    return { ok: true };
  });
}

export async function deleteRoutineGraph(
  driver: RoutineEditorDriver,
  routineId: string,
): Promise<RoutineEditorOperationResult> {
  return withRoutineWideMutationInInvocationOrder(() => withRoutineMutation(routineId, async () => {
    const sections = (await driver.query<RoutineSection>('SELECT * FROM routine_sections'))
      .filter(item => item.routine_id === routineId && !item.is_deleted);
    return withRoutineSectionsMutation(sections.map(item => item.id), async () => {
      const routines = await driver.query<Routine>('SELECT * FROM routines');
      const routine = routines.find(item => item.id === routineId && !item.is_deleted);
      if (!routine) return { ok: false, message: 'This routine is no longer available.' };

      const currentSections = (await driver.query<RoutineSection>('SELECT * FROM routine_sections'))
        .filter(item => item.routine_id === routineId && !item.is_deleted);
      const sectionIds = new Set(currentSections.map(item => item.id));
      const sectionExercises = (await driver.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises'))
        .filter(item => sectionIds.has(item.routine_section_id) && !item.is_deleted);
      const sectionExerciseIds = new Set(sectionExercises.map(item => item.id));
      const sets = (await driver.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets'))
        .filter(item => sectionExerciseIds.has(item.routine_section_exercise_id) && !item.is_deleted);
      const groups = (await driver.query<WorkoutGroup>('SELECT * FROM workout_groups'))
        .filter(item => item.routine_section_id != null && sectionIds.has(item.routine_section_id) && !item.is_deleted);
      const groupIds = new Set(groups.map(item => item.id));
      const links = (await driver.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises'))
        .filter(item => !item.is_deleted && (
          groupIds.has(item.workout_group_id) || (item.routine_section_id != null && sectionIds.has(item.routine_section_id))
        ));
      const operations: DBOperation[] = [
        ...links.map(item => ({ sql: 'UPDATE workout_group_exercises', params: [{ ...item, is_deleted: true }] })),
        ...groups.map(item => ({ sql: 'UPDATE workout_groups', params: [{ ...item, is_deleted: true }] })),
        ...sets.map(item => ({ sql: 'UPDATE routine_section_exercise_sets', params: [{ ...item, is_deleted: true }] })),
        ...sectionExercises.map(item => ({ sql: 'UPDATE routine_section_exercises', params: [{ ...item, is_deleted: true }] })),
        ...currentSections.map(item => ({ sql: 'UPDATE routine_sections', params: [{ ...item, is_deleted: true }] })),
        { sql: 'UPDATE routines', params: [{ ...routine, is_deleted: true }] },
      ];
      if (driver.executeBatch) await driver.executeBatch(operations);
      else for (const operation of operations) await driver.execute(operation.sql, operation.params || []);
      return { ok: true };
    });
  }));
}

export async function reorderRoutineSections(
  driver: RoutineEditorDriver,
  { routineId, orderedIds }: { routineId: string; orderedIds: string[] },
): Promise<RoutineEditorOperationResult> {
  return withRoutineWideMutationInInvocationOrder(() => withRoutineMutation(routineId, async () => {
    const currentSections = (await driver.query<RoutineSection>('SELECT * FROM routine_sections'))
      .filter(item => item.routine_id === routineId && !item.is_deleted);
    return withRoutineSectionsMutation(currentSections.map(item => item.id), async () => {
      const lockedSections = (await driver.query<RoutineSection>('SELECT * FROM routine_sections'))
        .filter(item => item.routine_id === routineId && !item.is_deleted);
      const currentById = new Map(lockedSections.map(item => [item.id, item]));
      if (orderedIds.some(id => !currentById.has(id))) {
        return { ok: false, message: 'The workout-day order changed before it could be saved.' };
      }
      const listed = orderedIds.map(id => currentById.get(id)!);
      const unlisted = lockedSections.filter(item => !orderedIds.includes(item.id)).sort(bySortOrder);
      const operations = [...listed, ...unlisted].map((item, index) => ({
        sql: 'UPDATE routine_sections', params: [{ ...item, sort_order: index + 1 }],
      }));
      if (driver.executeBatch) await driver.executeBatch(operations);
      else for (const operation of operations) await driver.execute(operation.sql, operation.params);
      return { ok: true };
    });
  }));
}

export async function addRoutineSection(
  driver: RoutineEditorDriver,
  section: RoutineSection,
): Promise<RoutineEditorOperationResult> {
  return withRoutineWideMutationInInvocationOrder(() => withRoutineMutation(section.routine_id, async () => {
    const routines = await driver.query<Routine>('SELECT * FROM routines');
    if (!routines.some(item => item.id === section.routine_id && !item.is_deleted)) {
      return { ok: false, message: 'This routine is no longer available.' };
    }
    const currentSections = (await driver.query<RoutineSection>('SELECT * FROM routine_sections'))
      .filter(item => item.routine_id === section.routine_id && !item.is_deleted);
    await driver.execute('INSERT INTO routine_sections', [{ ...section, sort_order: currentSections.length + 1 }]);
    return { ok: true };
  }));
}

async function executeAtomicallyOrRollback(
  driver: RoutineEditorDriver,
  operations: DBOperation[],
  rollback: (completedCount: number) => DBOperation[],
  label: string,
): Promise<void> {
  if (driver.executeBatch) {
    await driver.executeBatch(operations);
    return;
  }

  let completedCount = 0;
  try {
    for (const operation of operations) {
      await driver.execute(operation.sql, operation.params || []);
      completedCount += 1;
    }
  } catch (writeError) {
    const rollbackResults = await Promise.allSettled(rollback(completedCount).map(operation =>
      driver.execute(operation.sql, operation.params || []),
    ));
    const rollbackFailures = rollbackResults.filter(result => result.status === 'rejected');
    const rollbackDetail = rollbackFailures.length
      ? ` Rollback also failed for ${rollbackFailures.length} operation(s); routine data may be inconsistent. Refresh before retrying.`
      : ' Completed writes were rolled back.';
    throw new Error(`${label} failed: ${errorMessage(writeError)}.${rollbackDetail}`);
  }
}

// Superset links are stored against real exercise IDs, while the editor selects
// routine-section-exercise (RSE) rows. Keep that translation in the store so
// callers cannot accidentally mix the two identities.
export async function persistRoutineSuperset(
  driver: RoutineEditorDriver,
  { sectionId, routineSectionExerciseIds, name, colour, makeId }: {
    sectionId: string;
    routineSectionExerciseIds: string[];
    name: string;
    colour: number;
    makeId: () => string;
  },
): Promise<RoutineEditorOperationResult> {
  return withOrderedRoutineSectionMutation(sectionId, async () => {
    return await persistRoutineSupersetUnlocked(driver, { sectionId, routineSectionExerciseIds, name, colour, makeId });
  }) as Promise<RoutineEditorOperationResult>;
}

async function persistRoutineSupersetUnlocked(
  driver: RoutineEditorDriver,
  { sectionId, routineSectionExerciseIds, name, colour, makeId }: {
    sectionId: string;
    routineSectionExerciseIds: string[];
    name: string;
    colour: number;
    makeId: () => string;
  },
): Promise<RoutineEditorOperationResult> {
  const selectedIds = [...new Set(routineSectionExerciseIds)];
  if (selectedIds.length < 2) return { ok: false, message: 'Please select at least 2 exercises to create a superset.' };

  const sectionExercises = await driver.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
  const selected = selectedIds.map(id => sectionExercises.find(item => item.id === id));
  if (selected.some(item => !item || item.is_deleted || item.routine_section_id !== sectionId)) {
    return { ok: false, message: 'The selected exercises are no longer available in this workout day.' };
  }

  const exerciseIds = selected.map(item => item!.exercise_id);
  if (new Set(exerciseIds).size !== exerciseIds.length) {
    return { ok: false, message: 'A workout day cannot link duplicate copies of the same exercise into one superset.' };
  }

  const existingLinks = await driver.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises');
  if (existingLinks.some(link => !link.is_deleted && link.routine_section_id === sectionId && exerciseIds.includes(link.exercise_id))) {
    return { ok: false, message: 'One or more selected exercises already belong to a superset in this workout day. Unlink it first.' };
  }

  const groupId = makeId();
  const group: WorkoutGroup = {
    id: groupId,
    name: name.trim() || 'Superset',
    date: '',
    routine_section_id: sectionId,
    colour,
    auto_jump_enabled: true,
    rest_timer_auto_start_enabled: false,
  };
  const links: WorkoutGroupExercise[] = exerciseIds.map(exerciseId => ({
    id: makeId(), exercise_id: exerciseId, date: '', routine_section_id: sectionId, workout_group_id: groupId,
  }));

  const operations: DBOperation[] = [
    { sql: 'INSERT INTO workout_groups', params: [group] },
    ...links.map(link => ({ sql: 'INSERT INTO workout_group_exercises', params: [link] })),
  ];
  await executeAtomicallyOrRollback(
    driver,
    operations,
    completedCount => [
      ...links.slice(0, Math.max(0, completedCount - 1)).map(link => ({ sql: 'DELETE FROM workout_group_exercises WHERE id = ?', params: [link.id] })),
      ...(completedCount > 0 ? [{ sql: 'DELETE FROM workout_groups WHERE id = ?', params: [groupId] }] : []),
    ],
    'Creating the routine superset',
  );
  return { ok: true };
}

export async function switchRoutineSectionExercise(
  driver: RoutineEditorDriver,
  { routineSectionExerciseId, sectionId, nextExerciseId }: { routineSectionExerciseId: string; sectionId: string; nextExerciseId: string },
): Promise<RoutineEditorOperationResult> {
  return withOrderedRoutineSectionMutation(sectionId, async () => {
    // Re-read under the cross-tab lock: another context may have changed this
    // row while the picker was open or while this request waited for the lock.
    const sectionExercises = await driver.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
    const target = sectionExercises.find(item => item.id === routineSectionExerciseId && !item.is_deleted);
    if (!target) return { ok: false, message: 'This routine exercise is no longer available.' };
    return switchRoutineSectionExerciseLocked(driver, target, nextExerciseId, sectionExercises);
  }) as Promise<RoutineEditorOperationResult>;
}

async function switchRoutineSectionExerciseLocked(
  driver: RoutineEditorDriver,
  target: RoutineSectionExercise,
  nextExerciseId: string,
  sectionExercises: RoutineSectionExercise[],
): Promise<RoutineEditorOperationResult> {
  if (target.exercise_id === nextExerciseId) return { ok: false, message: 'That exercise is already selected.' };

  // The picker is rendered from in-memory state and can become stale while it
  // is open. Re-check the source of truth immediately before any write.
  const currentExercises = await driver.query<Exercise>('SELECT * FROM exercises');
  if (!currentExercises.some(exercise => exercise.id === nextExerciseId && !exercise.is_deleted)) {
    return { ok: false, message: 'That replacement exercise is no longer available.' };
  }

  const sameSection = sectionExercises.filter(item => !item.is_deleted && item.routine_section_id === target.routine_section_id);
  if (sameSection.some(item => item.id !== target.id && item.exercise_id === nextExerciseId)) {
    return { ok: false, message: 'That exercise is already in this workout day. Remove the duplicate before switching.' };
  }
  if (sameSection.filter(item => item.exercise_id === target.exercise_id).length > 1) {
    return { ok: false, message: 'This exercise appears more than once in this workout day, so its superset links are ambiguous. Remove duplicates before switching.' };
  }

  const links = await driver.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises');
  const linksToMove = links.filter(link =>
    !link.is_deleted &&
    link.routine_section_id === target.routine_section_id &&
    link.exercise_id === target.exercise_id,
  );
  if (links.some(link =>
    !link.is_deleted &&
    link.routine_section_id === target.routine_section_id &&
    link.exercise_id === nextExerciseId &&
    !linksToMove.some(moving => moving.id === link.id),
  )) {
    return { ok: false, message: 'The replacement exercise already belongs to a superset in this workout day.' };
  }
  if (linksToMove.some(link => links.some(other =>
    !other.is_deleted &&
    other.id !== link.id &&
    other.routine_section_id === target.routine_section_id &&
    other.workout_group_id === link.workout_group_id &&
    other.exercise_id === nextExerciseId,
  ))) {
    return { ok: false, message: 'The replacement exercise is already linked to this superset. Resolve the duplicate first.' };
  }

  // Last responsible re-read before the atomic batch. BrowserLocal now treats
  // a missing UPDATE target as a zero-row no-op, so this guard prevents link
  // rewrites when a cooperating delete won the section lock first.
  const latestRows = await driver.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
  const latestTarget = latestRows.find(item => item.id === target.id && !item.is_deleted);
  if (!latestTarget || latestTarget.routine_section_id !== target.routine_section_id || latestTarget.exercise_id !== target.exercise_id) {
    return { ok: false, message: 'This routine exercise changed or was removed before the switch could be saved.' };
  }

  const operations: DBOperation[] = [
    { sql: 'UPDATE routine_section_exercises', params: [{ ...latestTarget, exercise_id: nextExerciseId }] },
    ...linksToMove.map(link => ({ sql: 'UPDATE workout_group_exercises', params: [{ ...link, exercise_id: nextExerciseId }] })),
  ];
  await executeAtomicallyOrRollback(
    driver,
    operations,
    completedCount => [
      ...linksToMove.slice(0, Math.max(0, completedCount - 1)).map(link => ({
        sql: 'UPDATE workout_group_exercises', params: [link],
      })),
      ...(completedCount > 0 ? [{ sql: 'UPDATE routine_section_exercises', params: [latestTarget] }] : []),
    ],
    'Switching the routine exercise',
  );
  return { ok: true };
}

export function useRoutinesSlice(deps: RoutinesSliceDeps) {
  const {
    late, triggerToast, triggerConfirm, activeTab, setActiveTab,
    selectedDate, selectedDateRef, userUnit, exercises, allLogs,
    workoutGroups, supersetName, supersetColor, getHighest1RM, recordWorkoutRoutine,
  } = deps;

  // Routine Editor modular states
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [editorSections, setEditorSections] = useState<RoutineSection[]>([]);
  const [editorSectionExercises, setEditorSectionExercises] = useState<RoutineSectionExercise[]>([]);
  const [editorExerciseSets, setEditorExerciseSets] = useState<RoutineSectionExerciseSet[]>([]);

  // Routines State
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showRoutineImportModal, setShowRoutineImportModal] = useState(false);
  const [showCreateRoutineModal, setShowCreateRoutineModal] = useState(false);
  const [showAddExToSectionModal, setShowAddExToSectionModal] = useState(false);
  const [isAddingExerciseToSection, setIsAddingExerciseToSection] = useState(false);
  const [isSwitchingRoutineSectionExercise, setIsSwitchingRoutineSectionExercise] = useState(false);
  const [isCreatingRoutineSuperset, setIsCreatingRoutineSuperset] = useState(false);
  const [editorExercisePickerMode, setEditorExercisePickerMode] = useState<'add' | 'switch'>('add');
  const [editorSwitchTargetSectionExerciseId, setEditorSwitchTargetSectionExerciseId] = useState<string | null>(null);
  const [editorExSearchQuery, setEditorExSearchQuery] = useState('');
  const [editorExSelectedCategory, setEditorExSelectedCategory] = useState<string | null>(null);
  const [selectedSectionExerciseIdsForSuperset, setSelectedSectionExerciseIdsForSuperset] = useState<string[]>([]);
  const [pastLoggedDates, setPastLoggedDates] = useState<string[]>([]);

  // Routine templates creation states
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineNotes, setNewRoutineNotes] = useState('');
  const [newRoutineCategory, setNewRoutineCategory] = useState('');

  const [activeRoutineForPopulate, setActiveRoutineForPopulate] = useState<Routine | null>(null);
  const [activeSectionForPopulate, setActiveSectionForPopulate] = useState<RoutineSection | null>(null);

  const [editorAddExerciseTargetSectionId, setEditorAddExerciseTargetSectionId] = useState<string | null>(null);

  const [showPastImporterModal, setShowPastImporterModal] = useState(false);
  const [pastImporterTargetSectionId, setPastImporterTargetSectionId] = useState<string | null>(null);
  const [pastImporterDate, setPastImporterDate] = useState('');

  // Start Routine with Populators
  const copyRoutineSectionSupersetsToWorkout = async (sectionId: string, sectionExerciseIds: string[]) => {
    await withOrderedRoutineSectionMutation(sectionId, async () => {
    const groups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
    const links = await db.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises');
    const templateGroups = groups.filter(g => g.routine_section_id === sectionId && !g.is_deleted);
    const importedExerciseIds = new Set(sectionExerciseIds);

    const operations: DBOperation[] = [];
    for (const templateGroup of templateGroups) {
      const templateLinks = links.filter(link =>
        link.workout_group_id === templateGroup.id &&
        link.routine_section_id === sectionId &&
        importedExerciseIds.has(link.exercise_id) &&
        !link.is_deleted
      );

      if (templateLinks.length < 2) continue;

      const newGroupId = uuidv4();
      const newGroup: WorkoutGroup = {
        id: newGroupId,
        name: templateGroup.name || 'Superset',
        date: selectedDate,
        routine_section_id: null,
        colour: templateGroup.colour,
        auto_jump_enabled: templateGroup.auto_jump_enabled,
        rest_timer_auto_start_enabled: templateGroup.rest_timer_auto_start_enabled
      };
      operations.push({ sql: 'INSERT INTO workout_groups', params: [newGroup] });

      for (const templateLink of templateLinks) {
        const newLink: WorkoutGroupExercise = {
          id: uuidv4(),
          exercise_id: templateLink.exercise_id,
          date: selectedDate,
          routine_section_id: null,
          workout_group_id: newGroupId
        };
        operations.push({ sql: 'INSERT INTO workout_group_exercises', params: [newLink] });
      }
    }
    if (db.executeBatch) await db.executeBatch(operations);
    else for (const operation of operations) await db.execute(operation.sql, operation.params || []);
    });
  };

  const importRoutinePopulated = async (
    routineId: string,
    type: 'template' | 'last_workout' | 'one_rep_max',
    percentage: number = 75,
    sectionId?: string
  ) => {
    const targetDate = selectedDateRef.current;
    const defaultUnit = userUnit === 'kg' ? 1 : 2;
    const findLastSessionLogs = (exerciseId: string) => {
      const pastExLogs = allLogs.filter(l =>
        l.exercise_id === exerciseId &&
        !l.is_deleted &&
        l.date < targetDate
      );

      if (pastExLogs.length === 0) return [];

      const uniqueDates = Array.from(new Set(pastExLogs.map(l => l.date)))
        .sort((a, b) => b.localeCompare(a));
      return pastExLogs.filter(l => l.date === uniqueDates[0]);
    };

    const insertLogFromSource = async (
      exerciseId: string,
      source: Pick<TrainingLog | RoutineSectionExerciseSet, 'metric_weight' | 'reps' | 'distance' | 'duration_seconds' | 'unit'>,
      overrides: Partial<TrainingLog> = {}
    ) => {
      const log: TrainingLog = {
        id: uuidv4(),
        exercise_id: exerciseId,
        date: targetDate,
        metric_weight: source.metric_weight,
        reps: source.reps,
        unit: source.unit ?? defaultUnit,
        is_personal_record: false,
        is_complete: false,
        distance: source.distance,
        duration_seconds: source.duration_seconds,
        ...overrides
      };
      await db.execute('INSERT INTO training_logs', [log]);
    };

    const sections = await db.query<RoutineSection>('SELECT * FROM routine_sections');
    const routine = routines.find(r => r.id === routineId);
    const activeWeek = Math.max(1, routine?.current_week ?? 1);
    const routineSecs = sections.filter(s =>
      s.routine_id === routineId && !s.is_deleted &&
      (sectionId ? s.id === sectionId : (s.week_number ?? 1) === activeWeek)
    ).sort(bySortOrder);
    let totalSetsLogged = 0;

    for (const sec of routineSecs) {
      const exList = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
      const secExs = exList.filter(x => x.routine_section_id === sec.id && !x.is_deleted).sort(bySortOrder);
      const importedExerciseIds = secExs.map(se => se.exercise_id);
      let sectionSetsLogged = 0;

      for (const se of secExs) {
        const setList = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets');
        const exSets = setList.filter(x => x.routine_section_exercise_id === se.id && !x.is_deleted).sort(bySortOrder);
        const lastSessionLogs = findLastSessionLogs(se.exercise_id);
        const shouldProgress = Boolean(
          se.progression_enabled && exSets.length > 0 && lastSessionLogs.length > 0 &&
          exSets.every((s, i) => {
            const prior = lastSessionLogs[i] ?? lastSessionLogs[lastSessionLogs.length - 1];
            const repTarget = s.max_reps ?? s.reps;
            return prior?.is_complete && (repTarget == null || (prior.reps ?? 0) >= repTarget) &&
              (s.target_rir == null || (prior.rir ?? -1) >= s.target_rir);
          })
        );

        // One empty set so the exercise still shows up in the workout to log against
        // (matches the reference app's "Log All" placeholder for don't-populate exercises).
        const insertPlaceholderSet = async () => {
          await insertLogFromSource(se.exercise_id, {
            metric_weight: null, reps: null, distance: null, duration_seconds: null, unit: defaultUnit,
          });
          sectionSetsLogged++;
          totalSetsLogged++;
        };

        // Predefined sets: a filled field is used verbatim; a blank field is carried
        // over from the same-position set of the exercise's previous workout.
        const insertPredefinedSets = async () => {
          for (let i = 0; i < exSets.length; i++) {
            const s = exSets[i];
            const inherit = lastSessionLogs[i] ?? lastSessionLogs[lastSessionLogs.length - 1];
            const baseWeight = s.metric_weight ?? inherit?.metric_weight ?? null;
            const baseReps = s.reps ?? s.min_reps ?? inherit?.reps ?? null;
            const progressedWeight = shouldProgress && baseWeight != null
              ? baseWeight + (se.progression_increment ?? exercises.find(ex => ex.id === se.exercise_id)?.weight_increment ?? 2.5)
              : baseWeight;
            const progressedReps = shouldProgress && baseWeight == null && baseReps != null
              ? Math.min(s.max_reps ?? Number.MAX_SAFE_INTEGER, baseReps + (se.progression_reps_step ?? 1))
              : baseReps;
            await insertLogFromSource(se.exercise_id, {
              metric_weight: progressedWeight,
              reps: progressedReps,
              distance: s.distance ?? inherit?.distance ?? null,
              duration_seconds: s.duration_seconds ?? inherit?.duration_seconds ?? null,
              unit: s.unit ?? defaultUnit,
            }, {
              routine_section_exercise_set_id: s.id,
              set_type: s.set_type || 'working',
              rir: s.target_rir ?? null,
            });
            sectionSetsLogged++;
            totalSetsLogged++;
          }
        };

        const insertLastSessionSets = async () => {
          for (const lastLog of lastSessionLogs) {
            await insertLogFromSource(se.exercise_id, lastLog);
            sectionSetsLogged++;
            totalSetsLogged++;
          }
        };

        if (type === 'template') {
          // Honor each exercise's configured populate_sets_type.
          const populateType = se.populate_sets_type ?? POPULATE_SETS_TYPE.PREDEFINED_SETS;
          if (populateType === POPULATE_SETS_TYPE.NONE) {
            await insertPlaceholderSet();
          } else if (populateType === POPULATE_SETS_TYPE.COPY_PREVIOUS_WORKOUT) {
            if (lastSessionLogs.length > 0) await insertLastSessionSets();
            else if (exSets.length > 0) await insertPredefinedSets();
            else await insertPlaceholderSet();
          } else {
            if (exSets.length > 0) await insertPredefinedSets();
            else if (lastSessionLogs.length > 0) await insertLastSessionSets();
            else await insertPlaceholderSet();
          }
        } else if (type === 'last_workout') {
          if (lastSessionLogs.length > 0) {
            for (const lastLog of lastSessionLogs) {
              await insertLogFromSource(se.exercise_id, lastLog);
              sectionSetsLogged++;
              totalSetsLogged++;
            }
          } else {
            for (const s of exSets) {
              await insertLogFromSource(se.exercise_id, s, { routine_section_exercise_set_id: s.id });
              sectionSetsLogged++;
              totalSetsLogged++;
            }
          }
        } else if (type === 'one_rep_max') {
          const highest1RM = getHighest1RM(se.exercise_id, targetDate);

          if (highest1RM > 0) {
            const targetWeight = highest1RM * (percentage / 100);
            const roundedWeight = Math.round(targetWeight / 2.5) * 2.5;
            const usingTemplateSets = exSets.length > 0;
            const sourceSets = usingTemplateSets ? exSets : lastSessionLogs;

            for (const s of sourceSets) {
              await insertLogFromSource(se.exercise_id, s, {
                metric_weight: roundedWeight,
                routine_section_exercise_set_id: usingTemplateSets ? s.id : undefined
              });
              sectionSetsLogged++;
              totalSetsLogged++;
            }
          } else {
            for (const s of exSets) {
              await insertLogFromSource(se.exercise_id, s, { routine_section_exercise_set_id: s.id });
              sectionSetsLogged++;
              totalSetsLogged++;
            }
          }
        }
      }

      if (sectionSetsLogged > 0) {
        await copyRoutineSectionSupersetsToWorkout(sec.id, importedExerciseIds);
        await recordWorkoutRoutine(routineId, sec.id, targetDate);
      }
    }

    setShowRoutineImportModal(false);
    setActiveRoutineForPopulate(null);
    setActiveSectionForPopulate(null);
    await late.refreshData();
    if (totalSetsLogged > 0) {
      triggerToast(`Routine loaded using ${type === 'one_rep_max' ? `${percentage}% 1RM` : type === 'last_workout' ? 'last session' : 'routine set types'}.`);
    } else {
      triggerToast('No routine sets were logged. Add template sets or log this exercise once before using history-based loading.', 'error');
    }
  };

  // A failed populate must never leave the Start Routine modal stranded: close
  // it, reconcile the UI with whatever did get written, and surface the error.
  const handleImportRoutinePopulated = async (
    routineId: string,
    type: 'template' | 'last_workout' | 'one_rep_max',
    percentage: number = 75,
    sectionId?: string
  ) => {
    try {
      await importRoutinePopulated(routineId, type, percentage, sectionId);
    } catch (error) {
      console.error('Failed to load routine into workout:', error);
      setShowRoutineImportModal(false);
      setActiveRoutineForPopulate(null);
      setActiveSectionForPopulate(null);
      await late.refreshData().catch(refreshError => console.error('Failed to reconcile workout data:', refreshError));
      triggerToast(`Couldn't load routine: ${errorMessage(error)}`, 'error');
    }
  };

  const handleCreateRoutineSuperset = async (sectionId: string, routineSectionExerciseIds: string[], name = supersetName) => {
    if (isCreatingRoutineSuperset) return false;
    setIsCreatingRoutineSuperset(true);
    try {
      const result = await persistRoutineSuperset(db, {
        sectionId, routineSectionExerciseIds, name, colour: hexToSignedArgb(supersetColor), makeId: uuidv4,
      });
      if (!result.ok) {
        triggerToast(result.message, 'error');
        return false;
      }
      await late.refreshData();
      if (editingRoutine) await loadEditorData(editingRoutine.id);
      triggerToast('Routine superset created successfully!');
      return true;
    } catch (error) {
      console.error('Failed to create routine superset:', error);
      await late.refreshData().catch(refreshError => console.error('Failed to reconcile routine data:', refreshError));
      if (editingRoutine) await loadEditorData(editingRoutine.id).catch(refreshError => console.error('Failed to reload routine editor:', refreshError));
      triggerToast(errorMessage(error), 'error');
      return false;
    } finally {
      setIsCreatingRoutineSuperset(false);
    }
  };

  const handleUpdateRoutineGroupName = async (groupId: string, name: string) => {
    const group = workoutGroups.find(g => g.id === groupId && !g.is_deleted);
    const next = name.trim();
    if (!group || !next || next === group.name) return;
    try {
      if (group.routine_section_id) {
        await withOrderedRoutineSectionMutation(group.routine_section_id, async () => {
          const currentGroups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
          const current = currentGroups.find(item => item.id === groupId && !item.is_deleted);
          if (current) await db.execute('UPDATE workout_groups', [{ ...current, name: next }]);
        });
      } else {
        await db.execute('UPDATE workout_groups', [{ ...group, name: next }]);
      }
      await late.refreshData();
      if (editingRoutine) await loadEditorData(editingRoutine.id);
      triggerToast('Superset name updated.');
    } catch (error) {
      console.error('Failed to rename routine superset:', error);
      triggerToast('Could not update the superset name. Please try again.', 'error');
    }
  };

  const handleClearRoutineGroup = async (groupId: string) => {
    const groups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
    const targetGroup = groups.find(x => x.id === groupId);
    if (!targetGroup?.routine_section_id) return;
    await withOrderedRoutineSectionMutation(targetGroup.routine_section_id, async () => {
      const currentGroups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
      const currentGroup = currentGroups.find(item => item.id === groupId && !item.is_deleted);
      if (!currentGroup) return;
      const targetLinks = (await db.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises'))
        .filter(item => item.workout_group_id === groupId && !item.is_deleted);
      const pairs: Array<{ write: DBOperation; rollback: DBOperation }> = [
        { write: { sql: 'UPDATE workout_groups', params: [{ ...currentGroup, is_deleted: true }] }, rollback: { sql: 'UPDATE workout_groups', params: [currentGroup] } },
        ...targetLinks.map(link => ({
          write: { sql: 'UPDATE workout_group_exercises', params: [{ ...link, is_deleted: true }] },
          rollback: { sql: 'UPDATE workout_group_exercises', params: [link] },
        })),
      ];
      await executeAtomicallyOrRollback(
        db, pairs.map(pair => pair.write),
        completedCount => pairs.slice(0, completedCount).reverse().map(pair => pair.rollback),
        'Clearing the routine superset',
      );
    });

    await late.refreshData();
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Routine superset cleared.');
  };

  // Create a routine from just a name + notes, then land in the editor to add
  // workout days and exercises — the reference app's flow (fragment_routine_create
  // is only those two fields; structure is built afterwards in the routine view).
  const handleCreateRoutineTemplate = async () => {
    if (!newRoutineName) {
      triggerToast('Please enter a routine template name!', 'error');
      return;
    }

    const newRoutine: Routine = {
      id: uuidv4(),
      name: newRoutineName,
      notes: newRoutineNotes || undefined,
      category: newRoutineCategory.trim() || null,
      version: 1,
      program_weeks: 1,
      current_week: 1,
      is_archived: false,
    };
    await db.execute('INSERT INTO routines', [newRoutine]);

    // Start with one empty day so the editor opens ready for exercises.
    const newSection: RoutineSection = {
      id: uuidv4(),
      routine_id: newRoutine.id,
      name: 'Day 1',
      sort_order: 1,
      week_number: 1,
    };
    await db.execute('INSERT INTO routine_sections', [newSection]);

    setNewRoutineName('');
    setNewRoutineNotes('');
    setNewRoutineCategory('');
    setShowCreateRoutineModal(false);
    await late.refreshData();
    setEditingRoutine(newRoutine);
    setActiveTab('routine-editor');
    triggerToast('Routine created — add workout days and exercises.');
  };

  // Set or clear a routine's grouping category (empty string clears it).
  const handleUpdateRoutineCategory = async (routineId: string, category: string) => {
    const target = routines.find(r => r.id === routineId);
    if (!target) return;
    const trimmed = category.trim();
    if ((target.category ?? '') === trimmed) return;
    const updated: Routine = { ...target, category: trimmed || null };
    await db.execute('UPDATE routines', [updated]);
    if (editingRoutine?.id === routineId) setEditingRoutine(updated);
    await late.refreshData();
  };

  // Update the routine metadata shown at the top of the template editor.
  // Keeping editingRoutine in sync prevents the header from reverting to the
  // previous value while the local database refreshes and syncs upstream.
  const handleUpdateRoutineDetails = async (
    routineId: string,
    details: Partial<Pick<Routine, 'name' | 'notes' | 'version' | 'program_weeks' | 'current_week' | 'start_date' | 'is_archived'>>,
  ) => {
    const target = editingRoutine?.id === routineId
      ? editingRoutine
      : routines.find(r => r.id === routineId);
    if (!target) return;

    const name = details.name !== undefined ? details.name.trim() : target.name;
    if (!name) {
      triggerToast('Routine name cannot be empty.', 'error');
      return;
    }

    const notes = details.notes !== undefined ? details.notes.trim() : target.notes;
    const updated: Routine = {
      ...target, ...details, name, notes: notes || undefined,
      version: Math.max(1, details.version ?? target.version ?? 1),
      program_weeks: Math.max(1, details.program_weeks ?? target.program_weeks ?? 1),
      current_week: Math.min(
        Math.max(1, details.current_week ?? target.current_week ?? 1),
        Math.max(1, details.program_weeks ?? target.program_weeks ?? 1),
      ),
    };

    await db.execute('UPDATE routines', [updated]);
    setEditingRoutine(updated);
    setRoutines(current => current.map(r => r.id === routineId ? updated : r));
    await late.refreshData();
    triggerToast('Routine details saved.');
  };

  const handleDeleteRoutine = async (routineId: string) => {
    const target = routines.find(r => r.id === routineId);
    if (!target) return;

    triggerConfirm(
      'Delete routine?',
      `Delete "${target.name}" and all of its workout days, template sets, and routine supersets?`,
      async () => {
        const result = await deleteRoutineGraph(db, routineId);
        if (!result.ok) {
          triggerToast(result.message, 'error');
          return;
        }

        if (editingRoutine?.id === routineId) {
          setEditingRoutine(null);
          setActiveTab('routines');
        }
        await late.refreshData();
        triggerToast('Routine deleted.');
      },
      { approveLabel: 'Delete', tone: 'danger' },
    );
  };

  // Duplicate a routine template with all of its days, exercises, predefined
  // sets, and routine supersets (mirrors the reference app's "Copy Routine").
  const copyRoutine = async (routineId: string, asVersion: boolean) => {
    const source = routines.find(r => r.id === routineId);
    if (!source) return;

    const allSections = await db.query<RoutineSection>('SELECT * FROM routine_sections');
    const sections = allSections.filter(s => s.routine_id === routineId && !s.is_deleted);
    const sectionIds = sections.map(s => s.id);

    const allSecExs = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
    const secExs = allSecExs.filter(se => sectionIds.includes(se.routine_section_id) && !se.is_deleted);
    const secExIds = secExs.map(se => se.id);

    const allSets = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets');
    const sets = allSets.filter(s => secExIds.includes(s.routine_section_exercise_id) && !s.is_deleted);

    const allGroups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
    const groups = allGroups.filter(g => g.routine_section_id && sectionIds.includes(g.routine_section_id) && !g.is_deleted);
    const groupIds = groups.map(g => g.id);

    const allGroupExs = await db.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises');
    const groupExs = allGroupExs.filter(ge => groupIds.includes(ge.workout_group_id) && !ge.is_deleted);

    const newRoutineId = uuidv4();
    const nextVersion = (source.version ?? 1) + 1;
    const newName = asVersion ? `${source.name.replace(/ v\d+$/i, '')} v${nextVersion}` : `${source.name} (Copy)`;
    await db.execute('INSERT INTO routines', [{ ...source, id: newRoutineId, name: newName, version: asVersion ? nextVersion : 1, is_archived: false }]);

    const sectionIdMap = new Map<string, string>();
    for (const section of sections) {
      const newId = uuidv4();
      sectionIdMap.set(section.id, newId);
      await db.execute('INSERT INTO routine_sections', [{ ...section, id: newId, routine_id: newRoutineId }]);
    }

    const secExIdMap = new Map<string, string>();
    for (const se of secExs) {
      const newId = uuidv4();
      secExIdMap.set(se.id, newId);
      await db.execute('INSERT INTO routine_section_exercises', [{ ...se, id: newId, routine_section_id: sectionIdMap.get(se.routine_section_id)! }]);
    }

    for (const set of sets) {
      await db.execute('INSERT INTO routine_section_exercise_sets', [{ ...set, id: uuidv4(), routine_section_exercise_id: secExIdMap.get(set.routine_section_exercise_id)! }]);
    }

    const groupIdMap = new Map<string, string>();
    for (const group of groups) {
      const newId = uuidv4();
      groupIdMap.set(group.id, newId);
      await db.execute('INSERT INTO workout_groups', [{ ...group, id: newId, routine_section_id: sectionIdMap.get(group.routine_section_id!)! }]);
    }

    for (const ge of groupExs) {
      await db.execute('INSERT INTO workout_group_exercises', [{
        ...ge,
        id: uuidv4(),
        workout_group_id: groupIdMap.get(ge.workout_group_id)!,
        routine_section_id: ge.routine_section_id ? sectionIdMap.get(ge.routine_section_id) ?? null : null,
      }]);
    }

    await late.refreshData();
    triggerToast(asVersion ? `Created program version ${nextVersion}.` : `Copied routine as "${newName}".`);
  };

  const handleCopyRoutine = (routineId: string) => copyRoutine(routineId, false);
  const handleCreateRoutineVersion = (routineId: string) => copyRoutine(routineId, true);

  // Import / Load Routine template into current daily logs
  const handleImportRoutine = async (routineId: string) => {
    const sections = await db.query<RoutineSection>('SELECT * FROM routine_sections');
    const routineSecs = sections.filter(s => s.routine_id === routineId && !s.is_deleted).sort(bySortOrder);

    for (const sec of routineSecs) {
      const exList = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
      const secExs = exList.filter(x => x.routine_section_id === sec.id && !x.is_deleted).sort(bySortOrder);
      const importedExerciseIds = secExs.map(se => se.exercise_id);

      for (const se of secExs) {
        const setList = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets');
        const exSets = setList.filter(x => x.routine_section_exercise_id === se.id && !x.is_deleted).sort(bySortOrder);

        for (const s of exSets) {
          const log: TrainingLog = {
            id: uuidv4(),
            exercise_id: se.exercise_id,
            date: selectedDate,
            metric_weight: s.metric_weight,
            reps: s.reps,
            unit: userUnit === 'kg' ? 1 : 2,
            is_personal_record: false,
            is_complete: false,
            distance: s.distance,
            duration_seconds: s.duration_seconds
          };
          await db.execute('INSERT INTO training_logs', [log]);
        }
      }

      await copyRoutineSectionSupersetsToWorkout(sec.id, importedExerciseIds);
      await recordWorkoutRoutine(routineId, sec.id);
    }

    setShowRoutineImportModal(false);
    await late.refreshData();
    triggerToast('Routine templates loaded successfully!');
  };

  // Routine Day Editor loaders and mutators
  const loadEditorData = async (routineId: string) => {
    const allSections = await db.query<RoutineSection>('SELECT * FROM routine_sections WHERE routine_id = ? ORDER BY sort_order', [routineId]);
    const activeSections = allSections.filter(section => !section.is_deleted).sort(bySortOrder);
    setEditorSections(activeSections);

    const allSecExs = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises ORDER BY sort_order');
    const activeSecIds = activeSections.map(s => s.id);
    const filteredSecExs = allSecExs.filter(se => activeSecIds.includes(se.routine_section_id) && !se.is_deleted).sort(bySortOrder);
    setEditorSectionExercises(filteredSecExs);

    const allSets = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets ORDER BY sort_order');
    const activeSecExIds = filteredSecExs.map(se => se.id);
    const filteredSets = allSets.filter(s => activeSecExIds.includes(s.routine_section_exercise_id) && !s.is_deleted).sort(bySortOrder);
    setEditorExerciseSets(filteredSets);
  };

  useEffect(() => {
    if (editingRoutine && activeTab === 'routine-editor') {
      loadEditorData(editingRoutine.id);
    }
  }, [editingRoutine, activeTab]);

  const handleAddDayToRoutine = async () => {
    if (!editingRoutine) return;
    const newSection: RoutineSection = {
      id: uuidv4(),
      routine_id: editingRoutine.id,
      name: `Day ${editorSections.length + 1}`,
      sort_order: 0,
      week_number: editingRoutine.current_week ?? 1,
    };
    const result = await addRoutineSection(db, newSection);
    if (!result.ok) {
      triggerToast(result.message);
      return;
    }
    await loadEditorData(editingRoutine.id);
    triggerToast('Workout day added to template.');
  };

  // Open the "add exercise to section" modal targeting a section.
  const openAddExerciseToSection = (sectionId: string) => {
    setEditorAddExerciseTargetSectionId(sectionId);
    setEditorExercisePickerMode('add');
    setEditorSwitchTargetSectionExerciseId(null);
    setEditorExSearchQuery('');
    setEditorExSelectedCategory(null);
    setShowAddExToSectionModal(true);
  };

  const openSwitchRoutineSectionExercise = (routineSectionExerciseId: string) => {
    setEditorSwitchTargetSectionExerciseId(routineSectionExerciseId);
    setEditorExercisePickerMode('switch');
    setEditorExSearchQuery('');
    setEditorExSelectedCategory(null);
    setShowAddExToSectionModal(true);
  };

  // Open the "import past workout" modal, preloading recent logged dates.
  const openPastImporter = async (sectionId: string) => {
    setPastImporterTargetSectionId(sectionId);
    const dates = await db.query<{ date: string }>('SELECT DISTINCT date FROM training_logs WHERE is_deleted = 0 ORDER BY date DESC LIMIT 5');
    setPastLoggedDates(dates.map(d => d.date));
    setPastImporterDate(dates.length > 0 ? dates[0].date : getLocalDateString());
    setShowPastImporterModal(true);
  };

  const handleAddExerciseToSection = async (sectionId: string, exerciseId: string) => {
    if (isAddingExerciseToSection) return false;
    setIsAddingExerciseToSection(true);
    try {
      const result = await addRoutineSectionExercise(db, { sectionId, exerciseId, makeId: uuidv4 });
      if (!result.ok) {
        triggerToast(result.message, 'error');
        return false;
      }
      if (editingRoutine) await loadEditorData(editingRoutine.id);
      triggerToast('Exercise added to template.');
      return true;
    } catch (error) {
      console.error('Failed to add routine exercise:', error);
      triggerToast(errorMessage(error), 'error');
      return false;
    } finally {
      setIsAddingExerciseToSection(false);
    }
  };

  const handleSwitchRoutineSectionExercise = async (routineSectionExerciseId: string, nextExerciseId: string) => {
    if (isSwitchingRoutineSectionExercise) return false;
    const target = editorSectionExercises.find(item => item.id === routineSectionExerciseId && !item.is_deleted);
    if (!target) return false;
    setIsSwitchingRoutineSectionExercise(true);
    try {
      const result = await switchRoutineSectionExercise(db, {
        routineSectionExerciseId, sectionId: target.routine_section_id, nextExerciseId,
      });
      if (!result.ok) {
        triggerToast(result.message, 'error');
        return false;
      }
      await late.refreshData();
      if (editingRoutine) await loadEditorData(editingRoutine.id);
      triggerToast('Routine exercise switched. Template sets and superset links were preserved.');
      return true;
    } catch (error) {
      console.error('Failed to switch routine exercise:', error);
      await late.refreshData().catch(refreshError => console.error('Failed to reconcile routine data:', refreshError));
      if (editingRoutine) await loadEditorData(editingRoutine.id).catch(refreshError => console.error('Failed to reload routine editor:', refreshError));
      triggerToast(errorMessage(error), 'error');
      return false;
    } finally {
      setIsSwitchingRoutineSectionExercise(false);
    }
  };

  const handleReorderRoutineSectionExercises = async (sectionId: string, orderedIds: string[]) => {
    const result = await reorderRoutineSectionExercises(db, { sectionId, orderedIds });
    if (!result.ok) {
      triggerToast(result.message, 'error');
      return false;
    }
    if (editingRoutine) await loadEditorData(editingRoutine.id);
    triggerToast('Exercises reordered.');
    return true;
  };

  const handleReorderRoutineSections = async (routineId: string, orderedIds: string[]) => {
    const result = await reorderRoutineSections(db, { routineId, orderedIds });
    if (!result.ok) {
      triggerToast(result.message, 'error');
      return false;
    }
    if (editingRoutine) await loadEditorData(editingRoutine.id);
    triggerToast('Workout days reordered.');
    return true;
  };

  const handleDeleteExerciseFromSection = async (rseId: string) => {
    const target = editorSectionExercises.find(item => item.id === rseId && !item.is_deleted);
    if (!target) return;
    const result = await deleteRoutineSectionExercise(db, rseId, target.routine_section_id);
    if (!result.ok) {
      triggerToast(result.message, 'error');
      return;
    }
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Exercise removed from template.');
  };

  const handleAddSetToTemplateExercise = async (rseId: string) => {
    const initialTarget = editorSectionExercises.find(item => item.id === rseId && !item.is_deleted);
    if (!initialTarget) return;
    await withOrderedRoutineSectionMutation(initialTarget.routine_section_id, async () => {
    const currentRows = await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises');
    if (!currentRows.some(item => item.id === rseId && !item.is_deleted)) return;
    const exSets = (await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets'))
      .filter(s => s.routine_section_exercise_id === rseId && !s.is_deleted).sort(bySortOrder);
    const lastSet = exSets[exSets.length - 1];
    // New sets copy the previous set; the first set starts blank (blank fields
    // carry over from the previous workout when the routine is loaded).
    const newSet: RoutineSectionExerciseSet = {
      id: uuidv4(),
      routine_section_exercise_id: rseId,
      metric_weight: lastSet?.metric_weight ?? null,
      reps: lastSet?.reps ?? null,
      sort_order: exSets.length + 1,
      distance: lastSet?.distance ?? null,
      duration_seconds: lastSet?.duration_seconds ?? null,
      unit: lastSet?.unit ?? (userUnit === 'kg' ? 1 : 2)
      ,min_reps: lastSet?.min_reps ?? null,
      max_reps: lastSet?.max_reps ?? null,
      set_type: lastSet?.set_type ?? 'working',
      target_rir: lastSet?.target_rir ?? null,
      tempo: lastSet?.tempo ?? null,
      notes: lastSet?.notes ?? null,
    };
    await db.execute('INSERT INTO routine_section_exercise_sets', [newSet]);
    });
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Set added to template exercise.');
  };

  // Change how an exercise's sets are populated when its routine is loaded
  // (0 = don't populate, 1 = predefined sets, 2 = copy previous workout).
  const handleUpdatePopulateSetsType = async (rseId: string, populateSetsType: number) => {
    const target = editorSectionExercises.find(item => item.id === rseId && !item.is_deleted);
    if (!target) return;
    const result = await updateRoutineSectionExerciseRecord(db, {
      routineSectionExerciseId: rseId, sectionId: target.routine_section_id, values: { populate_sets_type: populateSetsType },
    });
    if (!result.ok) return;
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
  };

  const handleDeleteSetFromTemplateExercise = async (setId: string) => {
    const initialSet = editorExerciseSets.find(item => item.id === setId && !item.is_deleted);
    const initialTarget = initialSet && editorSectionExercises.find(item => item.id === initialSet.routine_section_exercise_id && !item.is_deleted);
    if (!initialTarget) return;
    await withOrderedRoutineSectionMutation(initialTarget.routine_section_id, async () => {
      const currentSets = await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets');
      if (currentSets.some(item => item.id === setId && !item.is_deleted)) {
        await db.execute('DELETE FROM routine_section_exercise_sets WHERE id = ?', [setId]);
      }
    });
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Set deleted from template exercise.');
  };

  const handleUpdateTemplateSetValues = async (setId: string, values: Partial<Pick<RoutineSectionExerciseSet, 'metric_weight' | 'reps' | 'distance' | 'duration_seconds' | 'min_reps' | 'max_reps' | 'set_type' | 'target_rir' | 'tempo' | 'notes'>>) => {
    const set = editorExerciseSets.find(item => item.id === setId && !item.is_deleted);
    const target = set && editorSectionExercises.find(item => item.id === set.routine_section_exercise_id && !item.is_deleted);
    if (!target) return;
    const result = await updateRoutineSectionExerciseSetRecord(db, { setId, sectionId: target.routine_section_id, values });
    if (!result.ok) return;
      if (editingRoutine) {
        await loadEditorData(editingRoutine.id);
      }
  };

  const handleUpdateRoutineSectionExercise = async (rseId: string, values: Partial<RoutineSectionExercise>) => {
    const target = editorSectionExercises.find(item => item.id === rseId && !item.is_deleted);
    if (!target) return;
    const result = await updateRoutineSectionExerciseRecord(db, {
      routineSectionExerciseId: rseId, sectionId: target.routine_section_id, values,
    });
    if (!result.ok) return;
    if (editingRoutine) await loadEditorData(editingRoutine.id);
  };

  const handleUpdateSectionSchedule = async (sectionId: string, values: Partial<Pick<RoutineSection, 'week_number' | 'day_of_week' | 'phase'>>) => {
    await withOrderedRoutineSectionMutation(sectionId, async () => {
      const sections = await db.query<RoutineSection>('SELECT * FROM routine_sections');
      const target = sections.find(section => section.id === sectionId && !section.is_deleted);
      if (target) await db.execute('UPDATE routine_sections', [{ ...target, ...values }]);
    });
    if (editingRoutine) await loadEditorData(editingRoutine.id);
  };

  const handleUpdateSectionName = async (sectionId: string, name: string) => {
    await withOrderedRoutineSectionMutation(sectionId, async () => {
      const allSections = await db.query<RoutineSection>('SELECT * FROM routine_sections');
      const target = allSections.find(s => s.id === sectionId && !s.is_deleted);
      if (target) await db.execute('UPDATE routine_sections', [{ ...target, name }]);
    });
      if (editingRoutine) {
        await loadEditorData(editingRoutine.id);
      }
  };

  const handleDeleteSection = async (sectionId: string) => {
    await withOrderedRoutineSectionMutation(sectionId, async () => {
      const sections = await db.query<RoutineSection>('SELECT * FROM routine_sections');
      const section = sections.find(item => item.id === sectionId && !item.is_deleted);
      if (!section) return;
      const sectionExercises = (await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises'))
        .filter(item => item.routine_section_id === sectionId && !item.is_deleted);
      const sectionExerciseIds = new Set(sectionExercises.map(item => item.id));
      const sets = (await db.query<RoutineSectionExerciseSet>('SELECT * FROM routine_section_exercise_sets'))
        .filter(item => sectionExerciseIds.has(item.routine_section_exercise_id) && !item.is_deleted);
      const groups = (await db.query<WorkoutGroup>('SELECT * FROM workout_groups'))
        .filter(item => item.routine_section_id === sectionId && !item.is_deleted);
      const groupIds = new Set(groups.map(item => item.id));
      const links = (await db.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises'))
        .filter(item => item.routine_section_id === sectionId && groupIds.has(item.workout_group_id) && !item.is_deleted);
      const operations: DBOperation[] = [
        ...links.map(item => ({ sql: 'DELETE FROM workout_group_exercises WHERE id = ?', params: [item.id] })),
        ...groups.map(item => ({ sql: 'DELETE FROM workout_groups WHERE id = ?', params: [item.id] })),
        ...sets.map(item => ({ sql: 'DELETE FROM routine_section_exercise_sets WHERE id = ?', params: [item.id] })),
        ...sectionExercises.map(item => ({ sql: 'DELETE FROM routine_section_exercises WHERE id = ?', params: [item.id] })),
        { sql: 'DELETE FROM routine_sections WHERE id = ?', params: [sectionId] },
      ];
      if (db.executeBatch) await db.executeBatch(operations);
      else for (const operation of operations) await db.execute(operation.sql, operation.params || []);
    });
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast('Workout day deleted.');
  };

  const handleAddAllSectionLogs = async (sectionId: string) => {
    if (!editingRoutine) return;
    // Route through the shared populate path so each exercise's populate_sets_type
    // (predefined / copy previous / none) is honored.
    await handleImportRoutinePopulated(editingRoutine.id, 'template', 75, sectionId);
    setActiveTab('log');
  };

  const handleImportPastLogsToSection = async (sectionId: string, pastDate: string) => {
    if (!pastDate) {
      triggerToast('Please select a target date.', 'error');
      return;
    }

    const pastLogs = await db.query<TrainingLog>('SELECT * FROM training_logs WHERE date = ? AND is_deleted = 0', [pastDate]);
    if (pastLogs.length === 0) {
      triggerToast('No sets found logged on ' + pastDate, 'error');
      return;
    }

    const logsByEx: Record<string, TrainingLog[]> = {};
    for (const log of pastLogs) {
      if (!logsByEx[log.exercise_id]) {
        logsByEx[log.exercise_id] = [];
      }
      logsByEx[log.exercise_id].push(log);
    }

    let exercisesAdded = 0;
    await withOrderedRoutineSectionMutation(sectionId, async () => {
      const existing = (await db.query<RoutineSectionExercise>('SELECT * FROM routine_section_exercises'))
        .filter(item => item.routine_section_id === sectionId && !item.is_deleted);
      const existingExerciseIds = new Set(existing.map(item => item.exercise_id));
      const operations: DBOperation[] = [];
      let nextSortOrder = existing.length;
      for (const [exId, logs] of Object.entries(logsByEx)) {
      if (existingExerciseIds.has(exId)) continue;
      const newRseId = uuidv4();
      const newRse: RoutineSectionExercise = {
        id: newRseId,
        routine_section_id: sectionId,
        exercise_id: exId,
        sort_order: ++nextSortOrder,
        populate_sets_type: 1
      };
      exercisesAdded += 1;
      operations.push({ sql: 'INSERT INTO routine_section_exercises', params: [newRse] });

      let setOrder = 0;
      for (const log of logs) {
        const newRses: RoutineSectionExerciseSet = {
          id: uuidv4(),
          routine_section_exercise_id: newRseId,
          metric_weight: log.metric_weight,
          reps: log.reps,
          sort_order: ++setOrder,
          distance: log.distance,
          duration_seconds: log.duration_seconds,
          unit: log.unit
        };
        operations.push({ sql: 'INSERT INTO routine_section_exercise_sets', params: [newRses] });
      }
      }
      if (db.executeBatch) await db.executeBatch(operations);
      else for (const operation of operations) await db.execute(operation.sql, operation.params || []);
    });

    setShowPastImporterModal(false);
    if (editingRoutine) {
      await loadEditorData(editingRoutine.id);
    }
    triggerToast(exercisesAdded > 0
      ? `Successfully imported exercises from ${pastDate} into day template.`
      : 'All exercises from that workout are already in this day.', exercisesAdded > 0 ? 'success' : 'error');
  };

  return {
    editingRoutine, setEditingRoutine, editorSections, setEditorSections,
    editorSectionExercises, setEditorSectionExercises, editorExerciseSets, setEditorExerciseSets,
    routines, setRoutines,
    showRoutineImportModal, setShowRoutineImportModal, showCreateRoutineModal, setShowCreateRoutineModal,
    showAddExToSectionModal, setShowAddExToSectionModal, isAddingExerciseToSection, setIsAddingExerciseToSection, isSwitchingRoutineSectionExercise, setIsSwitchingRoutineSectionExercise, isCreatingRoutineSuperset, setIsCreatingRoutineSuperset, editorExercisePickerMode, setEditorExercisePickerMode,
    editorSwitchTargetSectionExerciseId, setEditorSwitchTargetSectionExerciseId, editorExSearchQuery, setEditorExSearchQuery,
    editorExSelectedCategory, setEditorExSelectedCategory,
    selectedSectionExerciseIdsForSuperset, setSelectedSectionExerciseIdsForSuperset,
    pastLoggedDates, setPastLoggedDates,
    newRoutineName, setNewRoutineName, newRoutineNotes, setNewRoutineNotes,
    newRoutineCategory, setNewRoutineCategory,
    activeRoutineForPopulate, setActiveRoutineForPopulate,
    activeSectionForPopulate, setActiveSectionForPopulate,
    editorAddExerciseTargetSectionId, setEditorAddExerciseTargetSectionId,
    showPastImporterModal, setShowPastImporterModal,
    pastImporterTargetSectionId, setPastImporterTargetSectionId, pastImporterDate, setPastImporterDate,
    handleImportRoutinePopulated, handleCreateRoutineSuperset, handleUpdateRoutineGroupName, handleClearRoutineGroup,
    handleCreateRoutineTemplate, handleUpdateRoutineCategory, handleUpdateRoutineDetails, handleDeleteRoutine,
    handleCopyRoutine, handleCreateRoutineVersion, handleImportRoutine,
    loadEditorData, handleAddDayToRoutine, openAddExerciseToSection, openSwitchRoutineSectionExercise, openPastImporter,
    handleAddExerciseToSection, handleSwitchRoutineSectionExercise, handleReorderRoutineSectionExercises, handleReorderRoutineSections, handleDeleteExerciseFromSection, handleAddSetToTemplateExercise,
    handleUpdatePopulateSetsType, handleDeleteSetFromTemplateExercise, handleUpdateTemplateSetValues,
    handleUpdateRoutineSectionExercise, handleUpdateSectionSchedule, handleUpdateSectionName, handleDeleteSection,
    handleAddAllSectionLogs, handleImportPastLogsToSection,
  };
}
