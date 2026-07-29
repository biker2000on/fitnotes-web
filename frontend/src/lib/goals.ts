// goals.ts - Goal type metadata and progress math, shared by GoalsView and
// the needs-attention feed.
import { GOAL_TYPE, type Goal, type TrainingLog } from '../types';

export type GoalUnit = 'weight' | 'reps' | 'dist' | 'time';

export const GOAL_TYPE_OPTIONS: { id: number; label: string; unit: GoalUnit }[] = [
  { id: GOAL_TYPE.MAX_WEIGHT, label: 'Max Weight', unit: 'weight' },
  { id: GOAL_TYPE.ESTIMATED_1RM, label: 'Estimated 1RM', unit: 'weight' },
  { id: GOAL_TYPE.MAX_VOLUME, label: 'Max Set Volume', unit: 'weight' },
  { id: GOAL_TYPE.MAX_WEIGHT_FOR_REPS, label: 'Max Weight for Reps', unit: 'weight' },
  { id: GOAL_TYPE.MAX_REPS, label: 'Max Reps', unit: 'reps' },
  { id: GOAL_TYPE.MAX_DISTANCE, label: 'Max Distance', unit: 'dist' },
  { id: GOAL_TYPE.MAX_DURATION, label: 'Max Time', unit: 'time' },
  { id: GOAL_TYPE.MAX_WORKOUT_VOLUME, label: 'Max Workout Volume', unit: 'weight' },
  { id: GOAL_TYPE.MAX_WORKOUT_REPS, label: 'Max Workout Reps', unit: 'reps' },
  { id: GOAL_TYPE.MAX_WORKOUT_DISTANCE, label: 'Max Workout Distance', unit: 'dist' },
  { id: GOAL_TYPE.MAX_WORKOUT_DURATION, label: 'Max Workout Time', unit: 'time' },
  { id: GOAL_TYPE.TOTAL_VOLUME, label: 'Total Volume', unit: 'weight' },
  { id: GOAL_TYPE.TOTAL_REPS, label: 'Total Reps', unit: 'reps' },
  { id: GOAL_TYPE.TOTAL_DISTANCE, label: 'Total Distance', unit: 'dist' },
  { id: GOAL_TYPE.TOTAL_DURATION, label: 'Total Time', unit: 'time' },
];

export const goalTypeLabel = (id: number): string =>
  GOAL_TYPE_OPTIONS.find(o => o.id === id)?.label ?? 'Goal';

export const goalUnit = (id: number): GoalUnit =>
  GOAL_TYPE_OPTIONS.find(o => o.id === id)?.unit ?? 'weight';

// The goal's target as a single number in the unit implied by its type.
export const goalTargetValue = (g: Goal): number =>
  goalUnit(g.type_id) === 'reps' ? (g.reps ?? 0) : (g.metric_weight ?? 0);

// Current best value for a goal, computed from the exercise's full log history
// (drives the progress bar and completion state).
export const goalCurrentValue = (g: Goal, allLogs: TrainingLog[]): number => {
  const logs = allLogs.filter(l => l.exercise_id === g.exercise_id && !l.is_deleted);
  if (logs.length === 0) return 0;
  const byDate: Record<string, { vol: number; reps: number; dist: number; dur: number }> = {};
  let totVol = 0, totReps = 0, totDist = 0, totDur = 0, maxW = 0, maxR = 0, maxDist = 0, maxDur = 0, maxSetVol = 0, bestE1rm = 0;
  for (const l of logs) {
    const w = l.metric_weight ?? 0, r = l.reps ?? 0, d = l.distance ?? 0, t = l.duration_seconds ?? 0;
    totVol += w * r; totReps += r; totDist += d; totDur += t;
    maxW = Math.max(maxW, w); maxR = Math.max(maxR, r); maxDist = Math.max(maxDist, d); maxDur = Math.max(maxDur, t);
    maxSetVol = Math.max(maxSetVol, w * r);
    if (r >= 1 && r <= 15) bestE1rm = Math.max(bestE1rm, w * (1 + r / 30));
    const a = byDate[l.date] || (byDate[l.date] = { vol: 0, reps: 0, dist: 0, dur: 0 });
    a.vol += w * r; a.reps += r; a.dist += d; a.dur += t;
  }
  const sess = Object.values(byDate);
  const maxSess = (k: 'vol' | 'reps' | 'dist' | 'dur') => Math.max(0, ...sess.map(s => s[k]));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  switch (g.type_id) {
    case GOAL_TYPE.MAX_WEIGHT: case GOAL_TYPE.MAX_WEIGHT_FOR_REPS: return maxW;
    case GOAL_TYPE.ESTIMATED_1RM: return Math.round(bestE1rm);
    case GOAL_TYPE.MAX_VOLUME: return r2(maxSetVol);
    case GOAL_TYPE.MAX_REPS: return maxR;
    case GOAL_TYPE.MAX_DISTANCE: return r2(maxDist);
    case GOAL_TYPE.MAX_DURATION: return maxDur;
    case GOAL_TYPE.MAX_WORKOUT_VOLUME: return r2(maxSess('vol'));
    case GOAL_TYPE.MAX_WORKOUT_REPS: return maxSess('reps');
    case GOAL_TYPE.MAX_WORKOUT_DISTANCE: return r2(maxSess('dist'));
    case GOAL_TYPE.MAX_WORKOUT_DURATION: return maxSess('dur');
    case GOAL_TYPE.TOTAL_VOLUME: return r2(totVol);
    case GOAL_TYPE.TOTAL_REPS: return totReps;
    case GOAL_TYPE.TOTAL_DISTANCE: return r2(totDist);
    case GOAL_TYPE.TOTAL_DURATION: return totDur;
    default: return 0;
  }
};
