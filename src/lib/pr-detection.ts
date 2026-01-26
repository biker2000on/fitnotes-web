import { db } from '@/db';
import { trainingLogs } from '@/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { calculate1RM, calculateVolume } from './calculations';

/**
 * Result of personal record detection
 */
export interface PRResult {
  /** Is this the heaviest weight ever lifted for this exercise? */
  isMaxWeight: boolean;
  /** Is this the most reps ever performed for this exercise? */
  isMaxReps: boolean;
  /** Is this the highest volume (weight × reps) for this exercise? */
  isMaxVolume: boolean;
  /** Is this the highest estimated 1RM for this exercise? */
  isMax1RM: boolean;
  /** Is this a personal record by any metric? */
  isAnyPR: boolean;
}

/**
 * Detect if a new training log entry is a personal record
 *
 * Compares the new set against all previous sets for the same exercise
 * to determine if it's a PR by weight, volume, or estimated 1RM.
 *
 * @param exerciseId - ID of the exercise
 * @param date - Workout date (YYYY-MM-DD format)
 * @param weight - Weight lifted in grams
 * @param reps - Number of repetitions performed
 * @returns Object indicating which PR types were achieved
 */
export async function detectPersonalRecords(
  exerciseId: number,
  date: string,
  weight: number,
  reps: number
): Promise<PRResult> {
  // Get all previous logs for this exercise before this date
  const previousLogs = await db.query.trainingLogs.findMany({
    where: and(
      eq(trainingLogs.exerciseId, exerciseId),
      lt(trainingLogs.workoutDate, date)
    ),
  });

  const currentVolume = calculateVolume(weight, reps);
  const current1RM = calculate1RM(weight, reps);

  let maxWeight = 0;
  let maxReps = 0;
  let maxVolume = 0;
  let max1RM = 0;

  // Find the maximum values from previous workouts
  for (const log of previousLogs) {
    if (log.metricWeight > maxWeight) maxWeight = log.metricWeight;
    if (log.reps > maxReps) maxReps = log.reps;

    const volume = calculateVolume(log.metricWeight, log.reps);
    if (volume > maxVolume) maxVolume = volume;

    const oneRM = calculate1RM(log.metricWeight, log.reps);
    if (oneRM > max1RM) max1RM = oneRM;
  }

  const isMaxWeight = weight > maxWeight;
  const isMaxReps = reps > maxReps;
  const isMaxVolume = currentVolume > maxVolume;
  const isMax1RM = current1RM > max1RM;

  return {
    isMaxWeight,
    isMaxReps,
    isMaxVolume,
    isMax1RM,
    isAnyPR: isMaxWeight || isMaxVolume || isMax1RM,
  };
}

/**
 * Recalculate PR status for all training logs of a specific exercise
 *
 * This should be run when:
 * - A log is deleted
 * - Historical data is imported
 * - PR logic is updated
 *
 * @param exerciseId - ID of the exercise to recalculate PRs for
 */
export async function recalculateAllPRs(exerciseId: number): Promise<void> {
  // Get all logs for this exercise ordered by date
  const allLogs = await db.query.trainingLogs.findMany({
    where: eq(trainingLogs.exerciseId, exerciseId),
    orderBy: (logs, { asc }) => [asc(logs.workoutDate), asc(logs.id)],
  });

  let maxWeight = 0;
  let maxVolume = 0;
  let max1RM = 0;

  for (const log of allLogs) {
    const volume = calculateVolume(log.metricWeight, log.reps);
    const oneRM = calculate1RM(log.metricWeight, log.reps);

    const isNewPR = log.metricWeight > maxWeight || volume > maxVolume || oneRM > max1RM;
    const isFirst = maxWeight === 0;

    // Update the log's PR status
    await db.update(trainingLogs)
      .set({
        isPersonalRecord: isNewPR,
        isPersonalRecordFirst: isFirst && isNewPR,
      })
      .where(eq(trainingLogs.id, log.id));

    // Update max values after processing this log
    if (log.metricWeight > maxWeight) maxWeight = log.metricWeight;
    if (volume > maxVolume) maxVolume = volume;
    if (oneRM > max1RM) max1RM = oneRM;
  }
}
