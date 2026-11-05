// units.ts - Unit conversions and exercise-type labels.

export const KG_PER_LB = 0.45359237;

export const kgToLbs = (kg: number): number => kg / KG_PER_LB;
export const lbsToKg = (lbs: number): number => lbs * KG_PER_LB;

// Stored weights carry their own unit code (1 = kg, 2 = lbs; anything else is
// FitNotes' kg default). Convert one into the user's display unit.
export const unitCodeFor = (unit: 'kg' | 'lbs'): 1 | 2 => (unit === 'kg' ? 1 : 2);

export const weightInUnit = (value: number, storedUnit: number | null | undefined, target: 'kg' | 'lbs'): number => {
  const from = storedUnit === 2 ? 'lbs' : 'kg';
  const converted = from === target ? value : from === 'kg' ? kgToLbs(value) : lbsToKg(value);
  return Math.round(converted * 10) / 10;
};

// Snap a weight to the nearest loadable step (e.g. 2.5 lb plates), so
// computed loads never come out as 12.3 or 2.27.
export const roundToIncrement = (value: number, increment: number): number => {
  if (!(increment > 0)) return Math.round(value * 10) / 10;
  return Math.round(Math.round(value / increment) * increment * 100) / 100;
};

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
