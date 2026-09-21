import { describe, expect, it } from 'vitest';
import type { Exercise, TrainingLog } from '../types';
import {
  estimated1RM,
  personalRecords,
  sessionSummaries,
  exerciseGraphSeries,
  logWeightKg,
  rpeAdjustedEstimated1RM,
  strengthAnalytics,
  trainingDayTotals,
  weeklyMuscleVolume,
  weeklyStreaks,
} from './stats';

const exercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'exercise-1',
  name: 'Bench Press',
  category_id: null,
  exercise_type_id: 0,
  weight_unit_id: 1,
  is_favourite: false,
  primary_muscles: 'Chest',
  secondary_muscles: 'Triceps',
  ...overrides,
});

const log = (overrides: Partial<TrainingLog> = {}): TrainingLog => ({
  id: 'log-1',
  exercise_id: 'exercise-1',
  date: '2026-07-22',
  metric_weight: 100,
  reps: 5,
  unit: 1,
  is_personal_record: false,
  is_complete: true,
  distance: null,
  duration_seconds: null,
  set_type: 'working',
  ...overrides,
});

describe('exercise drawer weight units', () => {
  it('returns kilogram aggregates so pounds are converted only once for display', () => {
    const logs = [log({ metric_weight: 225, unit: 2, reps: 5 })];
    const records = personalRecords(logs);
    expect(records.maxWeight!.weight * 2.20462).toBeCloseTo(225);
    expect(records.maxReps!.weight * 2.20462).toBeCloseTo(225);
    expect(records.byReps[0].weight * 2.20462).toBeCloseTo(225);
    expect(records.bestEstimated1RM!.value * 2.20462).toBeCloseTo(262.5);
    expect(records.maxSetVolume!.volume * 2.20462).toBeCloseTo(1125);
    const session = sessionSummaries(logs)[0];
    expect(session.maxWeight * 2.20462).toBeCloseTo(225);
    expect(session.totalVolume * 2.20462).toBeCloseTo(1125);
    expect(session.bestEstimated1RM * 2.20462).toBeCloseTo(262.5);
    expect(session.logs[0]).toBe(logs[0]);
    const graph = exerciseGraphSeries(logs)[0];
    expect(graph.maxWeight * 2.20462).toBeCloseTo(225, 1);
    expect(graph.estimated1RM * 2.20462).toBeCloseTo(262.5, 1);
    expect(graph.volume * 2.20462).toBeCloseTo(1125, 1);
  });

  it('compares mixed-unit records by actual weight, preserving kg and legacy units', () => {
    const logs = [
      log({ id: 'pounds', metric_weight: 200, unit: 2 }),
      log({ id: 'kilograms', metric_weight: 100, unit: 1 }),
      log({ id: 'deleted', metric_weight: 500, unit: 1, is_deleted: true }),
    ];
    expect(personalRecords(logs).byReps[0]).toMatchObject({ logId: 'kilograms', weight: 100 });
    expect(sessionSummaries(logs)[0].maxWeight).toBe(100);
    expect(exerciseGraphSeries(logs)[0].maxWeight).toBe(100);
    expect(logWeightKg(log({ metric_weight: 100, unit: null }))).toBe(100);
    expect(logWeightKg(log({ metric_weight: null }))).toBe(0);
    expect(logWeightKg(log({ metric_weight: 225, reps: null, unit: 2 }))).toBeCloseTo(102.06, 2);
  });
});

describe('RPE-adjusted e1RM', () => {
  it('matches the normal estimate when effort data is absent', () => {
    expect(rpeAdjustedEstimated1RM(100, 5)).toBe(estimated1RM(100, 5));
  });

  it('uses explicit RIR ahead of RPE', () => {
    expect(rpeAdjustedEstimated1RM(100, 5, 8, 1)).toBeCloseTo(120);
    expect(rpeAdjustedEstimated1RM(100, 5, 8, null)).toBeCloseTo(100 * (1 + 7 / 30));
  });

  it('ignores invalid reserve estimates', () => {
    expect(rpeAdjustedEstimated1RM(100, 5, 12, null)).toBeCloseTo(estimated1RM(100, 5));
    expect(rpeAdjustedEstimated1RM(100, 5, 0, null)).toBeCloseTo(estimated1RM(100, 5));
    expect(rpeAdjustedEstimated1RM(100, 5, null, 99)).toBeCloseTo(estimated1RM(100, 5));
  });
});

describe('weekly muscle volume', () => {
  const weekStart = new Date(2026, 6, 20);

  it('counts primary sets fully, secondary sets by half, and compares the prior week', () => {
    const rows = weeklyMuscleVolume([
      log(),
      log({ id: 'log-2', date: '2026-07-23' }),
      log({ id: 'log-3', date: '2026-07-15' }),
    ], [exercise()], weekStart);

    expect(rows.find(row => row.name === 'Chest')).toMatchObject({ sets: 2, previousSets: 1, delta: 1 });
    expect(rows.find(row => row.name === 'Triceps')).toMatchObject({ sets: 1, previousSets: 0.5, delta: 0.5 });
  });

  it('excludes incomplete, warmup, deleted, and out-of-window sets', () => {
    const rows = weeklyMuscleVolume([
      log({ is_complete: false }),
      log({ id: 'log-2', set_type: 'warmup' }),
      log({ id: 'log-3', is_deleted: true }),
      log({ id: 'log-4', date: '2026-06-01' }),
    ], [exercise()], weekStart);

    expect(rows).toEqual([]);
  });

  it('counts incomplete logs when completion tracking is disabled', () => {
    const rows = weeklyMuscleVolume([
      log({ is_complete: false }),
    ], [exercise()], weekStart, false);

    expect(rows.find(row => row.name === 'Chest')?.sets).toBe(1);
  });
});

