// routinePlan.ts - One-line summaries of a routine exercise's planned sets,
// e.g. "3 × 8 · 45 lb" or "8, 6, 4 reps", in the user's unit.
import type { RoutineSectionExercise, RoutineSectionExerciseSet, RoutineSection } from '../types';
import { POPULATE_SETS_TYPE } from '../types';
import { typeHasDistance, typeHasDuration, typeHasReps, typeHasWeight, weightInUnit } from './units';

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? (s > 0 ? `${m}m ${s}s` : `${m}m`) : `${s}s`;
};

const repsLabel = (set: RoutineSectionExerciseSet): string | null => {
  if (set.reps) return String(set.reps);
  if (set.min_reps != null && set.max_reps != null) return `${set.min_reps}–${set.max_reps}`;
  if (set.min_reps != null || set.max_reps != null) return String(set.min_reps ?? set.max_reps);
  return null;
};

export function summarizePlan(
  link: Pick<RoutineSectionExercise, 'populate_sets_type'>,
  sets: RoutineSectionExerciseSet[],
  typeId: number,
  unit: 'kg' | 'lbs',
): string {
  if (link.populate_sets_type === POPULATE_SETS_TYPE.COPY_PREVIOUS_WORKOUT) return 'Repeats last time';
  if (link.populate_sets_type === POPULATE_SETS_TYPE.NONE) return 'Log as you go';
  if (sets.length === 0) return 'No sets planned';

  const reps = sets.map(repsLabel);
  const weights = sets.map(set => (typeHasWeight(typeId) && set.metric_weight ? weightInUnit(set.metric_weight, set.unit, unit) : null));
  const sameReps = reps.every(r => r === reps[0]);
  const sameWeight = weights.every(w => w === weights[0]);
  const parts: string[] = [];

  if (typeHasReps(typeId)) {
    if (sameReps && reps[0]) parts.push(`${sets.length} × ${reps[0]}`);
    else if (reps.some(Boolean)) parts.push(`${reps.map(r => r ?? '–').join(', ')} reps`);
    else parts.push(`${sets.length} set${sets.length === 1 ? '' : 's'}`);
  } else {
    parts.push(`${sets.length} set${sets.length === 1 ? '' : 's'}`);
  }
  if (weights.some(w => w != null)) {
    parts.push(sameWeight ? `${weights[0]} ${unit === 'kg' ? 'kg' : 'lb'}` : `${weights.filter(w => w != null).join('/')} ${unit === 'kg' ? 'kg' : 'lb'}`);
  }
  if (typeHasDuration(typeId) && sets[0].duration_seconds) parts.push(formatDuration(sets[0].duration_seconds));
  if (typeHasDistance(typeId) && sets[0].distance) parts.push(`${sets[0].distance} km`);
  return parts.join(' · ');
}

// The day to suggest next: the one after the most recently completed day,
// wrapping at the end; the first day when nothing has been done yet.
export function nextDayId(sections: RoutineSection[], lastDoneBySection: Record<string, string>): string | null {
  if (sections.length === 0) return null;
  let lastIndex = -1;
  let lastDate = '';
  sections.forEach((section, index) => {
    const date = lastDoneBySection[section.id];
    if (date && date >= lastDate) {
      lastDate = date;
      lastIndex = index;
    }
  });
  return sections[(lastIndex + 1) % sections.length].id;
}
