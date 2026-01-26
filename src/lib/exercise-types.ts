/**
 * Exercise type definitions
 * Each type determines which fields are tracked for sets
 */
export const EXERCISE_TYPES = [
  { id: 0, name: 'Weight & Reps', hasWeight: true, hasReps: true, hasDistance: false, hasTime: false },
  { id: 1, name: 'Weight & Distance', hasWeight: true, hasReps: false, hasDistance: true, hasTime: false },
  { id: 2, name: 'Weight & Time', hasWeight: true, hasReps: false, hasDistance: false, hasTime: true },
  { id: 3, name: 'Reps & Distance', hasWeight: false, hasReps: true, hasDistance: true, hasTime: false },
  { id: 4, name: 'Reps & Time', hasWeight: false, hasReps: true, hasDistance: false, hasTime: true },
  { id: 5, name: 'Distance & Time', hasWeight: false, hasReps: false, hasDistance: true, hasTime: true },
  { id: 6, name: 'Weight Only', hasWeight: true, hasReps: false, hasDistance: false, hasTime: false },
  { id: 7, name: 'Reps Only', hasWeight: false, hasReps: true, hasDistance: false, hasTime: false },
  { id: 8, name: 'Distance Only', hasWeight: false, hasReps: false, hasDistance: true, hasTime: false },
  { id: 9, name: 'Time Only', hasWeight: false, hasReps: false, hasDistance: false, hasTime: true },
] as const;

export type ExerciseTypeId = typeof EXERCISE_TYPES[number]['id'];

export function getExerciseType(id: number) {
  return EXERCISE_TYPES.find(t => t.id === id) ?? EXERCISE_TYPES[0];
}

export function getExerciseTypeFields(id: number) {
  const type = getExerciseType(id);
  return {
    hasWeight: type.hasWeight,
    hasReps: type.hasReps,
    hasDistance: type.hasDistance,
    hasTime: type.hasTime,
  };
}
