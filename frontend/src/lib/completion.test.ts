import { describe, it, expect } from 'vitest';
import { withCompletion } from './completion';
import { getLocalDateString } from './date';
import type { TrainingLog } from '../types';

describe('completion timing', () => {
 const now = new Date(2026, 8, 15, 8, 30);
 const log = { id: 'set', date: getLocalDateString(now), is_complete: false } as TrainingLog;
 it('records an individual check and survives normal edits', () => {
  const checked = withCompletion(log, true, now);
  expect(checked.completed_at).toBe(now.toISOString());
  expect({ ...checked, reps: 12 }.completed_at).toBe(now.toISOString());
 });
 it('clears on undo and records a new time on recheck', () => {
  const checked = withCompletion(log, true, now);
  const undone = withCompletion(checked, false, now);
  expect(undone.completed_at).toBeNull();
  const later = new Date(now.getTime() + 60000);
  expect(withCompletion(undone, true, later).completed_at).toBe(later.toISOString());
 });
 it('does not invent timing for bulk or historical completion', () => {
  expect(withCompletion(log, true, now, false).completed_at).toBeNull();
  expect(withCompletion({ ...log, date: '2020-01-01' }, true, now).completed_at).toBeNull();
 });
});
