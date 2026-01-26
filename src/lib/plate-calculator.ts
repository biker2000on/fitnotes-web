export interface PlateConfig {
  weight: number; // in grams
  count: number;
  color: string;
}

export interface PlateResult {
  plates: { weight: number; count: number; color: string }[];
  achievedWeight: number;
  remainder: number;
}

/**
 * Calculate the plates needed to achieve a target weight
 * Uses a greedy algorithm starting with the heaviest plates
 */
export function calculatePlates(
  targetWeight: number, // in grams
  barWeight: number, // in grams
  availablePlates: PlateConfig[]
): PlateResult {
  // Calculate weight needed per side
  const weightNeeded = targetWeight - barWeight;

  if (weightNeeded <= 0) {
    return {
      plates: [],
      achievedWeight: barWeight,
      remainder: 0
    };
  }

  const weightPerSide = weightNeeded / 2;

  // Sort plates by weight (heaviest first)
  const sortedPlates = [...availablePlates].sort((a, b) => b.weight - a.weight);

  const usedPlates: { weight: number; count: number; color: string }[] = [];
  let remainingWeight = weightPerSide;

  // Greedy algorithm: use heaviest plates first
  for (const plate of sortedPlates) {
    if (remainingWeight <= 0) break;
    if (plate.count === 0) continue;

    const platesNeeded = Math.min(
      Math.floor(remainingWeight / plate.weight),
      plate.count
    );

    if (platesNeeded > 0) {
      usedPlates.push({
        weight: plate.weight,
        count: platesNeeded,
        color: plate.color
      });
      remainingWeight -= platesNeeded * plate.weight;
    }
  }

  const achievedWeightPerSide = weightPerSide - remainingWeight;
  const achievedWeight = barWeight + (achievedWeightPerSide * 2);

  return {
    plates: usedPlates,
    achievedWeight,
    remainder: remainingWeight * 2 // Total remainder for both sides
  };
}

/**
 * Standard plate colors based on weight
 */
export function getPlateColor(weightInGrams: number, isMetric: boolean): string {
  if (isMetric) {
    // Metric colors
    if (weightInGrams >= 25000) return '#ef4444'; // red-500 - 25kg
    if (weightInGrams >= 20000) return '#3b82f6'; // blue-500 - 20kg
    if (weightInGrams >= 15000) return '#eab308'; // yellow-500 - 15kg
    if (weightInGrams >= 10000) return '#22c55e'; // green-500 - 10kg
    if (weightInGrams >= 5000) return '#f5f5f5';  // neutral-100 - 5kg
    if (weightInGrams >= 2500) return '#1f2937';  // gray-800 - 2.5kg
    return '#6b7280'; // gray-500 - 1.25kg
  } else {
    // Imperial colors
    if (weightInGrams >= 24948) return '#ef4444'; // red-500 - 55lbs
    if (weightInGrams >= 20412) return '#3b82f6'; // blue-500 - 45lbs
    if (weightInGrams >= 15876) return '#eab308'; // yellow-500 - 35lbs
    if (weightInGrams >= 11340) return '#22c55e'; // green-500 - 25lbs
    if (weightInGrams >= 4536) return '#f5f5f5';  // neutral-100 - 10lbs
    if (weightInGrams >= 2268) return '#1f2937';  // gray-800 - 5lbs
    return '#6b7280'; // gray-500 - 2.5lbs
  }
}

/**
 * Get default plate sets
 */
export function getDefaultPlateSet(isMetric: boolean): PlateConfig[] {
  if (isMetric) {
    return [
      { weight: 25000, count: 4, color: getPlateColor(25000, true) },
      { weight: 20000, count: 4, color: getPlateColor(20000, true) },
      { weight: 15000, count: 2, color: getPlateColor(15000, true) },
      { weight: 10000, count: 2, color: getPlateColor(10000, true) },
      { weight: 5000, count: 2, color: getPlateColor(5000, true) },
      { weight: 2500, count: 2, color: getPlateColor(2500, true) },
      { weight: 1250, count: 2, color: getPlateColor(1250, true) },
    ];
  } else {
    return [
      { weight: 24948, count: 4, color: getPlateColor(24948, false) }, // 55lbs
      { weight: 20412, count: 4, color: getPlateColor(20412, false) }, // 45lbs
      { weight: 15876, count: 2, color: getPlateColor(15876, false) }, // 35lbs
      { weight: 11340, count: 2, color: getPlateColor(11340, false) }, // 25lbs
      { weight: 4536, count: 2, color: getPlateColor(4536, false) },   // 10lbs
      { weight: 2268, count: 2, color: getPlateColor(2268, false) },   // 5lbs
      { weight: 1134, count: 2, color: getPlateColor(1134, false) },   // 2.5lbs
    ];
  }
}

/**
 * Convert grams to display unit (kg or lbs)
 */
export function formatWeight(grams: number, isMetric: boolean): string {
  if (isMetric) {
    return (grams / 1000).toFixed(2) + ' kg';
  } else {
    return (grams / 453.592).toFixed(2) + ' lbs';
  }
}

/**
 * Convert display unit to grams
 */
export function parseWeight(value: number, isMetric: boolean): number {
  if (isMetric) {
    return value * 1000;
  } else {
    return value * 453.592;
  }
}
