'use server';

import { db } from '@/db';
import { trainingLogs, exercises } from '@/db/schema';
import { eq, and, desc, asc, sql, gte, lte } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-utils';
import { calculate1RM, calculateVolume } from '@/lib/calculations';

export interface PRRecord {
  date: string;
  type: 'max_weight' | 'max_reps' | 'max_volume' | 'max_1rm';
  value: number;
  previousValue: number;
  weight: number;
  reps: number;
}

export interface ExerciseStats {
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  totalWorkouts: number;
  firstWorkoutDate: string | null;
  lastWorkoutDate: string | null;
  maxWeight: number;
  maxReps: number;
  max1RM: number;
  maxVolume: number;
  averageWeight: number;
  averageReps: number;
}

export interface ProgressDataPoint {
  date: string;
  maxWeight: number;
  totalVolume: number;
  estimated1RM: number;
  totalReps: number;
  totalSets: number;
}

export interface ExerciseOption {
  id: number;
  name: string;
}

/**
 * Get PR history for an exercise
 * Returns all personal records chronologically
 */
export async function getExercisePRs(exerciseId: number): Promise<PRRecord[]> {
  const user = await requireAuth();

  // Verify user owns this exercise
  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, exerciseId), eq(exercises.userId, user.id)),
  });

  if (!exercise) return [];

  // Get all logs for this exercise ordered by date
  const logs = await db.query.trainingLogs.findMany({
    where: eq(trainingLogs.exerciseId, exerciseId),
    orderBy: [asc(trainingLogs.workoutDate), asc(trainingLogs.id)],
  });

  const prs: PRRecord[] = [];
  let maxWeight = 0;
  let maxReps = 0;
  let maxVolume = 0;
  let max1RM = 0;

  for (const log of logs) {
    const volume = calculateVolume(log.metricWeight, log.reps);
    const oneRM = calculate1RM(log.metricWeight, log.reps);

    // Check for weight PR
    if (log.metricWeight > maxWeight) {
      prs.push({
        date: log.workoutDate,
        type: 'max_weight',
        value: log.metricWeight,
        previousValue: maxWeight,
        weight: log.metricWeight,
        reps: log.reps,
      });
      maxWeight = log.metricWeight;
    }

    // Check for reps PR
    if (log.reps > maxReps) {
      prs.push({
        date: log.workoutDate,
        type: 'max_reps',
        value: log.reps,
        previousValue: maxReps,
        weight: log.metricWeight,
        reps: log.reps,
      });
      maxReps = log.reps;
    }

    // Check for volume PR
    if (volume > maxVolume) {
      prs.push({
        date: log.workoutDate,
        type: 'max_volume',
        value: volume,
        previousValue: maxVolume,
        weight: log.metricWeight,
        reps: log.reps,
      });
      maxVolume = volume;
    }

    // Check for 1RM PR
    if (oneRM > max1RM) {
      prs.push({
        date: log.workoutDate,
        type: 'max_1rm',
        value: oneRM,
        previousValue: max1RM,
        weight: log.metricWeight,
        reps: log.reps,
      });
      max1RM = oneRM;
    }
  }

  return prs;
}

/**
 * Get all-time statistics for an exercise
 */
