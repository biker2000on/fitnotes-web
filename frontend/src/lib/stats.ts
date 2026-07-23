// stats.ts - Pure analytics over training logs: 1RM estimation, volume,
// personal records, and per-session summaries. Reused by the History/Records
// drawer, the Goals progress bars, and the Analysis graphs.

import type { Exercise, TrainingLog } from '../types';
import { ALL_MUSCLES, MUSCLE_DISPLAY, exerciseMuscleTargets, type MuscleKey } from './muscles';

// Epley estimated one-rep max. Single rep == the lifted weight itself.
export const estimated1RM = (weight: number, reps: number): number => {
  if (!weight || !reps || reps < 1) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
};

// Estimate a failure-equivalent 1RM by treating logged RIR (or 10 - RPE) as
// additional reps the lifter could have completed. Explicit RIR wins when both
// values are present. Without effort data this is identical to estimated1RM.
export const rpeAdjustedEstimated1RM = (
  weight: number,
  reps: number,
  rpe?: number | null,
  rir?: number | null,
): number => {
  if (!weight || !reps || reps < 1) return 0;
  const validRir = Number.isFinite(rir) && Number(rir) >= 0 && Number(rir) <= 10;
  const validRpe = Number.isFinite(rpe) && Number(rpe) >= 1 && Number(rpe) <= 10;
  const reserve = validRir
    ? Number(rir)
    : validRpe
      ? 10 - Number(rpe)
      : 0;
  const effectiveReps = reps + Math.max(0, Math.min(10, reserve));
  return effectiveReps <= 1 ? weight : weight * (1 + effectiveReps / 30);
};

// Volume of a single weight/reps set.
export const setVolume = (log: TrainingLog): number => {
  const w = log.metric_weight ?? 0;
  const r = log.reps ?? 0;
  return w * r;
};

export interface ActualRecord {
  reps: number;
  weight: number;
  date: string;
  logId: string;
}

export interface ExerciseRecords {
  // Best weight achieved at each rep count (actual personal records).
  byReps: ActualRecord[];
  maxWeight: { weight: number; reps: number; date: string } | null;
  maxReps: { reps: number; weight: number; date: string } | null;
  maxSetVolume: { volume: number; date: string } | null;
  bestEstimated1RM: { value: number; weight: number; reps: number; date: string } | null;
}

const activeWeightLogs = (logs: TrainingLog[]): TrainingLog[] =>
  logs.filter(l => !l.is_deleted && (l.metric_weight ?? 0) > 0 && (l.reps ?? 0) > 0);

// Compute personal records for a single exercise's logs.
// maxRepsToInclude bounds which sets count toward the estimated 1RM (FitNotes setting).
export const personalRecords = (
  logs: TrainingLog[],
  maxRepsToInclude = 10,
): ExerciseRecords => {
  const records: ExerciseRecords = {
    byReps: [],
    maxWeight: null,
    maxReps: null,
    maxSetVolume: null,
    bestEstimated1RM: null,
  };

  const bestByReps = new Map<number, ActualRecord>();

  for (const log of activeWeightLogs(logs)) {
    const weight = log.metric_weight as number;
    const reps = log.reps as number;
    const date = log.date;

    const existing = bestByReps.get(reps);
    if (!existing || weight > existing.weight) {
      bestByReps.set(reps, { reps, weight, date, logId: log.id });
    }

    if (!records.maxWeight || weight > records.maxWeight.weight) {
      records.maxWeight = { weight, reps, date };
    }
    if (!records.maxReps || reps > records.maxReps.reps) {
      records.maxReps = { reps, weight, date };
    }
    const vol = weight * reps;
    if (!records.maxSetVolume || vol > records.maxSetVolume.volume) {
      records.maxSetVolume = { volume: vol, date };
    }
    if (reps <= maxRepsToInclude) {
      const e = estimated1RM(weight, reps);
      if (!records.bestEstimated1RM || e > records.bestEstimated1RM.value) {
        records.bestEstimated1RM = { value: e, weight, reps, date };
      }
    }
  }

  records.byReps = Array.from(bestByReps.values()).sort((a, b) => a.reps - b.reps);
  return records;
};

