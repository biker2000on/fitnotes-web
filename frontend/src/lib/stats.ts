// stats.ts - Pure analytics over training logs: 1RM estimation, volume,
// personal records, and per-session summaries. Reused by the History/Records
// drawer, the Goals progress bars, and the Analysis graphs.

import type { TrainingLog } from '../types';

// Epley estimated one-rep max. Single rep == the lifted weight itself.
export const estimated1RM = (weight: number, reps: number): number => {
  if (!weight || !reps || reps < 1) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
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
