import { describe, expect, it } from 'vitest';
import {
  buildDayStats,
  buildMatchingDates,
  formatVolume,
  nextMonthRange,
  MONTH_LOAD_EDGE,
} from './workoutHistory';
import type { Exercise, TrainingLog, WorkoutRoutine } from '../types';

const log = (over: Partial<TrainingLog>): TrainingLog => ({
  id: 'l1', exercise_id: 'ex1', date: '2026-08-01', metric_weight: 100, reps: 5,
  unit: 1, is_personal_record: false, is_complete: true, distance: null,
  duration_seconds: null, is_deleted: false, ...over,
} as TrainingLog);

describe('buildDayStats', () => {
  it('rolls sets, distinct exercises, and volume up per day', () => {
    const stats = buildDayStats([
      log({ id: 'a', date: '2026-08-01', exercise_id: 'ex1', metric_weight: 100, reps: 5 }),
      log({ id: 'b', date: '2026-08-01', exercise_id: 'ex1', metric_weight: 100, reps: 5 }),
      log({ id: 'c', date: '2026-08-01', exercise_id: 'ex2', metric_weight: 60, reps: 10 }),
      log({ id: 'd', date: '2026-08-02', exercise_id: 'ex1', metric_weight: 50, reps: 2 }),
    ], null);

    expect(stats.get('2026-08-01')).toEqual({ date: '2026-08-01', sets: 3, exercises: 2, volume: 1600 });
    expect(stats.get('2026-08-02')).toEqual({ date: '2026-08-02', sets: 1, exercises: 1, volume: 100 });
  });

  it('ignores deleted sets and treats missing weight or reps as zero volume', () => {
    const stats = buildDayStats([
      log({ id: 'a', date: '2026-08-01', is_deleted: true }),
      log({ id: 'b', date: '2026-08-01', metric_weight: null, reps: 12 }),
    ], null);

    expect(stats.get('2026-08-01')).toEqual({ date: '2026-08-01', sets: 1, exercises: 1, volume: 0 });
  });

  it('honours an active date filter', () => {
    const stats = buildDayStats([
      log({ id: 'a', date: '2026-08-01' }),
      log({ id: 'b', date: '2026-08-02' }),
    ], new Set(['2026-08-02']));

    expect([...stats.keys()]).toEqual(['2026-08-02']);
  });
});

describe('buildMatchingDates', () => {
  const exercises = [
    { id: 'ex1', category_id: 'cat1' },
    { id: 'ex2', category_id: 'cat2' },
  ] as Exercise[];
  const logs = [
    log({ id: 'a', date: '2026-08-01', exercise_id: 'ex1' }),
    log({ id: 'b', date: '2026-08-02', exercise_id: 'ex2' }),
  ];
  const routines = [
    { id: 'wr1', date: '2026-08-03', routine_id: 'r1', routine_section_id: 's1', is_deleted: false },
  ] as WorkoutRoutine[];

  it('returns null when no filter is active, meaning "every day"', () => {
    expect(buildMatchingDates('', logs, exercises, routines)).toBeNull();
  });

  it('matches by exercise, category, routine, and routine day', () => {
    expect([...buildMatchingDates('ex:ex1', logs, exercises, routines)!]).toEqual(['2026-08-01']);
    expect([...buildMatchingDates('cat:cat2', logs, exercises, routines)!]).toEqual(['2026-08-02']);
    expect([...buildMatchingDates('rt:r1', logs, exercises, routines)!]).toEqual(['2026-08-03']);
    expect([...buildMatchingDates('rts:s1', logs, exercises, routines)!]).toEqual(['2026-08-03']);
  });
});

describe('nextMonthRange', () => {
  const bounds = { earliest: 100, latest: 200 };
  const range = { start: 150, end: 160 };
  // A viewport with plenty of room above and below either edge.
  const middle = { scrollTop: 5000, scrollHeight: 20000, clientHeight: 800 };

  it('loads an earlier month when the viewport nears the top', () => {
    const result = nextMonthRange({ ...middle, scrollTop: MONTH_LOAD_EDGE - 1 }, range, bounds);
    expect(result.direction).toBe('earlier');
    expect(result.range).toEqual({ start: 149, end: 160 });
  });

  it('loads a later month when the viewport nears the bottom', () => {
    const result = nextMonthRange({ scrollTop: 19000, scrollHeight: 20000, clientHeight: 800 }, range, bounds);
    expect(result.direction).toBe('later');
    expect(result.range).toEqual({ start: 150, end: 161 });
  });

  it('does nothing in the middle of the scroll region', () => {
    const result = nextMonthRange(middle, range, bounds);
    expect(result.direction).toBeNull();
    expect(result.range).toBe(range);
  });

  it('stops at the bounds instead of paging forever', () => {
    const atFloor = nextMonthRange({ ...middle, scrollTop: 0 }, { start: 100, end: 160 }, bounds);
    expect(atFloor.direction).toBeNull();

    const atCeiling = nextMonthRange(
      { scrollTop: 19500, scrollHeight: 20000, clientHeight: 800 },
      { start: 150, end: 200 },
      bounds,
    );
    expect(atCeiling.direction).toBeNull();
  });

  it('prefers loading earlier when content is shorter than the viewport', () => {
    // Both edges qualify at once; history should win so the past fills in first.
    const result = nextMonthRange({ scrollTop: 0, scrollHeight: 400, clientHeight: 800 }, range, bounds);
    expect(result.direction).toBe('earlier');
  });
});

describe('formatVolume', () => {
  it('converts to the display unit and abbreviates past 10k', () => {
    expect(formatVolume(500, 'kg')).toBe('500 kg');
    expect(formatVolume(12000, 'kg')).toBe('12.0k kg');
    expect(formatVolume(100, 'lbs')).toBe('220 lbs');
  });
});