export interface SessionSummary {
  date: string;
  sets: number;
  totalReps: number;
  totalVolume: number;
  maxWeight: number;
  bestEstimated1RM: number;
  logs: TrainingLog[];
}

// Group an exercise's logs by date (newest first) with per-session aggregates.
export const sessionSummaries = (
  logs: TrainingLog[],
  maxRepsToInclude = 10,
): SessionSummary[] => {
  const byDate = new Map<string, TrainingLog[]>();
  for (const log of logs) {
    if (log.is_deleted) continue;
    const arr = byDate.get(log.date) ?? [];
    arr.push(log);
    byDate.set(log.date, arr);
  }

  const summaries: SessionSummary[] = [];
  for (const [date, dateLogs] of byDate) {
    let totalReps = 0;
    let totalVolume = 0;
    let maxWeight = 0;
    let bestE1RM = 0;
    for (const l of dateLogs) {
      const w = l.metric_weight ?? 0;
      const r = l.reps ?? 0;
      totalReps += r;
      totalVolume += w * r;
      if (w > maxWeight) maxWeight = w;
      if (r <= maxRepsToInclude) {
        const e = estimated1RM(w, r);
        if (e > bestE1RM) bestE1RM = e;
      }
    }
    summaries.push({
      date,
      sets: dateLogs.length,
      totalReps,
      totalVolume,
      maxWeight,
      bestEstimated1RM: bestE1RM,
      logs: dateLogs,
    });
  }

  return summaries.sort((a, b) => b.date.localeCompare(a.date));
};

export interface GraphPoint {
  date: string;
  maxWeight: number;
  estimated1RM: number;
  volume: number;
  maxReps: number;
  totalReps: number;
  maxDistance: number;
  totalDistance: number;
  maxDuration: number;
  totalDuration: number;
}

// Chronological (oldest -> newest) per-session series for charting.
export const exerciseGraphSeries = (
  logs: TrainingLog[],
  maxRepsToInclude = 10,
): GraphPoint[] => {
  const byDate = new Map<string, TrainingLog[]>();
  for (const l of logs) {
    if (l.is_deleted) continue;
    const arr = byDate.get(l.date) ?? [];
    arr.push(l);
    byDate.set(l.date, arr);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const out: GraphPoint[] = [];
  for (const [date, dl] of byDate) {
    let maxWeight = 0, e1rm = 0, volume = 0, maxReps = 0, totalReps = 0, maxDist = 0, totalDist = 0, maxDur = 0, totalDur = 0;
    for (const l of dl) {
      const w = l.metric_weight ?? 0, reps = l.reps ?? 0, dist = l.distance ?? 0, dur = l.duration_seconds ?? 0;
      maxWeight = Math.max(maxWeight, w);
      volume += w * reps;
      maxReps = Math.max(maxReps, reps);
      totalReps += reps;
      maxDist = Math.max(maxDist, dist);
      totalDist += dist;
      maxDur = Math.max(maxDur, dur);
      totalDur += dur;
      if (reps <= maxRepsToInclude) e1rm = Math.max(e1rm, estimated1RM(w, reps));
    }
    out.push({ date, maxWeight: r2(maxWeight), estimated1RM: r2(e1rm), volume: r2(volume), maxReps, totalReps, maxDistance: r2(maxDist), totalDistance: r2(totalDist), maxDuration: maxDur, totalDuration: totalDur });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
};

// --- Breakdown (analysis) ---
export type BreakdownMetric = 'sets' | 'reps' | 'volume' | 'workouts';
export type BreakdownPeriod = 'week' | 'month' | 'year' | 'all';

export const periodStart = (period: BreakdownPeriod): string => {
  const d = new Date();
  if (period === 'week') d.setDate(d.getDate() - 7);
  else if (period === 'month') {
    // Go back one calendar month, clamping the day so e.g. May 31 → Apr 30 (not May 1).
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    const lastDayOfPrevMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDayOfPrevMonth));
  }
  else if (period === 'year') d.setFullYear(d.getFullYear() - 1);
  else return '0000-01-01';
  return d.toISOString().split('T')[0];
};