export async function getExerciseStats(exerciseId: number): Promise<ExerciseStats> {
  const user = await requireAuth();

  // Verify user owns this exercise
  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, exerciseId), eq(exercises.userId, user.id)),
  });

  if (!exercise) {
    return {
      totalSets: 0,
      totalReps: 0,
      totalVolume: 0,
      totalWorkouts: 0,
      firstWorkoutDate: null,
      lastWorkoutDate: null,
      maxWeight: 0,
      maxReps: 0,
      max1RM: 0,
      maxVolume: 0,
      averageWeight: 0,
      averageReps: 0,
    };
  }

  // Get all logs for this exercise
  const logs = await db.query.trainingLogs.findMany({
    where: eq(trainingLogs.exerciseId, exerciseId),
    orderBy: [asc(trainingLogs.workoutDate)],
  });

  if (logs.length === 0) {
    return {
      totalSets: 0,
      totalReps: 0,
      totalVolume: 0,
      totalWorkouts: 0,
      firstWorkoutDate: null,
      lastWorkoutDate: null,
      maxWeight: 0,
      maxReps: 0,
      max1RM: 0,
      maxVolume: 0,
      averageWeight: 0,
      averageReps: 0,
    };
  }

  // Calculate statistics
  let totalReps = 0;
  let totalVolume = 0;
  let maxWeight = 0;
  let maxReps = 0;
  let max1RM = 0;
  let maxVolume = 0;
  let totalWeight = 0;

  const workoutDates = new Set<string>();

  for (const log of logs) {
    totalReps += log.reps;
    totalWeight += log.metricWeight;

    const volume = calculateVolume(log.metricWeight, log.reps);
    totalVolume += volume;

    const oneRM = calculate1RM(log.metricWeight, log.reps);

    if (log.metricWeight > maxWeight) maxWeight = log.metricWeight;
    if (log.reps > maxReps) maxReps = log.reps;
    if (volume > maxVolume) maxVolume = volume;
    if (oneRM > max1RM) max1RM = oneRM;

    workoutDates.add(log.workoutDate);
  }

  return {
    totalSets: logs.length,
    totalReps,
    totalVolume,
    totalWorkouts: workoutDates.size,
    firstWorkoutDate: logs[0]?.workoutDate ?? null,
    lastWorkoutDate: logs[logs.length - 1]?.workoutDate ?? null,
    maxWeight,
    maxReps,
    max1RM,
    maxVolume,
    averageWeight: Math.round(totalWeight / logs.length),
    averageReps: Math.round(totalReps / logs.length),
  };
}

/**
 * Get progress data for charts
 * Returns data points grouped by date with key metrics
 */
export async function getExerciseProgressData(
  exerciseId: number,
  startDate?: string,
  endDate?: string
): Promise<ProgressDataPoint[]> {
  const user = await requireAuth();

  // Verify user owns this exercise
  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, exerciseId), eq(exercises.userId, user.id)),
  });

  if (!exercise) return [];

  const conditions = [eq(trainingLogs.exerciseId, exerciseId)];

  if (startDate) {
    conditions.push(gte(trainingLogs.workoutDate, startDate));
  }

  if (endDate) {
    conditions.push(lte(trainingLogs.workoutDate, endDate));
  }

  // Get all training logs for the exercise within the date range
  const logs = await db.query.trainingLogs.findMany({
    where: and(...conditions),
    orderBy: [asc(trainingLogs.workoutDate)],
  });

  // Group by date and calculate metrics
  const dataByDate = new Map<string, {
    maxWeight: number;
    totalVolume: number;
    maxEstimated1RM: number;
    totalReps: number;
    totalSets: number;
  }>();

  for (const log of logs) {
    const date = log.workoutDate;
    const weight = log.metricWeight;
    const reps = log.reps;
    const volume = calculateVolume(weight, reps);
    const estimated1RM = calculate1RM(weight, reps);

    if (!dataByDate.has(date)) {
      dataByDate.set(date, {
        maxWeight: weight,
        totalVolume: volume,
        maxEstimated1RM: estimated1RM,
        totalReps: reps,
        totalSets: 1,
      });
    } else {
      const existing = dataByDate.get(date)!;
      existing.maxWeight = Math.max(existing.maxWeight, weight);
      existing.totalVolume += volume;
      existing.maxEstimated1RM = Math.max(existing.maxEstimated1RM, estimated1RM);
      existing.totalReps += reps;
      existing.totalSets += 1;
    }
  }

  // Convert to array and format
  return Array.from(dataByDate.entries()).map(([date, data]) => ({
    date,
    maxWeight: data.maxWeight,
    totalVolume: data.totalVolume,
    estimated1RM: Math.round(data.maxEstimated1RM * 10) / 10,
    totalReps: data.totalReps,
    totalSets: data.totalSets,
  }));
}

/**
 * Get all exercises for the current user
 */
export async function getUserExercises(): Promise<ExerciseOption[]> {
  const user = await requireAuth();

  const userExercises = await db.query.exercises.findMany({
    where: eq(exercises.userId, user.id),
    orderBy: [asc(exercises.name)],
    columns: {
      id: true,
      name: true,
    },
  });

  return userExercises;
}
