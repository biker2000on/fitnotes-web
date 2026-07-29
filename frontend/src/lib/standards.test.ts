import { describe, expect, it } from 'vitest';
import { latestBodyweightKg, matchLiftPattern, strengthStandard } from './standards';
import type { BodyWeight } from '../types';

describe('matchLiftPattern', () => {
  it('recognises the classic barbell lifts', () => {
    expect(matchLiftPattern('Barbell Squat')).toBe('squat');
    expect(matchLiftPattern('Back Squat')).toBe('squat');
    expect(matchLiftPattern('Flat Barbell Bench Press')).toBe('bench');
    expect(matchLiftPattern('Deadlift')).toBe('deadlift');
    expect(matchLiftPattern('Sumo Deadlift')).toBe('deadlift');
    expect(matchLiftPattern('Overhead Press')).toBe('press');
    expect(matchLiftPattern('Barbell Row')).toBe('row');
  });

  it('excludes variations with different leverages', () => {
    expect(matchLiftPattern('Front Squat')).toBeNull();
    expect(matchLiftPattern('Incline Bench Press')).toBeNull();
    expect(matchLiftPattern('Romanian Deadlift')).toBeNull();
    expect(matchLiftPattern('Smith Machine Squat')).toBeNull();
    expect(matchLiftPattern('Dumbbell Bench Press')).toBeNull();
    expect(matchLiftPattern('Goblet Squat')).toBeNull();
  });
});

describe('strengthStandard', () => {
  it('grades a lift against bodyweight multiples', () => {
    // 150kg squat at 80kg BW = 1.875x -> Advanced (needs 1.75, Elite at 2.5)
    const s = strengthStandard(150, 80, 'squat')!;
    expect(s.level).toBe('Advanced');
    expect(s.ratio).toBeCloseTo(1.88, 1);
    expect(s.nextLevel).toBe('Elite');
    expect(s.nextRatio).toBe(2.5);
    expect(s.progressToNext).toBeGreaterThan(0);
    expect(s.progressToNext).toBeLessThan(1);
  });

  it('caps at Elite and floors at Untrained', () => {
    expect(strengthStandard(300, 80, 'deadlift')!.level).toBe('Elite');
    expect(strengthStandard(300, 80, 'deadlift')!.nextLevel).toBeNull();
    expect(strengthStandard(300, 80, 'deadlift')!.progressToNext).toBe(1);
    expect(strengthStandard(30, 80, 'bench')!.level).toBe('Untrained');
  });

  it('returns null without valid inputs', () => {
    expect(strengthStandard(0, 80, 'squat')).toBeNull();
    expect(strengthStandard(100, 0, 'squat')).toBeNull();
  });
});

describe('latestBodyweightKg', () => {
  const bw = (overrides: Partial<BodyWeight>): BodyWeight => ({
    id: 'bw', date: '2026-07-01', body_weight_metric: 80, body_fat: null, ...overrides,
  });

  it('returns the most recent active record', () => {
    const result = latestBodyweightKg([
      bw({ id: 'a', date: '2026-07-01', body_weight_metric: 80 }),
      bw({ id: 'b', date: '2026-07-20', body_weight_metric: 82 }),
      bw({ id: 'c', date: '2026-07-25', body_weight_metric: 83, is_deleted: true }),
    ]);
    expect(result).toEqual({ weightKg: 82, date: '2026-07-20' });
  });

  it('returns null when there are no usable records', () => {
    expect(latestBodyweightKg([])).toBeNull();
    expect(latestBodyweightKg([bw({ body_weight_metric: 0 })])).toBeNull();
  });
});
