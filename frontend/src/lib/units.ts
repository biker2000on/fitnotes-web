// units.ts - Unit conversions and exercise-type labels.

export const KG_PER_LB = 0.45359237;

export const kgToLbs = (kg: number): number => kg / KG_PER_LB;
export const lbsToKg = (lbs: number): number => lbs * KG_PER_LB;

export const getExerciseTypeLabel = (typeId: number | string): string => {
  const id = Number(typeId);
  switch (id) {
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
export const typeHasWeight = (typeId: number | string): boolean => {
  const id = Number(typeId);
  return id === 0 || id === 6 || id === 7;
};

export const typeHasReps = (typeId: number | string): boolean => {
  const id = Number(typeId);
  return id === 0 || id === 2;
};

export const typeHasDistance = (typeId: number | string): boolean => {
  const id = Number(typeId);
  return id === 1 || id === 3 || id === 4 || id === 6;
};

export const typeHasDuration = (typeId: number | string): boolean => {
  const id = Number(typeId);
  return id === 1 || id === 3 || id === 5 || id === 7;
};
