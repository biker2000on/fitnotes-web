// units.ts - Unit conversions and exercise-type labels.

export const KG_PER_LB = 0.45359237;

export const kgToLbs = (kg: number): number => kg / KG_PER_LB;
export const lbsToKg = (lbs: number): number => lbs * KG_PER_LB;

export const getExerciseTypeLabel = (typeId: number): string => {
  switch (typeId) {
    case 0: return 'Weight & Reps';
    case 1: return 'Distance & Time';
    case 2: return 'Reps Only';
    case 3: return 'Distance & Time';
    case 4: return 'Distance Only';
    case 5: return 'Time Only';
    case 6: return 'Weight & Distance';
    case 7: return 'Weight & Time';
    default: return 'Weight & Reps';
  }
};

// Whether a given exercise type tracks weight (used to decide which inputs/stats apply).
export const typeHasWeight = (typeId: number): boolean =>
  typeId === 0 || typeId === 6 || typeId === 7;

export const typeHasReps = (typeId: number): boolean =>
  typeId === 0 || typeId === 2;

export const typeHasDistance = (typeId: number): boolean =>
  typeId === 1 || typeId === 3 || typeId === 4 || typeId === 6;

export const typeHasDuration = (typeId: number): boolean =>
  typeId === 1 || typeId === 3 || typeId === 5 || typeId === 7;
