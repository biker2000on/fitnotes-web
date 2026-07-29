import { describe, expect, it } from 'vitest';
import type { Exercise, Goal, TrainingLog } from '../types';
import { GOAL_TYPE } from '../types';
import { needsAttention } from './attention';

const TODAY = '2026-07-29';

const exercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'ex-1',
  name: 'Barbell Squat',
  category_id: null,
  exercise_type_id: 0,
  is_favourite: false,
  primary_muscles: 'Quads',
  ...overrides,
});

let logSeq = 0;
const log = (overrides: Partial<TrainingLog> = {}): TrainingLog => ({
  id: `log-${++logSeq}`,
  exercise_id: 'ex-1',
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

const goal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 'goal-1',
  type_id: GOAL_TYPE.MAX_WEIGHT,
  exercise_id: 'ex-1',
  metric_weight: 200,
  reps: null,
  unit: 1,
  title: null,
  target_date: '2026-08-05',
  sort_order: 0,
  distance: null,
  duration_seconds: null,
  start_date: '2026-06-01',
  ...overrides,
});

const run = (logs: TrainingLog[], exercises: Exercise[], goals: Goal[] = []) =>
  needsAttention({
    allLogs: logs,
    exercises,
    goals,
    userUnit: 'kg',
    firstDay: 1,
    requireComplete: true,
    today: TODAY,
  });

describe('needsAttention', () => {
  it('flags a lift stalled at the same top weight for 4+ sessions', () => {
    // Four recent sessions at 100x5 with no rep improvement.
    const logs = ['2026-07-08', '2026-07-15', '2026-07-22', '2026-07-28']
      .map(date => log({ date }));
    const items = run(logs, [exercise()]);
    const stalledItem = items.find(i => i.kind === 'stalled');
    expect(stalledItem).toBeDefined();
    expect(stalledItem!.exerciseId).toBe('ex-1');
    expect(stalledItem!.title).toContain('Barbell Squat');
  });

  it('does not flag a lift that is progressing', () => {
    const logs = [
      log({ date: '2026-07-15', metric_weight: 100 }),
      log({ date: '2026-07-22', metric_weight: 102.5 }),
    ];
    expect(run(logs, [exercise()]).filter(i => i.kind === 'stalled')).toHaveLength(0);
  });

  it('flags unachieved goals due within 14 days but not achieved or distant ones', () => {
    const logs = [log({ date: '2026-07-22', metric_weight: 150 })];
    const items = run(logs, [exercise()], [
      goal({ id: 'due', target_date: '2026-08-05', metric_weight: 200 }),
      goal({ id: 'achieved', target_date: '2026-08-05', metric_weight: 140 }),
      goal({ id: 'far', target_date: '2026-10-01', metric_weight: 300 }),
      goal({ id: 'past', target_date: '2026-07-01', metric_weight: 300 }),
    ]);
    const deadlineItems = items.filter(i => i.kind === 'goal_deadline');
    expect(deadlineItems).toHaveLength(1);
    expect(deadlineItems[0].goalId).toBe('due');
    expect(deadlineItems[0].title).toContain('in 7 days');
  });

  it('flags muscles under the weekly volume band last week', () => {
    // 3 completed working quad sets in the week of Jul 20-26 (prior week).
    const logs = ['2026-07-20', '2026-07-21', '2026-07-22'].map(date => log({ date }));
    const items = run(logs, [exercise()]);
    const underItem = items.find(i => i.kind === 'under_volume');
    expect(underItem).toBeDefined();
    expect(underItem!.title).toContain('Quads');
  });

  it('flags a regular exercise not trained in 3+ weeks', () => {
    // Trained weekly through mid-June, then dropped (~6 weeks before today).
    const logs = ['2026-06-01', '2026-06-08', '2026-06-15'].map(date => log({ date }));
    const items = run(logs, [exercise()]);
    const neglectedItem = items.find(i => i.kind === 'neglected');
    expect(neglectedItem).toBeDefined();
    expect(neglectedItem!.title).toContain('not trained in 6 weeks');
  });

  it('ignores one-off exercises and long-abandoned ones', () => {
    const oneOff = [log({ date: '2026-06-15' })];
    expect(run(oneOff, [exercise()]).filter(i => i.kind === 'neglected')).toHaveLength(0);

    const abandoned = ['2026-01-05', '2026-01-12', '2026-01-19'].map(date => log({ date }));
    expect(run(abandoned, [exercise()]).filter(i => i.kind === 'neglected')).toHaveLength(0);
  });

  it('returns nothing for empty data', () => {
    expect(run([], [exercise()])).toHaveLength(0);
  });
});
