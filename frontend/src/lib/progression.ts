// progression.ts - Progressive-overload suggestions computed from an
// exercise's training history: last-session ghost values, next-load
// recommendations (double progression), and plateau detection.
import type { Exercise, TrainingLog } from '../types';
import { typeHasReps, typeHasWeight } from './units';

export interface ProgressionSet {
  weight: number; // in the requested display unit
  reps: number;
}

export interface ProgressionSuggestion {
  kind: 'increase_weight' | 'increase_reps' | 'deload';
  message: string;
  suggestedWeight: number | null;
  suggestedReps: number | null;
  lastSessionDate: string;
  lastSessionSets: ProgressionSet[];
  stalledSessions: number;
}

const LBS_PER_KG = 2.20462;

// Reps every top-weight set must reach before recommending a weight increase.
const REP_TARGET_HIGH = 8;
// Consecutive same-top-weight sessions before we call it a plateau.
const PLATEAU_SESSIONS = 4;

const round1 = (n: number) => Math.round(n * 10) / 10;

// Convert a log's stored weight (recorded in its own unit) to the display unit.
const displayWeight = (log: TrainingLog, userUnit: 'kg' | 'lbs'): number | null => {
  if (log.metric_weight == null) return null;
  const loggedUnit = log.unit === 2 ? 'lbs' : 'kg';
  if (loggedUnit === userUnit) return round1(log.metric_weight);
  return round1(loggedUnit === 'kg' ? log.metric_weight * LBS_PER_KG : log.metric_weight / LBS_PER_KG);
};

const roundToIncrement = (value: number, increment: number) => {
  if (increment <= 0) return round1(value);
  return round1(Math.round(value / increment) * increment);
};

// Compute a progression suggestion for a weight+reps exercise from full log
// history. Returns null when the exercise type doesn't apply or there is no
// prior session before `beforeDate`.
export function getProgressionSuggestion(
  logs: TrainingLog[],
  exercise: Exercise,
  userUnit: 'kg' | 'lbs',
  beforeDate: string,
): ProgressionSuggestion | null {
  const t = exercise.exercise_type_id;
  if (!typeHasWeight(t) || !typeHasReps(t)) return null;

  // Working sets with real weight+reps, strictly before the date being logged.
  const relevant = logs.filter(l =>
    l.exercise_id === exercise.id
    && !l.is_deleted
    && l.date < beforeDate
    && l.metric_weight != null
    && l.reps != null
    && l.reps > 0
    && (l.set_type ?? 'working') !== 'warmup'
  );
  if (relevant.length === 0) return null;

  // Group into sessions by date, newest first.
  const byDate = new Map<string, TrainingLog[]>();
  for (const l of relevant) {
    (byDate.get(l.date) ?? byDate.set(l.date, []).get(l.date)!).push(l);
  }
  const sessions = [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 8)
    .map(([date, sessionLogs]) => {
      const sets: ProgressionSet[] = sessionLogs
        .map(l => ({ weight: displayWeight(l, userUnit)!, reps: l.reps! }))
        .filter(s => s.weight != null);
      const topWeight = Math.max(...sets.map(s => s.weight));
      const topSets = sets.filter(s => Math.abs(s.weight - topWeight) < 0.01);
      return { date, sets, topWeight, topSets };
    });

  const last = sessions[0];
  if (!last || last.sets.length === 0) return null;

  const increment = exercise.weight_increment && exercise.weight_increment > 0
    ? exercise.weight_increment
    : (userUnit === 'kg' ? 2.5 : 5);

  // Plateau: consecutive sessions stuck at the same top weight without the
  // top-set rep total improving.
  let stalled = 1;
  for (let i = 1; i < sessions.length; i++) {
    const cur = sessions[i - 1];
    const prev = sessions[i];
    const sameWeight = Math.abs(cur.topWeight - prev.topWeight) < 0.01;
    const curReps = cur.topSets.reduce((s, x) => s + x.reps, 0);
    const prevReps = prev.topSets.reduce((s, x) => s + x.reps, 0);
    if (sameWeight && curReps <= prevReps) stalled += 1;
    else break;
  }

  const minTopReps = Math.min(...last.topSets.map(s => s.reps));
  const unitLabel = userUnit;
  const base = {
    lastSessionDate: last.date,
    lastSessionSets: last.sets,
    stalledSessions: stalled,
  };

  if (last.topSets.every(s => s.reps >= REP_TARGET_HIGH)) {
    const next = round1(last.topWeight + increment);
    return {
      ...base,
      kind: 'increase_weight',
      suggestedWeight: next,
      suggestedReps: null,
      message: `You hit ${REP_TARGET_HIGH}+ reps on every top set — time to add weight. Try ${next} ${unitLabel}.`,
    };
  }

  if (stalled >= PLATEAU_SESSIONS) {
    const deload = roundToIncrement(last.topWeight * 0.9, increment);
    return {
      ...base,
      kind: 'deload',
      suggestedWeight: deload,
      suggestedReps: null,
      message: `Stalled at ${round1(last.topWeight)} ${unitLabel} for ${stalled} sessions — consider a deload to ~${deload} ${unitLabel} or a variation.`,
    };
  }

  return {
    ...base,
    kind: 'increase_reps',
    suggestedWeight: round1(last.topWeight),
    suggestedReps: minTopReps + 1,
    message: `Beat last session: aim for ${minTopReps + 1}+ reps per set at ${round1(last.topWeight)} ${unitLabel}.`,
  };
}

// Compact "100×5, 100×5, 97.5×8" summary of a session's sets.
export function formatSessionSets(sets: ProgressionSet[]): string {
  return sets.map(s => `${s.weight}×${s.reps}`).join(', ');
}