describe('combined strength analytics', () => {
  it('builds a rep grid, chronological series, and newest-first PR timeline', () => {
    const result = strengthAnalytics([
      log({ id: 'a', date: '2026-07-01', metric_weight: 100, reps: 5, rpe: 8 }),
      log({ id: 'b', date: '2026-07-08', metric_weight: 105, reps: 5, rir: 1 }),
      log({ id: 'c', date: '2026-07-15', metric_weight: 90, reps: 12 }),
      log({ id: 'planned', date: '2026-07-16', metric_weight: 200, reps: 5, is_complete: false }),
    ], 10);

    expect(result.series.map(point => point.date)).toEqual(['2026-07-01', '2026-07-08']);
    expect(result.series[1].adjusted1RM).toBeGreaterThan(result.series[1].estimated1RM);
    expect(result.repMaxGrid).toEqual([
      { reps: 5, weight: 105, date: '2026-07-08', logId: 'b' },
      { reps: 12, weight: 90, date: '2026-07-15', logId: 'c' },
    ]);
    expect(result.timeline[0].id).toBe('c');
    expect(result.timeline[0].kinds).toEqual(['rep']);
    expect(result.timeline.some(event => event.id === 'planned')).toBe(false);
  });

  it('uses the same daily PR maxima regardless of same-day log IDs', () => {
    const first = strengthAnalytics([
      log({ id: 'z-low', date: '2026-07-01', metric_weight: 100, reps: 5 }),
      log({ id: 'a-high', date: '2026-07-01', metric_weight: 110, reps: 5 }),
    ]);
    const reversedIds = strengthAnalytics([
      log({ id: 'a-low', date: '2026-07-01', metric_weight: 100, reps: 5 }),
      log({ id: 'z-high', date: '2026-07-01', metric_weight: 110, reps: 5 }),
    ]);

    expect(first.timeline).toHaveLength(1);
    expect(reversedIds.timeline).toHaveLength(1);
    expect(first.timeline[0]).toMatchObject({ weight: 110, reps: 5, kinds: ['rep', 'e1rm'] });
    expect(reversedIds.timeline[0]).toMatchObject({ weight: 110, reps: 5, kinds: ['rep', 'e1rm'] });
  });

  it('includes incomplete logs when completion tracking is disabled', () => {
    const result = strengthAnalytics([
      log({ id: 'planned', metric_weight: 120, reps: 5, is_complete: false }),
    ], 10, false);

    expect(result.series).toHaveLength(1);
    expect(result.repMaxGrid[0]).toMatchObject({ weight: 120, reps: 5 });
  });

  it('normalizes pounds and kilograms before comparing records', () => {
    const result = strengthAnalytics([
      log({ id: 'kg', date: '2026-07-01', metric_weight: 100, reps: 5, unit: 1 }),
      log({ id: 'lbs', date: '2026-07-08', metric_weight: 225, reps: 5, unit: 2 }),
    ]);

    expect(result.repMaxGrid[0].logId).toBe('lbs');
    expect(result.repMaxGrid[0].weight).toBeCloseTo(102.1, 1);
  });
});

describe('training consistency', () => {
  it('totals sets and volume per day, skipping deleted logs', () => {
    const totals = trainingDayTotals([
      log({ id: 'a', date: '2026-07-20', metric_weight: 100, reps: 5 }),
      log({ id: 'b', date: '2026-07-20', metric_weight: 100, reps: 3 }),
      log({ id: 'c', date: '2026-07-21', metric_weight: 80, reps: 10 }),
      log({ id: 'd', date: '2026-07-21', is_deleted: true }),
    ]);

    expect(totals.get('2026-07-20')).toEqual({ sets: 2, volume: 800 });
    expect(totals.get('2026-07-21')).toEqual({ sets: 1, volume: 800 });
  });

  it('counts weekly streaks with grace for the in-progress week', () => {
    // Weeks (Mon start): Jul 6, Jul 13, Jul 20 trained; nothing yet in the
    // week of Jul 27 — today is Wed Jul 29, so the streak should hold at 3.
    const stats = weeklyStreaks(
      ['2026-07-08', '2026-07-15', '2026-07-16', '2026-07-22'],
      1,
      new Date(2026, 6, 29),
    );

    expect(stats.trainingDays).toBe(4);
    expect(stats.weeksActive).toBe(3);
    expect(stats.currentStreakWeeks).toBe(3);
    expect(stats.longestStreakWeeks).toBe(3);
  });

  it('resets the run after a fully missed week but keeps the longest', () => {
    const stats = weeklyStreaks(
      ['2026-06-01', '2026-06-08', '2026-06-15', '2026-07-20'],
      1,
      new Date(2026, 6, 29),
    );

    expect(stats.longestStreakWeeks).toBe(3);
    // Only the week of Jul 20 counts toward the current streak.
    expect(stats.currentStreakWeeks).toBe(1);

    // With the last workout two-plus weeks back, the streak is fully broken.
    const stale = weeklyStreaks(['2026-07-06'], 1, new Date(2026, 6, 29));
    expect(stale.currentStreakWeeks).toBe(0);
  });

  it('handles no training history', () => {
    const stats = weeklyStreaks([], 1, new Date(2026, 6, 29));
    expect(stats).toEqual({ trainingDays: 0, weeksActive: 0, currentStreakWeeks: 0, longestStreakWeeks: 0 });
  });
});