export interface BreakdownRow { key: string; value: number; }

// Aggregate logs into breakdown rows keyed by a grouping function.
export const breakdown = (
  logs: TrainingLog[],
  keyOf: (l: TrainingLog) => string,
  metric: BreakdownMetric,
  fromDate: string,
): BreakdownRow[] => {
  const acc = new Map<string, number>();
  const workoutDays = new Map<string, Set<string>>();
  for (const l of logs) {
    if (l.is_deleted || l.date < fromDate) continue;
    const k = keyOf(l);
    if (k === '') continue;
    if (metric === 'workouts') {
      const set = workoutDays.get(k) ?? new Set<string>();
      set.add(l.date);
      workoutDays.set(k, set);
    } else {
      const inc = metric === 'sets' ? 1 : metric === 'reps' ? (l.reps ?? 0) : (l.metric_weight ?? 0) * (l.reps ?? 0);
      acc.set(k, (acc.get(k) ?? 0) + inc);
    }
  }
  const rows: BreakdownRow[] = metric === 'workouts'
    ? Array.from(workoutDays.entries()).map(([key, days]) => ({ key, value: days.size }))
    : Array.from(acc.entries()).map(([key, value]) => ({ key, value: Math.round(value * 100) / 100 }));
  return rows.filter(r => r.value > 0).sort((a, b) => b.value - a.value);
};

// --- Workout graphs: aggregate ALL logs by calendar period ---
export type WorkoutGroupBy = 'week' | 'month' | 'year';

const periodKey = (date: string, by: WorkoutGroupBy): string => {
  const d = new Date(date + 'T00:00:00');
  if (by === 'year') return String(d.getFullYear());
  if (by === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  // Week bucket keyed by the date of that week's Monday — sorts chronologically
  // and groups correctly across year boundaries (unlike a naive week number).
  const dayOfWeek = (d.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayOfWeek);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
};

export interface WorkoutPoint { period: string; sets: number; reps: number; volume: number; durationMin: number; workouts: number; }

export const workoutGraphSeries = (logs: TrainingLog[], by: WorkoutGroupBy): WorkoutPoint[] => {
  const m = new Map<string, WorkoutPoint & { _days: Set<string> }>();
  for (const l of logs) {
    if (l.is_deleted) continue;
    const k = periodKey(l.date, by);
    const p = m.get(k) || { period: k, sets: 0, reps: 0, volume: 0, durationMin: 0, workouts: 0, _days: new Set<string>() };
    p.sets += 1;
    p.reps += l.reps ?? 0;
    p.volume += (l.metric_weight ?? 0) * (l.reps ?? 0);
    p.durationMin += (l.duration_seconds ?? 0) / 60;
    p._days.add(l.date);
    m.set(k, p);
  }
  return Array.from(m.values())
    .map(p => ({ period: p.period, sets: p.sets, reps: p.reps, volume: Math.round(p.volume), durationMin: Math.round(p.durationMin), workouts: p._days.size }))
    .sort((a, b) => a.period.localeCompare(b.period));
};

// --- Weekly muscle volume ---
export const MUSCLE_VOLUME_TARGET_MIN = 10;
export const MUSCLE_VOLUME_TARGET_MAX = 20;
export const SECONDARY_MUSCLE_SET_WEIGHT = 0.5;

export interface MuscleVolumeRow {
  muscle: MuscleKey;
  name: string;
  sets: number;
  previousSets: number;
  delta: number;
  targetMin: number;
  targetMax: number;
}

const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const startOfWeek = (date = new Date(), firstDay = 1): Date => {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (result.getDay() - firstDay + 7) % 7;
  result.setDate(result.getDate() - offset);
  return result;
};

export const weeklyMuscleVolume = (
  logs: TrainingLog[],
  exercises: Exercise[],
  weekStart = startOfWeek(),
  requireComplete = true,
): MuscleVolumeRow[] => {
  const currentStart = localDateKey(weekStart);
  const currentEndDate = new Date(weekStart);
  currentEndDate.setDate(currentEndDate.getDate() + 7);
  const currentEnd = localDateKey(currentEndDate);
  const previousStartDate = new Date(weekStart);
  previousStartDate.setDate(previousStartDate.getDate() - 7);
  const previousStart = localDateKey(previousStartDate);

  const exerciseMap = new Map(exercises.map(ex => [ex.id, ex]));
  const current = new Map<MuscleKey, number>();
  const previous = new Map<MuscleKey, number>();

  for (const log of logs) {
    if (log.is_deleted || (requireComplete && !log.is_complete) || (log.set_type && log.set_type !== 'working')) continue;
    const bucket = log.date >= currentStart && log.date < currentEnd
      ? current
      : log.date >= previousStart && log.date < currentStart
        ? previous
        : null;
    if (!bucket) continue;
    const exercise = exerciseMap.get(log.exercise_id);
    if (!exercise) continue;
    const targets = exerciseMuscleTargets(exercise);
    targets.primary.forEach(muscle => bucket.set(muscle, (bucket.get(muscle) ?? 0) + 1));
    targets.secondary.forEach(muscle => bucket.set(muscle, (bucket.get(muscle) ?? 0) + SECONDARY_MUSCLE_SET_WEIGHT));
  }

  const r1 = (value: number) => Math.round(value * 10) / 10;
  return ALL_MUSCLES
    .map(muscle => {
      const sets = r1(current.get(muscle) ?? 0);
      const previousSets = r1(previous.get(muscle) ?? 0);
      return {
        muscle,
        name: MUSCLE_DISPLAY[muscle],
        sets,
        previousSets,
        delta: r1(sets - previousSets),
        targetMin: MUSCLE_VOLUME_TARGET_MIN,
        targetMax: MUSCLE_VOLUME_TARGET_MAX,
      };
    })
    .filter(row => row.sets > 0 || row.previousSets > 0)
    .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name));
};

