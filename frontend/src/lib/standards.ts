// standards.ts - Bodyweight-relative strength standards. Grades a lift's
// estimated 1RM (kg) against reference bands expressed as multiples of
// bodyweight, for the classic barbell patterns. Bands are simplified from
// commonly published strength-standard tables and are reference points, not
// competition classifications.
import type { BodyWeight } from '../types';

export type LiftPattern = 'squat' | 'bench' | 'deadlift' | 'press' | 'row';

export const STANDARD_LEVELS = ['Untrained', 'Novice', 'Intermediate', 'Advanced', 'Elite'] as const;
export type StandardLevel = (typeof STANDARD_LEVELS)[number];

// e1RM as a multiple of bodyweight required to reach
// [Novice, Intermediate, Advanced, Elite]; below the first band is Untrained.
const THRESHOLDS: Record<LiftPattern, [number, number, number, number]> = {
  squat: [0.75, 1.25, 1.75, 2.5],
  bench: [0.5, 1.0, 1.5, 2.0],
  deadlift: [1.0, 1.5, 2.25, 3.0],
  press: [0.35, 0.6, 0.9, 1.25],
  row: [0.5, 0.75, 1.0, 1.5],
};

export const PATTERN_DISPLAY: Record<LiftPattern, string> = {
  squat: 'back squat',
  bench: 'bench press',
  deadlift: 'deadlift',
  press: 'overhead press',
  row: 'barbell row',
};

// Match an exercise name to a barbell lift pattern the standards apply to.
// Variations with meaningfully different leverages (front squat, incline
// bench, Romanian deadlift, machine/dumbbell work) are excluded rather than
// graded against the wrong table.
export function matchLiftPattern(exerciseName: string): LiftPattern | null {
  const n = exerciseName.toLowerCase();
  const has = (re: RegExp) => re.test(n);
  if (has(/machine|smith|dumbbell|\bdb\b|kettlebell|cable|band/)) return null;
  if (has(/squat/) && !has(/front|split|bulgarian|goblet|hack|pistol|box|jump|overhead|sissy|belt/)) return 'squat';
  if (has(/bench press|flat bench/) && !has(/incline|decline|close[- ]grip|floor|pause/)) return 'bench';
  if (has(/deadlift/) && !has(/romanian|\brdl\b|stiff|straight[- ]leg|single|deficit|snatch/)) return 'deadlift';
  if (has(/overhead press|military press|shoulder press|strict press|standing press/)) return 'press';
  if (has(/barbell row|bent[- ]over row|pendlay row/)) return 'row';
  return null;
}

export interface StrengthStandard {
  pattern: LiftPattern;
  ratio: number; // e1RM / bodyweight
  level: StandardLevel;
  levelIndex: number; // 0 Untrained … 4 Elite
  nextLevel: StandardLevel | null;
  nextRatio: number | null; // BW multiple needed for the next level
  progressToNext: number; // 0..1 position within the current band
}

export function strengthStandard(
  e1rmKg: number,
  bodyweightKg: number,
  pattern: LiftPattern,
): StrengthStandard | null {
  if (!e1rmKg || !bodyweightKg || e1rmKg <= 0 || bodyweightKg <= 0) return null;
  const ratio = e1rmKg / bodyweightKg;
  const bands = THRESHOLDS[pattern];
  let levelIndex = 0;
  for (const band of bands) {
    if (ratio >= band) levelIndex += 1;
  }
  const nextRatio = levelIndex < bands.length ? bands[levelIndex] : null;
  const prevRatio = levelIndex === 0 ? 0 : bands[levelIndex - 1];
  const progressToNext = nextRatio === null
    ? 1
    : Math.max(0, Math.min(1, (ratio - prevRatio) / (nextRatio - prevRatio)));
  return {
    pattern,
    ratio: Math.round(ratio * 100) / 100,
    level: STANDARD_LEVELS[levelIndex],
    levelIndex,
    nextLevel: levelIndex < bands.length ? STANDARD_LEVELS[levelIndex + 1] : null,
    nextRatio,
    progressToNext: Math.round(progressToNext * 1000) / 1000,
  };
}

// Most recent active body-weight record (stored metric/kg).
export function latestBodyweightKg(
  bodyWeights: BodyWeight[],
): { weightKg: number; date: string } | null {
  let best: BodyWeight | null = null;
  for (const bw of bodyWeights) {
    if (bw.is_deleted || !(bw.body_weight_metric > 0)) continue;
    if (!best || bw.date > best.date) best = bw;
  }
  return best ? { weightKg: best.body_weight_metric, date: best.date } : null;
}
