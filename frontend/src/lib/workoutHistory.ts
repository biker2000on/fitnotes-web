// workoutHistory.ts - Day-level aggregation and filtering shared by the
// calendar (month grid + weekly overviews) and the standalone History page.
import type { Exercise, TrainingLog, WorkoutRoutine } from '../types';

export interface DayStats {
  date: string;
  sets: number;
  exercises: number;
  /** Sum of weight x reps in kg; 0 for exercises that log no weight. */
  volume: number;
}

export interface DayChip {
  exerciseId: string;
  name: string;
  sets: number;
  color: string;
}

/**
 * Resolves a `kind:id` filter into the set of dates it matches, or null when no
 * filter is active. Matching days still render their entire log - the filter
 * selects days, it does not hide the other exercises logged on them.
 */
export function buildMatchingDates(
  filter: string,
  allLogs: TrainingLog[],
  exercises: Exercise[],
  workoutRoutines: WorkoutRoutine[],
): Set<string> | null {
  if (!filter) return null;
  const [kind, id] = filter.split(':');
  const dates = new Set<string>();

  if (kind === 'ex' || kind === 'cat') {
    for (const log of allLogs) {
      if (log.is_deleted) continue;
      if (kind === 'ex' && log.exercise_id !== id) continue;
      if (kind === 'cat' && exercises.find(e => e.id === log.exercise_id)?.category_id !== id) continue;
      dates.add(log.date);
    }
  } else if (kind === 'rt' || kind === 'rts') {
    for (const wr of workoutRoutines) {
      if (wr.is_deleted) continue;
      if (kind === 'rt' && wr.routine_id !== id) continue;
      if (kind === 'rts' && wr.routine_section_id !== id) continue;
      dates.add(wr.date);
    }
  }
  return dates;
}

export function buildDayStats(
  allLogs: TrainingLog[],
  matchingDates: Set<string> | null,
): Map<string, DayStats> {
  const byDate = new Map<string, { sets: number; exercises: Set<string>; volume: number }>();

  for (const log of allLogs) {
    if (log.is_deleted) continue;
    if (matchingDates !== null && !matchingDates.has(log.date)) continue;
    let entry = byDate.get(log.date);
    if (!entry) {
      entry = { sets: 0, exercises: new Set(), volume: 0 };
      byDate.set(log.date, entry);
    }
    entry.sets += 1;
    entry.exercises.add(log.exercise_id);
    entry.volume += (log.metric_weight ?? 0) * (log.reps ?? 0);
  }

  const stats = new Map<string, DayStats>();
  for (const [date, entry] of byDate) {
    stats.set(date, { date, sets: entry.sets, exercises: entry.exercises.size, volume: entry.volume });
  }
  return stats;
}

export interface MonthRange { start: number; end: number }
export interface ScrollMetrics { scrollTop: number; scrollHeight: number; clientHeight: number }

/** How close to an edge (px) the viewport must be before another month loads. */
export const MONTH_LOAD_EDGE = 320;

/**
 * Decides which month to load next for the continuously scrolling calendar.
 * Returns the range unchanged when neither edge is in reach or the bound has
 * been hit, so callers can bail out with an identity check.
 *
 * Kept pure so the paging rule is testable without a live scroll container.
 */
export function nextMonthRange(
  metrics: ScrollMetrics,
  range: MonthRange,
  bounds: { earliest: number; latest: number },
): { range: MonthRange; direction: 'earlier' | 'later' | null } {
  const distanceToBottom = metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight;

  if (metrics.scrollTop < MONTH_LOAD_EDGE && range.start > bounds.earliest) {
    return { range: { ...range, start: range.start - 1 }, direction: 'earlier' };
  }
  if (distanceToBottom < MONTH_LOAD_EDGE && range.end < bounds.latest) {
    return { range: { ...range, end: range.end + 1 }, direction: 'later' };
  }
  return { range, direction: null };
}

/** Formats a kg volume in the user's display unit, abbreviated past 10k. */
export function formatVolume(metricVolume: number, userUnit: 'kg' | 'lbs'): string {
  const converted = userUnit === 'lbs' ? metricVolume * 2.20462 : metricVolume;
  if (converted >= 10000) return `${(converted / 1000).toFixed(1)}k ${userUnit}`;
  return `${Math.round(converted).toLocaleString()} ${userUnit}`;
}
