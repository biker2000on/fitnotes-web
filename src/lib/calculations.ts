/**
 * Fitness calculation utilities for weight training metrics
 */

/**
 * Calculate estimated 1 Rep Max using Epley formula
 * Formula: 1RM = weight × (1 + reps/30)
 *
 * @param weight - Weight in grams
 * @param reps - Number of repetitions
 * @returns Estimated 1RM in grams, rounded to nearest integer
 */
export function calculate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps === 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Calculate volume (total weight moved)
 * Formula: Volume = weight × reps
 *
 * @param weight - Weight in grams
 * @param reps - Number of repetitions
 * @returns Volume in grams
 */
export function calculateVolume(weight: number, reps: number): number {
  return weight * reps;
}

/**
 * Convert grams to kilograms
 *
 * @param grams - Weight in grams
 * @returns Weight in kilograms
 */
export function gramsToKg(grams: number): number {
  return grams / 1000;
}

/**
 * Convert grams to pounds
 *
 * @param grams - Weight in grams
 * @returns Weight in pounds
 */
export function gramsToLbs(grams: number): number {
  return grams / 453.592;
}

/**
 * Convert kilograms to grams
 *
 * @param kg - Weight in kilograms
 * @returns Weight in grams, rounded to nearest integer
 */
export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}

/**
 * Convert pounds to grams
 *
 * @param lbs - Weight in pounds
 * @returns Weight in grams, rounded to nearest integer
 */
export function lbsToGrams(lbs: number): number {
  return Math.round(lbs * 453.592);
}
