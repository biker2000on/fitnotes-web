// Workout logging slice: the selected exercise + set entry form, current day's
// logs, all-logs history, workout comment/time, rest timer, supersets/workout
// groups, bulk edit actions, and sharing. Code moved verbatim from
// FitNotesStore.tsx.
import { useState, useEffect, useRef, type MutableRefObject } from 'react';
import { db } from '../../storage/db';
import { uuidv4 } from '../../lib/uuid';
import { getLocalDateString } from '../../lib/date';
import { beep, vibrate, notify } from '../../lib/notify';
import { typeHasDistance, typeHasDuration, typeHasReps, typeHasWeight } from '../../lib/units';
import { hexToSignedArgb } from '../../lib/colors';
import type {
  Exercise, TrainingLog, WorkoutGroup, WorkoutGroupExercise, WorkoutRoutine,
  WorkoutTime, ExerciseComment, Settings,
} from '../../types';
import type { LateDeps, TriggerToast, TriggerConfirm } from './types';

const parseEffortInput = (raw: string, minimum: number): number | null => {
  if (!raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= minimum && value <= 10 ? value : null;
};

export interface WorkoutSliceDeps {
  late: LateDeps;
  triggerToast: TriggerToast;
  triggerConfirm: TriggerConfirm;
  settings: Settings;
  userUnit: 'kg' | 'lbs';
  displayWeight: (metricWeight: number | null, logUnit: number | null) => string;
  selectedDate: string;
  selectedDateRef: MutableRefObject<string>;
  exercises: Exercise[];
}

export function useWorkoutSlice(deps: WorkoutSliceDeps) {
  const {
    late, triggerToast, triggerConfirm, settings, userUnit, displayWeight,
    selectedDate, selectedDateRef, exercises,
  } = deps;

  const [currentLogs, setCurrentLogs] = useState<TrainingLog[]>([]);
  const [workoutComment, setWorkoutComment] = useState<string>('');
  // Workout time tracking for the selected date (start/stop/duration).
  const [workoutTime, setWorkoutTime] = useState<WorkoutTime | null>(null);
  const workoutTimeRef = useRef<WorkoutTime | null>(null);
  workoutTimeRef.current = workoutTime;
  // When set, the next exercise picked in the command palette replaces this
  // exercise in the current day's workout instead of being selected for logging.
  const [replaceTargetExerciseId, setReplaceTargetExerciseId] = useState<string | null>(null);

  // Supersets / Workout Groups State
  const [workoutGroups, setWorkoutGroups] = useState<WorkoutGroup[]>([]);
  const [groupExercises, setGroupExercises] = useState<WorkoutGroupExercise[]>([]);
  // Routine-to-day completion links
  const [workoutRoutines, setWorkoutRoutines] = useState<WorkoutRoutine[]>([]);
  const [selectedLogIdsForGroup, setSelectedLogIdsForGroup] = useState<string[]>([]);

  // Selected Log State
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [logWeight, setLogWeight] = useState('60');
  const [logReps, setLogReps] = useState('10');
  const [logDistance, setLogDistance] = useState('5');
  const [logDuration, setLogDuration] = useState('30');
  const [logComment, setLogComment] = useState('');
  const [logRpe, setLogRpe] = useState('');
  const [logRir, setLogRir] = useState('');
  const [logSetType, setLogSetType] = useState('working');
  const [editingLog, setEditingLog] = useState<TrainingLog | null>(null);
  const [exerciseComments, setExerciseComments] = useState<ExerciseComment[]>([]);

  const selectedExerciseRef = useRef<Exercise | null>(null);
  const workoutCommentRef = useRef<string>('');

  useEffect(() => {
    selectedExerciseRef.current = selectedExercise;
  }, [selectedExercise]);

  useEffect(() => {
    workoutCommentRef.current = workoutComment;
  }, [workoutComment]);

  // Rest timer (seconds remaining; null = inactive).
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [restPaused, setRestPaused] = useState(false);
  const startRestTimer = (seconds?: number) => { setRestRemaining(seconds ?? settings.rest_timer_seconds); setRestPaused(false); };
  const pauseRestTimer = () => setRestPaused(p => !p);
  const cancelRestTimer = () => { setRestRemaining(null); setRestPaused(false); };
  const adjustRestTimer = (delta: number) => setRestRemaining(r => (r == null ? r : Math.max(0, r + delta)));

  useEffect(() => {
    if (restRemaining === null || restPaused) return;
    if (restRemaining <= 0) {
      if (settings.rest_timer_sound) beep(settings.rest_timer_volume);
      if (settings.rest_timer_vibrate) vibrate();
      notify('Rest complete', 'Time for your next set');
      setRestRemaining(null);
      return;
    }
    const id = setTimeout(() => setRestRemaining(r => (r == null ? r : r - 1)), 1000);
    return () => clearTimeout(id);
  }, [restRemaining, restPaused]);

  // Superset Manager modal states
  const [showSupersetManagerModal, setShowSupersetManagerModal] = useState(false);
  const [selectedExIdsForSuperset, setSelectedExIdsForSuperset] = useState<string[]>([]);
  const [supersetColor, setSupersetColor] = useState('#ef4444');
  const [supersetName, setSupersetName] = useState('Superset');
  const [targetSupersetGroupId, setTargetSupersetGroupId] = useState('');

  const [allLogs, setAllLogs] = useState<TrainingLog[]>([]);

  // Premium Features States (Phases 10-13)
  const [showCopyWorkoutDrawer, setShowCopyWorkoutDrawer] = useState(false);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkMoveTargetDate, setBulkMoveTargetDate] = useState<string>(selectedDate);

  // 1-Rep Max Math helpers for Routines Populator
  const calculateEstimated1RM = (weight: number, reps: number) => {
    if (reps <= 0) return 0;
    if (reps === 1) return weight;
    return weight / (1.0278 - 0.0278 * reps);
  };

  const getHighest1RM = (exerciseId: string, beforeDate?: string) => {
    const activeExLogs = allLogs.filter(l =>
      l.exercise_id === exerciseId &&
      !l.is_deleted &&
      l.metric_weight &&
      l.reps &&
      (!beforeDate || l.date < beforeDate)
    );
    if (activeExLogs.length === 0) return 0;

    let max1RM = 0;
    for (const log of activeExLogs) {
      const w = log.metric_weight || 0;
      const r = log.reps || 0;
      const oneRM = calculateEstimated1RM(w, r);
      if (oneRM > max1RM) {
        max1RM = oneRM;
      }
    }
    return max1RM;
  };

  // Log Mutators
  // Weighted sets PR by heavier weight at the same reps; bodyweight sets PR by max reps.
  const isNewPR = (exerciseId: string, typeId: number, weight: number | null, reps: number | null): boolean => {
    if (!settings.track_personal_records || !reps) return false;
    const isWeightedSet = typeHasWeight(typeId) && (weight ?? 0) > 0;

    if (isWeightedSet) {
      const priorBest = allLogs
        .filter(l => l.exercise_id === exerciseId && !l.is_deleted && l.reps === reps && (l.metric_weight ?? 0) > 0)
        .reduce((m, l) => Math.max(m, l.metric_weight as number), 0);
      return (weight as number) > priorBest;
    }

    if (!typeHasReps(typeId)) return false;
    const priorBestReps = allLogs
      .filter(l => l.exercise_id === exerciseId && !l.is_deleted && (l.metric_weight ?? 0) <= 0)
      .reduce((m, l) => Math.max(m, l.reps ?? 0), 0);
    return reps > priorBestReps;
  };

  const handleAddSet = async () => {
    if (!selectedExercise) return;
    const t = selectedExercise.exercise_type_id;
    const weight = typeHasWeight(t) ? (parseFloat(logWeight) || null) : null;
    const reps = typeHasReps(t) ? (parseInt(logReps) || null) : null;
    const distance = typeHasDistance(t) ? (logDistance ? (parseFloat(logDistance) * (settings.distance_unit === 2 ? 1.60934 : 1)) : null) : null;
    const duration = typeHasDuration(t) ? (parseInt(logDuration) || null) : null;
    const pr = isNewPR(selectedExercise.id, t, weight, reps);

    if (editingLog) {
      const updatedLog: TrainingLog = {
        ...editingLog,
        metric_weight: weight,
        reps,
        unit: userUnit === 'kg' ? 1 : 2,
        is_personal_record: pr,
        distance,
        duration_seconds: duration,
        comment: logComment || null,
        rpe: parseEffortInput(logRpe, 1),
        rir: parseEffortInput(logRir, 0),
        set_type: logSetType || 'working',
      };
      await db.execute('UPDATE training_logs', [updatedLog]);
      setEditingLog(null);
      setLogComment('');
      setLogRpe('');
      setLogRir('');
      setLogSetType('working');
      await late.refreshData();
      triggerToast('Set updated.');
      return;
    }

    const newLog: TrainingLog = {
      id: uuidv4(),
      exercise_id: selectedExercise.id,
      date: selectedDate,
      metric_weight: weight,
      reps,
      unit: userUnit === 'kg' ? 1 : 2,
      is_personal_record: pr,
      is_complete: false,
      distance,
      duration_seconds: duration,
      comment: logComment || null,
      rpe: parseEffortInput(logRpe, 1),
      rir: parseEffortInput(logRir, 0),
      set_type: logSetType || 'working',
    };

    await db.execute('INSERT INTO training_logs', [newLog]);
    if (newLog.date === selectedDateRef.current) {
      setCurrentLogs(prev => [...prev, newLog]);
    }
    setAllLogs(prev => [...prev.filter(l => l.id !== newLog.id), newLog]);
    setLogComment('');
    setLogRpe('');
    setLogRir('');
    setLogSetType('working');
    await late.refreshData(newLog.date);
    if (pr) triggerToast(`New PR! ${selectedExercise.name}`, 'success');
    if (settings.rest_timer_auto_start) {
      startRestTimer(selectedExercise.default_rest_time || settings.rest_timer_seconds);
    }
    // Auto-start the workout timer on the first set of today's workout.
    if (settings.workout_timer_auto_start_enabled && newLog.date === getLocalDateString() && !workoutTimeRef.current?.start_time) {
      await handleStartWorkoutTimer(true);
    }
  };

  const handleSelectLogForEdit = (log: TrainingLog) => {
    const ex = exercises.find(x => x.id === log.exercise_id);
    if (!ex) return;
    setSelectedExercise(ex);
    setEditingLog(log);

    if (log.metric_weight !== null) {
      if (log.unit === 1 && userUnit === 'lbs') {
        setLogWeight(String(Math.round(log.metric_weight * 2.20462 * 10) / 10));
      } else if (log.unit === 2 && userUnit === 'kg') {
        setLogWeight(String(Math.round(log.metric_weight / 2.20462 * 10) / 10));
      } else {
        setLogWeight(String(log.metric_weight));
      }
    } else {
      setLogWeight('');
    }

    if (log.reps !== null) {
      setLogReps(String(log.reps));
    } else {
      setLogReps('');
    }

    if (log.distance !== null) {
      setLogDistance(String(settings.distance_unit === 2 ? Math.round((log.distance / 1.60934) * 1000) / 1000 : log.distance));
    } else {
      setLogDistance('');
    }

    if (log.duration_seconds !== null) {
      setLogDuration(String(log.duration_seconds));
    } else {
      setLogDuration('');
    }

    setLogComment(log.comment || '');
    setLogRpe(log.rpe?.toString() || '');
    setLogRir(log.rir?.toString() || '');
    setLogSetType(log.set_type || 'working');

    // Focus the first relevant input
    setTimeout(() => {
      const wInput = document.getElementById('log-weight-input');
      const rInput = document.getElementById('log-reps-input');
      const dInput = document.getElementById('log-distance-input');
      const minInput = document.getElementById('log-duration-min-input');
      const target = wInput || rInput || dInput || minInput;
      if (target) {
        (target as HTMLInputElement).focus();
        (target as HTMLInputElement).select();
      }
    }, 50);
  };

  const handleCancelEdit = () => {
    setEditingLog(null);
    setLogComment('');
    setLogRpe('');
    setLogRir('');
    setLogSetType('working');
  };

  // Fill the entry form from the most recent prior set of the selected exercise.
  const handleCopyPreviousSet = () => {
    if (!selectedExercise) return;
    const prior = allLogs
      .filter(l => l.exercise_id === selectedExercise.id && !l.is_deleted && l.date < selectedDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!prior) { triggerToast('No previous set found.', 'info'); return; }
    if (prior.metric_weight != null) setLogWeight(String(prior.metric_weight));
    if (prior.reps != null) setLogReps(String(prior.reps));
    if (prior.distance != null) setLogDistance(String(settings.distance_unit === 2 ? Math.round((prior.distance / 1.60934) * 1000) / 1000 : prior.distance));
    if (prior.duration_seconds != null) setLogDuration(String(prior.duration_seconds));
  };

  // Clear all sets + superset groups for the selected date.
  const handleClearDay = () => {
    triggerConfirm('Clear Day', `Delete all sets logged on ${selectedDate}?`, async () => {
      for (const l of currentLogs) await db.execute('UPDATE training_logs', [{ ...l, is_deleted: true }]);
      const groups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
      for (const g of groups.filter(x => x.date === selectedDate && !x.is_deleted)) await db.execute('UPDATE workout_groups', [{ ...g, is_deleted: true }]);
      const routineLinks = await db.query<WorkoutRoutine>('SELECT * FROM workout_routines');
      for (const wr of routineLinks.filter(x => x.date === selectedDate && !x.is_deleted)) await db.execute('UPDATE workout_routines', [{ ...wr, is_deleted: true }]);
      await late.refreshData();
      triggerToast('Day cleared.');
    }, { approveLabel: 'Delete', tone: 'danger' });
  };

  // Swap every set of an exercise in the current day's workout (and its
  // superset links) over to a different exercise — the reference app's
  // "Replace Exercise" action.
  const handleReplaceExercise = async (fromExerciseId: string, toExerciseId: string) => {
    if (fromExerciseId === toExerciseId) { setReplaceTargetExerciseId(null); return; }
    const date = selectedDateRef.current;
    const fromEx = exercises.find(x => x.id === fromExerciseId);
    const toEx = exercises.find(x => x.id === toExerciseId);
    if (!toEx) return;

    for (const log of currentLogs.filter(l => l.exercise_id === fromExerciseId)) {
      await db.execute('UPDATE training_logs', [{ ...log, exercise_id: toExerciseId, is_personal_record: false }]);
    }
    for (const ge of groupExercises.filter(g => g.date === date && g.exercise_id === fromExerciseId && !g.is_deleted)) {
      await db.execute('UPDATE workout_group_exercises', [{ ...ge, exercise_id: toExerciseId }]);
    }

    setReplaceTargetExerciseId(null);
    if (selectedExercise?.id === fromExerciseId) setSelectedExercise(toEx);
    await late.refreshData();
    triggerToast(`Replaced ${fromEx?.name ?? 'exercise'} with ${toEx.name}.`);
  };

  // Workout time tracking (mirror of the reference app's "Time Workout"):
  // start stamps start_time, stop stamps end_time + duration, starting a
  // finished timer resumes it by clearing the end.
  const handleStartWorkoutTimer = async (silent = false) => {
    const existing = workoutTimeRef.current;
    const nowIso = new Date().toISOString();
    const rec: WorkoutTime = existing
      ? { ...existing, start_time: existing.start_time ?? nowIso, end_time: null, duration_seconds: null, is_deleted: false }
      : { id: uuidv4(), date: selectedDateRef.current, start_time: nowIso, end_time: null, duration_seconds: null };
    await db.execute('INSERT INTO workout_times', [rec]);
    setWorkoutTime(rec);
    if (!silent) triggerToast('Workout timer started.');
  };

  const handleStopWorkoutTimer = async () => {
    const existing = workoutTimeRef.current;
    if (!existing?.start_time || existing.end_time) return;
    const end = new Date();
    const started = new Date(existing.start_time);
    const duration = Math.max(0, Math.round((end.getTime() - started.getTime()) / 1000));
    const rec: WorkoutTime = { ...existing, end_time: end.toISOString(), duration_seconds: duration };
    await db.execute('INSERT INTO workout_times', [rec]);
    setWorkoutTime(rec);
    const mins = Math.round(duration / 60);
    triggerToast(`Workout finished in ${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`}.`);
  };

  const handleDeleteWorkoutTime = async () => {
    const existing = workoutTimeRef.current;
    if (!existing) return;
    await db.execute('INSERT INTO workout_times', [{ ...existing, is_deleted: true }]);
    setWorkoutTime(null);
    triggerToast('Workout time removed.');
  };

  // Stop the running timer once every set for the day is complete.
  const maybeAutoStopWorkoutTimer = async (date: string) => {
    if (!settings.workout_timer_auto_stop_enabled) return;
    const running = workoutTimeRef.current;
    if (!running?.start_time || running.end_time || running.date !== date) return;
    const logs = await db.query<TrainingLog>('SELECT * FROM training_logs WHERE date = ? AND is_deleted = 0', [date]);
    if (logs.length > 0 && logs.every(l => l.is_complete)) {
      await handleStopWorkoutTimer();
    }
  };

  // Per-exercise-per-day comment.
  const saveExerciseComment = async (exerciseId: string, comment: string) => {
    const existing = exerciseComments.find(c => c.exercise_id === exerciseId && c.date === selectedDate);
    const rec: ExerciseComment = existing
      ? { ...existing, comment }
      : { id: uuidv4(), exercise_id: exerciseId, date: selectedDate, comment };
    await db.execute('INSERT INTO exercise_comments', [rec]);
    const recs = await db.query<ExerciseComment>('SELECT * FROM exercise_comments WHERE date = ?', [selectedDate]);
    setExerciseComments(recs);
  };

  const handleToggleComplete = async (log: TrainingLog) => {
    const updated = { ...log, is_complete: !log.is_complete };
    await db.execute('INSERT INTO training_logs', [updated]);
    if (updated.is_complete) await maybeAutoStopWorkoutTimer(log.date);
    await late.refreshData();
  };

  const handleMarkAllComplete = async () => {
    const uncompleted = currentLogs.filter(l => !l.is_complete);
    if (uncompleted.length === 0) return;

    for (const log of uncompleted) {
      const updated = { ...log, is_complete: true };
      await db.execute('INSERT INTO training_logs', [updated]);
    }
    await maybeAutoStopWorkoutTimer(selectedDateRef.current);
    await late.refreshData();
    triggerToast('All sets marked complete.');
  };

  const handleMarkExerciseComplete = async (exerciseId: string) => {
    const exLogs = currentLogs.filter(l => l.exercise_id === exerciseId && !l.is_complete);
    if (exLogs.length === 0) return;

    for (const log of exLogs) {
      const updated = { ...log, is_complete: true };
      await db.execute('INSERT INTO training_logs', [updated]);
    }
    await maybeAutoStopWorkoutTimer(selectedDateRef.current);
    await late.refreshData();
    triggerToast('All exercise sets marked complete.');
  };

  const handleDeleteSet = async (id: string) => {
    const target = currentLogs.find(x => x.id === id) || allLogs.find(x => x.id === id);
    if (target) {
      const deleted = { ...target, is_deleted: true };
      if (target.date === selectedDateRef.current) {
        setCurrentLogs(prev => prev.filter(l => l.id !== id));
        setSelectedLogIdsForGroup(prev => prev.filter(logId => logId !== id));
      }
      setAllLogs(prev => prev.map(l => l.id === id ? deleted : l));
      await db.execute('INSERT INTO training_logs', [deleted]);
      await late.refreshDateData(target.date);
    }
  };

  const handleDeleteWorkoutRoutine = async (id: string) => {
    const target = workoutRoutines.find(x => x.id === id);
    if (!target) return;

    const deleted = { ...target, is_deleted: true };
    setWorkoutRoutines(prev => prev.map(wr => wr.id === id ? deleted : wr));
    await db.execute('INSERT INTO workout_routines', [deleted]);
    await late.refreshData();
    triggerToast('Routine link removed from workout.');
  };

  // Copy workout selector handler
  const handleCopyWorkoutConfirm = async (sourceDate: string) => {
    const targetDate = selectedDateRef.current;
    const sourceLogs = allLogs.filter(l => l.date === sourceDate && !l.is_deleted);
    if (sourceLogs.length === 0) {
      triggerToast('No active sets found for selected date!', 'error');
      return;
    }

    const sourceGroups = workoutGroups.filter(g => g.date === sourceDate && !g.is_deleted);
    const sourceGroupExs = groupExercises.filter(ge => ge.date === sourceDate && !ge.is_deleted);
    const sourceRoutineLinks = workoutRoutines.filter(wr => wr.date === sourceDate && !wr.is_deleted);
    const targetRoutineLinks = workoutRoutines.filter(wr => wr.date === targetDate && !wr.is_deleted);

    const groupIdMap: Record<string, string> = {};

    for (const wg of sourceGroups) {
      const newGroupId = uuidv4();
      groupIdMap[wg.id] = newGroupId;
      const newGroup = {
        ...wg,
        id: newGroupId,
        date: targetDate,
        last_modified: new Date().toISOString()
      };
      await db.execute('INSERT INTO workout_groups', [newGroup]);
    }

    for (const ge of sourceGroupExs) {
      const newGroupId = groupIdMap[ge.workout_group_id];
      if (newGroupId) {
        const newGe = {
          ...ge,
          id: uuidv4(),
          date: targetDate,
          workout_group_id: newGroupId,
          last_modified: new Date().toISOString()
        };
        await db.execute('INSERT INTO workout_group_exercises', [newGe]);
      }
    }

    for (const log of sourceLogs) {
      const newLog = {
        ...log,
        id: uuidv4(),
        date: targetDate,
        is_complete: false,
        is_personal_record: false,
        last_modified: new Date().toISOString()
      };
      await db.execute('INSERT INTO training_logs', [newLog]);
    }

    for (const wr of sourceRoutineLinks) {
      const duplicate = targetRoutineLinks.some(existing =>
        existing.routine_id === wr.routine_id &&
        (existing.routine_section_id ?? null) === (wr.routine_section_id ?? null)
      );
      if (duplicate) continue;

      const newRoutineLink: WorkoutRoutine = {
        ...wr,
        id: uuidv4(),
        date: targetDate,
        is_deleted: false,
      };
      await db.execute('INSERT INTO workout_routines', [newRoutineLink]);
    }

    setShowCopyWorkoutDrawer(false);
    await late.refreshData();
    triggerToast(`Successfully copied workout from ${sourceDate}.`);
  };

  // Record that a routine (and optionally a specific workout-day split) was
  // loaded onto a date. Skips duplicates so re-importing the same split on the
  // same day doesn't inflate completion counts.
  const recordWorkoutRoutine = async (routineId: string, sectionId: string | null, date = selectedDateRef.current) => {
    const existing = await db.query<WorkoutRoutine>('SELECT * FROM workout_routines WHERE date = ?', [date]);
    const dup = existing.some(wr =>
      !wr.is_deleted && wr.routine_id === routineId && (wr.routine_section_id ?? null) === (sectionId ?? null)
    );
    if (dup) return;
    const link: WorkoutRoutine = {
      id: uuidv4(),
      date,
      routine_id: routineId,
      routine_section_id: sectionId,
    };
    await db.execute('INSERT INTO workout_routines', [link]);
    setWorkoutRoutines(prev => [...prev, link]);
  };

  // Bulk Edit / Mutation Handlers
  const handleBulkDelete = async () => {
    for (const id of selectedLogIdsForGroup) {
      const target = allLogs.find(x => x.id === id);
      if (target) {
        const deleted = { ...target, is_deleted: true };
        await db.execute('INSERT INTO training_logs', [deleted]);
      }
    }
    setSelectedLogIdsForGroup([]);
    await late.refreshData();
    triggerToast('Selected sets deleted.');
  };

  const handleBulkMoveConfirm = async (targetDate: string) => {
    for (const id of selectedLogIdsForGroup) {
      const target = allLogs.find(x => x.id === id);
      if (target) {
        const moved = { ...target, date: targetDate };
        await db.execute('INSERT INTO training_logs', [moved]);
      }
    }
    setSelectedLogIdsForGroup([]);
    setShowBulkMoveModal(false);
    await late.refreshData();
    triggerToast(`Selected sets moved to ${targetDate}.`);
  };

  const handleBulkIncrementWeight = async () => {
    for (const id of selectedLogIdsForGroup) {
      const target = allLogs.find(x => x.id === id);
      if (target && target.metric_weight !== null) {
        const currentWeight = target.metric_weight || 0;
        const updated = { ...target, metric_weight: currentWeight + 5 };
        await db.execute('INSERT INTO training_logs', [updated]);
      }
    }
    await late.refreshData();
    triggerToast('Incremented weights of selected sets by 5.');
  };

  const handleBulkIncrementReps = async () => {
    for (const id of selectedLogIdsForGroup) {
      const target = allLogs.find(x => x.id === id);
      if (target && target.reps !== null) {
        const currentReps = target.reps || 0;
        const updated = { ...target, reps: currentReps + 2 };
        await db.execute('INSERT INTO training_logs', [updated]);
      }
    }
    await late.refreshData();
    triggerToast('Incremented reps of selected sets by 2.');
  };

  // 7 Dynamic Exercise Types formatter
  const formatLogValue = (log: TrainingLog, typeId: number | string) => {
    const id = Number(typeId);
    const hasWeightValue = log.metric_weight !== null && Number(log.metric_weight) > 0;
    const weightStr = hasWeightValue ? `${displayWeight(log.metric_weight, log.unit)}` : '';
    const repsStr = log.reps !== null ? `${log.reps} reps` : '';
    const distStr = log.distance !== null
      ? (settings.distance_unit === 2 ? `${Math.round((log.distance / 1.60934) * 100) / 100} mi` : `${log.distance} km`)
      : '';
    const durStr = log.duration_seconds !== null ? `${Math.floor(log.duration_seconds / 60)}m ${log.duration_seconds % 60}s` : '';
    const distanceTimeStr = distStr && durStr ? `${distStr} in ${durStr}` : distStr || durStr;

    let value = '';
    switch (id) {
      case 0: // Weight & Reps
        value = !hasWeightValue && repsStr ? repsStr : `${weightStr} x ${repsStr}`;
        break;
      case 1: // Distance & Time (FitNotes Android/Cardio)
        value = distanceTimeStr; break;
      case 2: // Reps Only
        value = repsStr; break;
      case 3: // Distance & Time
        value = distanceTimeStr; break;
      case 4: // Distance Only
        value = distStr; break;
      case 5: // Time Only
        value = durStr; break;
      case 6: // Weight & Distance
        value = `${weightStr} for ${distStr}`; break;
      case 7: // Weight & Time
        value = `${weightStr} for ${durStr}`; break;
      default:
        value = `${weightStr} x ${repsStr}`;
    }
    const effort = [log.set_type && log.set_type !== 'working' ? log.set_type : '', log.rpe != null ? `RPE ${log.rpe}` : '', log.rir != null ? `RIR ${log.rir}` : ''].filter(Boolean).join(' · ');
    return effort ? `${value} (${effort})` : value;
  };

  // Workout comment mutator
  const handleSaveComment = async () => {
    const commentObj = {
      id: uuidv4(),
      date: selectedDate,
      comment: workoutComment
    };
    await db.execute('INSERT INTO workout_comments', [commentObj]);
    triggerToast('Workout comment saved!');
  };

  // Build a shareable text summary of the selected day and share/copy it.
  const shareWorkout = async () => {
    const lines: string[] = [`FitNotes - ${selectedDate}`, ''];
    const exIds = Array.from(new Set(currentLogs.map(l => l.exercise_id)));
    let totalVol = 0, totalSets = 0;
    for (const exId of exIds) {
      const ex = exercises.find(e => e.id === exId);
      if (!ex) continue;
      lines.push(ex.name);
      currentLogs.filter(l => l.exercise_id === exId).forEach((l, i) => {
        lines.push(`  ${i + 1}. ${formatLogValue(l, ex.exercise_type_id)}${l.is_personal_record ? ' (PR)' : ''}`);
        totalVol += (l.metric_weight ?? 0) * (l.reps ?? 0);
        totalSets += 1;
      });
    }
    if (workoutComment) lines.push('', `Note: ${workoutComment}`);
    lines.push('', `Total: ${totalSets} sets, ${Math.round(totalVol)} ${userUnit} volume`);
    const text = lines.join('\n');
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({ title: `Workout ${selectedDate}`, text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        triggerToast('Workout summary copied to clipboard.');
      }
    } catch { /* user cancelled */ }
  };

  // Active workout supersets linker
  const handleCreateWorkoutSuperset = async () => {
    if (selectedExIdsForSuperset.length === 0) {
      triggerToast('Please select at least 1 exercise!', 'error');
      return;
    }

    const colourVal = hexToSignedArgb(supersetColor);

    let groupId = targetSupersetGroupId;

    if (!groupId) {
      if (selectedExIdsForSuperset.length < 2) {
        triggerToast('Please select at least 2 exercises to create a new superset!', 'error');
        return;
      }
      groupId = uuidv4();
      const newGroup: WorkoutGroup = {
        id: groupId,
        name: supersetName || 'Superset',
        date: selectedDate,
        colour: colourVal,
        auto_jump_enabled: true,
        rest_timer_auto_start_enabled: false
      };
      await db.execute('INSERT INTO workout_groups', [newGroup]);
    } else {
      const existing = workoutGroups.find(g => g.id === groupId);
      if (existing) {
        const updated = {
          ...existing,
          name: supersetName || existing.name,
          colour: colourVal
        };
        await db.execute('UPDATE workout_groups', [updated]);
      }
    }

    for (const exId of selectedExIdsForSuperset) {
      const alreadyLinked = groupExercises.some(
        ge => ge.workout_group_id === groupId && ge.exercise_id === exId && ge.date === selectedDate && !ge.is_deleted
      );
      if (!alreadyLinked) {
        const link: WorkoutGroupExercise = {
          id: uuidv4(),
          exercise_id: exId,
          date: selectedDate,
          workout_group_id: groupId
        };
        await db.execute('INSERT INTO workout_group_exercises', [link]);
      }
    }

    setSelectedExIdsForSuperset([]);
    setSupersetName('Superset');
    setTargetSupersetGroupId('');
    setShowSupersetManagerModal(false);
    await late.refreshData();
    triggerToast(targetSupersetGroupId ? 'Exercises added to superset!' : 'Superset created successfully!');
  };

  // Supersets & Workout Groups Manager
  const handleCreateSuperset = async () => {
    if (selectedLogIdsForGroup.length < 2) {
      triggerToast('Please select at least 2 exercise logs to form a superset!', 'error');
      return;
    }

    const groupId = uuidv4();
    const newGroup: WorkoutGroup = {
      id: groupId,
      name: 'Superset Group',
      date: selectedDate,
      colour: hexToSignedArgb('#ef4444'),
      auto_jump_enabled: false,
      rest_timer_auto_start_enabled: false
    };

    await db.execute('INSERT INTO workout_groups', [newGroup]);

    for (const logId of selectedLogIdsForGroup) {
      const log = currentLogs.find(x => x.id === logId);
      if (log) {
        const link: WorkoutGroupExercise = {
          id: uuidv4(),
          exercise_id: log.exercise_id,
          date: selectedDate,
          workout_group_id: groupId
        };
        await db.execute('INSERT INTO workout_group_exercises', [link]);
      }
    }

    setSelectedLogIdsForGroup([]);
    await late.refreshData();
    triggerToast('Superset created successfully!');
  };

  const handleClearGroup = async (groupId: string) => {
    // Soft delete workout group
    const groups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
    const links = await db.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises');

    const targetGroup = groups.find(x => x.id === groupId);
    if (targetGroup) {
      await db.execute('INSERT INTO workout_groups', [{ ...targetGroup, is_deleted: true }]);
    }
    const targetLinks = links.filter(x => x.workout_group_id === groupId);
    for (const link of targetLinks) {
      await db.execute('INSERT INTO workout_group_exercises', [{ ...link, is_deleted: true }]);
    }

    await late.refreshData();
    triggerToast('Superset cleared.');
  };

  return {
    currentLogs, setCurrentLogs, workoutComment, setWorkoutComment,
    workoutTime, setWorkoutTime, workoutTimeRef,
    replaceTargetExerciseId, setReplaceTargetExerciseId,
    workoutGroups, setWorkoutGroups, groupExercises, setGroupExercises,
    workoutRoutines, setWorkoutRoutines, selectedLogIdsForGroup, setSelectedLogIdsForGroup,
    selectedExercise, setSelectedExercise, selectedExerciseRef, workoutCommentRef,
    logWeight, setLogWeight, logReps, setLogReps, logDistance, setLogDistance, logDuration, setLogDuration,
    logComment, setLogComment, logRpe, setLogRpe, logRir, setLogRir, logSetType, setLogSetType,
    editingLog, setEditingLog, exerciseComments, setExerciseComments,
    restRemaining, restPaused, startRestTimer, pauseRestTimer, cancelRestTimer, adjustRestTimer,
    showSupersetManagerModal, setShowSupersetManagerModal, selectedExIdsForSuperset, setSelectedExIdsForSuperset,
    supersetColor, setSupersetColor, supersetName, setSupersetName, targetSupersetGroupId, setTargetSupersetGroupId,
    allLogs, setAllLogs,
    showCopyWorkoutDrawer, setShowCopyWorkoutDrawer, showBulkMoveModal, setShowBulkMoveModal,
    bulkMoveTargetDate, setBulkMoveTargetDate,
    calculateEstimated1RM, getHighest1RM, isNewPR,
    handleAddSet, handleSelectLogForEdit, handleCancelEdit, handleCopyPreviousSet, handleClearDay,
    handleReplaceExercise, handleStartWorkoutTimer, handleStopWorkoutTimer, handleDeleteWorkoutTime,
    maybeAutoStopWorkoutTimer, saveExerciseComment, handleToggleComplete, handleMarkAllComplete,
    handleMarkExerciseComplete, handleDeleteSet, handleDeleteWorkoutRoutine, handleCopyWorkoutConfirm,
    recordWorkoutRoutine, handleBulkDelete, handleBulkMoveConfirm, handleBulkIncrementWeight, handleBulkIncrementReps,
    formatLogValue, handleSaveComment, shareWorkout,
    handleCreateWorkoutSuperset, handleCreateSuperset, handleClearGroup,
  };
}
