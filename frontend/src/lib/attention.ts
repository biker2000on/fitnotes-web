// attention.ts - "Needs attention" feed for the workout log home screen.
// Aggregates signals the app already computes elsewhere: stalled lifts
// (progression plateau detection), goals approaching their target date,
// muscle groups under their weekly volume band, and regular exercises that
// haven't been trained recently.
import type { Exercise, Goal, TrainingLog } from '../types';
import { addDays, getLocalDateString, parseLocalDate } from './date';
import { getProgressionSuggestion } from './progression';
import { goalCurrentValue, goalTargetValue, goalTypeLabel } from './goals';
import { startOfWeek, weeklyMuscleVolume } from './stats';
import type { MuscleKey } from './muscles';

export type AttentionKind = 'stalled' | 'goal_deadline' | 'under_volume' | 'neglected';

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  exerciseId?: string;
  goalId?: string;
  muscle?: MuscleKey;
}

// Exercises must have been trained this recently to be checked for a stall.
const STALL_RECENT_DAYS = 45;
// Days without a session before a regular exercise counts as neglected...
const NEGLECT_MIN_DAYS = 21;
// ...and the cap after which we stop nagging about it (assume it was dropped).
const NEGLECT_MAX_DAYS = 70;
// Distinct sessions in the 8 weeks before its last session for an exercise to
// count as "regular" (so one-off experiments aren't flagged).
const NEGLECT_MIN_SESSIONS = 3;
// Goal deadlines within this window are surfaced.
const GOAL_WINDOW_DAYS = 14;

const MAX_PER_KIND = 3;
const MAX_TOTAL = 8;

export interface AttentionOptions {
  allLogs: TrainingLog[];
  exercises: Exercise[];
  goals: Goal[];
  userUnit: 'kg' | 'lbs';
  firstDay: number; // 0 = Sunday … 6 = Saturday
  requireComplete: boolean;
  today?: string;
}

export function needsAttention({
  allLogs, exercises, goals, userUnit, firstDay, requireComplete,
  today = getLocalDateString(),
}: AttentionOptions): AttentionItem[] {
  const items: AttentionItem[] = [];
  const activeExercises = exercises.filter(ex => !ex.is_deleted);
  const exerciseById = new Map(activeExercises.map(ex => [ex.id, ex]));

  // Last training date per exercise from active weight+reps working sets.
  const lastDate = new Map<string, string>();
  const sessionDates = new Map<string, Set<string>>();
  for (const l of allLogs) {
    if (l.is_deleted || (l.set_type ?? 'working') === 'warmup') continue;
    if (!exerciseById.has(l.exercise_id)) continue;
    const prev = lastDate.get(l.exercise_id);
    if (!prev || l.date > prev) lastDate.set(l.exercise_id, l.date);
    const dates = sessionDates.get(l.exercise_id) ?? new Set<string>();
    dates.add(l.date);
    sessionDates.set(l.exercise_id, dates);
  }

  // 1. Stalled lifts: recently trained exercises whose progression suggestion
  // has escalated to a deload (4+ sessions stuck at the same top weight).
  const stalled: AttentionItem[] = [];
  const stallCutoff = addDays(today, -STALL_RECENT_DAYS);
  for (const ex of activeExercises) {
    const last = lastDate.get(ex.id);
    if (!last || last < stallCutoff) continue;
    const suggestion = getProgressionSuggestion(allLogs, ex, userUnit, addDays(today, 1));
    if (suggestion?.kind === 'deload') {
      stalled.push({
        id: `stalled:${ex.id}:${last}`,
        kind: 'stalled',
        title: `${ex.name} has stalled`,
        detail: suggestion.message,
        exerciseId: ex.id,
      });
    }
  }
  items.push(...stalled.slice(0, MAX_PER_KIND));

  // 2. Goals approaching their target date that aren't achieved yet.
  const deadlines: AttentionItem[] = [];
  for (const g of goals) {
    if (g.is_deleted || !g.target_date || g.target_date < today) continue;
    if (g.target_date > addDays(today, GOAL_WINDOW_DAYS)) continue;
    const target = goalTargetValue(g);
    if (target <= 0) continue;
    const current = goalCurrentValue(g, allLogs);
    if (current >= target) continue;
    const daysLeft = Math.round(
      (parseLocalDate(g.target_date).getTime() - parseLocalDate(today).getTime()) / 86400000,
    );
    const pct = Math.round((current / target) * 100);
    const exName = exerciseById.get(g.exercise_id)?.name ?? 'Unknown exercise';
    deadlines.push({
      id: `goal_deadline:${g.id}:${g.target_date}`,
      kind: 'goal_deadline',
      title: `${exName} goal due ${daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}`,
      detail: `${goalTypeLabel(g.type_id)}: ${Math.round(current * 100) / 100} of ${target} (${pct}%).`,
      goalId: g.id,
      exerciseId: g.exercise_id,
    });
  }
  deadlines.sort((a, b) => a.title.localeCompare(b.title));
  items.push(...deadlines.slice(0, MAX_PER_KIND));

  // 3. Muscle groups trained but under the weekly volume band last week.
  // The previous completed week is judged, not the in-progress one.
  const prevWeekStart = startOfWeek(parseLocalDate(today), firstDay);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const muscleRows = weeklyMuscleVolume(allLogs, activeExercises, prevWeekStart, requireComplete);
  const underVolume = muscleRows
    .filter(row => row.sets > 0 && row.sets < row.targetMin)
    .sort((a, b) => a.sets - b.sets)
    .slice(0, MAX_PER_KIND)
    .map((row): AttentionItem => ({
      id: `under_volume:${row.muscle}:${getLocalDateString(prevWeekStart)}`,
      kind: 'under_volume',
      title: `${row.name} volume under target`,
      detail: `${row.sets} set${row.sets === 1 ? '' : 's'} last week (target ${row.targetMin}–${row.targetMax}).`,
      muscle: row.muscle,
    }));
  items.push(...underVolume);

  // 4. Regular exercises that haven't been trained in 3+ weeks.
  const neglected: AttentionItem[] = [];
  const neglectNewest = addDays(today, -NEGLECT_MIN_DAYS);
  const neglectOldest = addDays(today, -NEGLECT_MAX_DAYS);
  for (const ex of activeExercises) {
    const last = lastDate.get(ex.id);
    if (!last || last > neglectNewest || last < neglectOldest) continue;
    const dates = sessionDates.get(ex.id) ?? new Set<string>();
    const windowStart = addDays(last, -56);
    let recentSessions = 0;
    for (const d of dates) if (d >= windowStart && d <= last) recentSessions += 1;
    if (recentSessions < NEGLECT_MIN_SESSIONS) continue;
    const weeks = Math.floor(
      (parseLocalDate(today).getTime() - parseLocalDate(last).getTime()) / (7 * 86400000),
    );
    neglected.push({
      id: `neglected:${ex.id}:${last}`,
      kind: 'neglected',
      title: `${ex.name} not trained in ${weeks} week${weeks === 1 ? '' : 's'}`,
      detail: `Last session ${last}.`,
      exerciseId: ex.id,
    });
  }
  neglected.sort((a, b) => a.title.localeCompare(b.title));
  items.push(...neglected.slice(0, MAX_PER_KIND));

  return items.slice(0, MAX_TOTAL);
}
