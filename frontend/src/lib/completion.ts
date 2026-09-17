import type { TrainingLog } from '../types';
import { getLocalDateString } from './date';

// Historical checkmarks and bulk completion are bookkeeping, not timing events.
// Normal edits preserve this field; undoing completion clears it.
export function withCompletion(log: TrainingLog, complete: boolean, now = new Date(), individual = true): TrainingLog {
  return {
    ...log,
    is_complete: complete,
    completed_at: complete && individual && log.date === getLocalDateString(now)
      ? now.toISOString() : null,
  };
}