// --- Combined strength analytics ---
export interface StrengthPoint {
  date: string;
  estimated1RM: number;
  adjusted1RM: number;
  maxWeight: number;
  averageRpe: number | null;
  isPR: boolean;
}

export interface StrengthPREvent {
  id: string;
  date: string;
  weight: number;
  reps: number;
  estimated1RM: number;
  adjusted1RM: number;
  rpe: number | null;
  rir: number | null;
  kinds: Array<'rep' | 'e1rm'>;
}

const LBS_PER_KG = 2.20462;

// Training logs retain the unit used when they were entered. Normalize before
// comparing records so a historical pounds set is not compared numerically to
// a kilograms set.
const strengthWeightKg = (log: TrainingLog): number =>
  (log.metric_weight as number) / (log.unit === 2 ? LBS_PER_KG : 1);

const effortRpe = (log: TrainingLog): number | null => {
  if (Number.isFinite(log.rpe) && Number(log.rpe) >= 1 && Number(log.rpe) <= 10) return Number(log.rpe);
  if (Number.isFinite(log.rir) && Number(log.rir) >= 0 && Number(log.rir) <= 10) return 10 - Number(log.rir);
  return null;
};

export const strengthAnalytics = (
  logs: TrainingLog[],
  maxRepsToInclude = 10,
  requireComplete = true,
): { series: StrengthPoint[]; timeline: StrengthPREvent[]; repMaxGrid: ActualRecord[] } => {
  const weighted = activeWeightLogs(logs)
    .filter(log => (!requireComplete || log.is_complete) && (!log.set_type || log.set_type === 'working'))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const byDate = new Map<string, TrainingLog[]>();
  const bestByReps = new Map<number, ActualRecord>();
  const timeline: StrengthPREvent[] = [];
  let bestAdjusted = 0;

  for (const log of weighted) {
    const day = byDate.get(log.date) ?? [];
    day.push(log);
    byDate.set(log.date, day);
  }

  for (const [date, dayLogs] of byDate) {
    const dayBestByReps = new Map<number, TrainingLog>();
    let dayBestAdjusted: { log: TrainingLog; value: number } | null = null;
    const events = new Map<string, StrengthPREvent>();

    const addEvent = (log: TrainingLog, kind: StrengthPREvent['kinds'][number]) => {
      const existing = events.get(log.id);
      if (existing) {
        if (!existing.kinds.includes(kind)) existing.kinds.push(kind);
        return;
      }
      const weight = strengthWeightKg(log);
      const reps = log.reps as number;
      events.set(log.id, {
        id: log.id,
        date,
        weight,
        reps,
        estimated1RM: Math.round(estimated1RM(weight, reps) * 10) / 10,
        adjusted1RM: Math.round(rpeAdjustedEstimated1RM(weight, reps, log.rpe, log.rir) * 10) / 10,
        rpe: log.rpe ?? null,
        rir: log.rir ?? null,
        kinds: [kind],
      });
    };

    for (const log of dayLogs) {
      const reps = log.reps as number;
      const weight = strengthWeightKg(log);
      const currentRepBest = dayBestByReps.get(reps);
      const currentRepWeight = currentRepBest ? strengthWeightKg(currentRepBest) : 0;
      if (!currentRepBest || weight > currentRepWeight
        || (weight === currentRepWeight && log.id.localeCompare(currentRepBest.id) < 0)) {
        dayBestByReps.set(reps, log);
      }

      if (reps <= maxRepsToInclude) {
        const adjusted = rpeAdjustedEstimated1RM(weight, reps, log.rpe, log.rir);
        if (!dayBestAdjusted || adjusted > dayBestAdjusted.value
          || (adjusted === dayBestAdjusted.value && log.id.localeCompare(dayBestAdjusted.log.id) < 0)) {
          dayBestAdjusted = { log, value: adjusted };
        }
      }
    }

    for (const [reps, log] of dayBestByReps) {
      const weight = strengthWeightKg(log);
      const priorRep = bestByReps.get(reps);
      if (!priorRep || weight > priorRep.weight) {
        bestByReps.set(reps, { reps, weight, date, logId: log.id });
        addEvent(log, 'rep');
      }
    }

    if (dayBestAdjusted && dayBestAdjusted.value > bestAdjusted) {
      bestAdjusted = dayBestAdjusted.value;
      addEvent(dayBestAdjusted.log, 'e1rm');
    }

    timeline.push(...events.values());
  }

  let runningBest = 0;
  const series = Array.from(byDate.entries()).map(([date, dayLogs]) => {
    let raw = 0;
    let adjusted = 0;
    let maxWeight = 0;
    const rpes: number[] = [];
    dayLogs.forEach(log => {
      const weight = strengthWeightKg(log);
      const reps = log.reps ?? 0;
      maxWeight = Math.max(maxWeight, weight);
      if (reps <= maxRepsToInclude) {
        raw = Math.max(raw, estimated1RM(weight, reps));
        adjusted = Math.max(adjusted, rpeAdjustedEstimated1RM(weight, reps, log.rpe, log.rir));
      }
      const effort = effortRpe(log);
      if (effort !== null) rpes.push(effort);
    });
    const isPR = adjusted > runningBest;
    runningBest = Math.max(runningBest, adjusted);
    return {
      date,
      estimated1RM: Math.round(raw * 10) / 10,
      adjusted1RM: Math.round(adjusted * 10) / 10,
      maxWeight: Math.round(maxWeight * 10) / 10,
      averageRpe: rpes.length > 0 ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
      isPR,
    };
  }).filter(point => point.estimated1RM > 0);

  return {
    series,
    timeline: timeline.sort((a, b) => b.date.localeCompare(a.date)
      || b.adjusted1RM - a.adjusted1RM
      || b.weight - a.weight
      || a.reps - b.reps
      || a.id.localeCompare(b.id)),
    repMaxGrid: Array.from(bestByReps.values())
      .sort((a, b) => a.reps - b.reps),
  };
};
