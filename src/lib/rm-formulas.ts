export const formulas = {
  epley: (weight: number, reps: number) => weight * (1 + reps / 30),
  brzycki: (weight: number, reps: number) => weight * (36 / (37 - reps)),
  lombardi: (weight: number, reps: number) => weight * Math.pow(reps, 0.10),
  oconner: (weight: number, reps: number) => weight * (1 + reps / 40),
  mayhew: (weight: number, reps: number) => (100 * weight) / (52.2 + 41.9 * Math.exp(-0.055 * reps)),
};

export function calculateRepMax(oneRM: number, targetReps: number): number {
  // Reverse Epley formula: weight = 1RM / (1 + targetReps/30)
  return oneRM / (1 + targetReps / 30);
}

export function calculatePercentage(oneRM: number, percentage: number): number {
  return oneRM * (percentage / 100);
}

export function roundToNearest(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

export const suggestedRepsForPercentage: Record<number, string> = {
  100: '1',
  95: '2-3',
  90: '3-4',
  85: '5-6',
  80: '7-8',
  75: '8-10',
  70: '10-12',
  65: '12-15',
  60: '15-20',
  55: '20-25',
  50: '25+',
};
