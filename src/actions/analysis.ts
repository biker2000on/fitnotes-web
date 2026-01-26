'use server';

import { requireAuth } from '@/lib/auth-utils';
import { db } from '@/db';
import { trainingLogs, exercises, categories } from '@/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export interface CategoryBreakdown {
  categoryId: number;
  categoryName: string;
  color: string;
  sets: number;
  reps: number;
  volume: number;
  percentage: number;
}

export interface ExerciseBreakdown {
  exerciseId: number;
  exerciseName: string;
  categoryColor: string;
  sets: number;
  reps: number;
  volume: number;
  percentage: number;
}

export interface WorkoutBreakdown {
  date: string;
  exerciseCount: number;
  setCount: number;
  totalVolume: number;
}

export interface MetricsSummary {
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  workoutCount: number;
  avgVolumePerWorkout: number;
}

/**
 * Get breakdown of workout data by category
 */
export async function getBreakdownByCategory(
  startDate?: string,
  endDate?: string
): Promise<CategoryBreakdown[]> {
  const user = await requireAuth();

  // Get user's exercises with categories
  const userExercises = await db.query.exercises.findMany({
    where: eq(exercises.userId, user.id),
    columns: { id: true, categoryId: true },
    with: {
      category: {
        columns: { id: true, name: true, color: true },
      },
    },
  });

  const exerciseIds = userExercises.map(e => e.id);
  if (exerciseIds.length === 0) return [];

  // Build date filter
  const dateFilters = [];
  if (startDate) dateFilters.push(gte(trainingLogs.workoutDate, startDate));
  if (endDate) dateFilters.push(lte(trainingLogs.workoutDate, endDate));

  // Get all training logs
  const logs = await db.query.trainingLogs.findMany({
    where: dateFilters.length > 0 ? and(...dateFilters) : undefined,
    columns: {
      exerciseId: true,
      metricWeight: true,
      reps: true,
    },
  });

  // Filter to user's exercises only
  const userLogs = logs.filter(log => exerciseIds.includes(log.exerciseId));

  // Map exercises to categories
  const exerciseCategoryMap = new Map(
    userExercises.map(e => [e.id, e.category])
  );

  // Aggregate by category
  const categoryStats = new Map<number, {
    name: string;
    color: string;
    sets: number;
    reps: number;
    volume: number;
  }>();

  let totalVolume = 0;

  for (const log of userLogs) {
    const category = exerciseCategoryMap.get(log.exerciseId);
    if (!category) continue;

    const volume = log.metricWeight * log.reps;
    totalVolume += volume;

    if (!categoryStats.has(category.id)) {
      categoryStats.set(category.id, {
        name: category.name,
        color: category.color,
        sets: 0,
        reps: 0,
        volume: 0,
      });
    }

    const stats = categoryStats.get(category.id)!;
    stats.sets += 1;
    stats.reps += log.reps;
    stats.volume += volume;
  }

  // Convert to array with percentages
  return Array.from(categoryStats.entries()).map(([categoryId, stats]) => ({
    categoryId,
    categoryName: stats.name,
    color: stats.color,
    sets: stats.sets,
    reps: stats.reps,
    volume: stats.volume,
    percentage: totalVolume > 0 ? (stats.volume / totalVolume) * 100 : 0,
  })).sort((a, b) => b.volume - a.volume);
}

/**
 * Get breakdown of workout data by exercise
 */
export async function getBreakdownByExercise(
  startDate?: string,
  endDate?: string
): Promise<ExerciseBreakdown[]> {
  const user = await requireAuth();

  // Get user's exercises with categories
  const userExercises = await db.query.exercises.findMany({
    where: eq(exercises.userId, user.id),
    columns: { id: true, name: true },
    with: {
      category: {
        columns: { color: true },
      },
    },
  });

  const exerciseIds = userExercises.map(e => e.id);
  if (exerciseIds.length === 0) return [];

  // Build date filter
  const dateFilters = [];
  if (startDate) dateFilters.push(gte(trainingLogs.workoutDate, startDate));
  if (endDate) dateFilters.push(lte(trainingLogs.workoutDate, endDate));

  // Get all training logs
  const logs = await db.query.trainingLogs.findMany({
    where: dateFilters.length > 0 ? and(...dateFilters) : undefined,
    columns: {
      exerciseId: true,
      metricWeight: true,
      reps: true,
    },
  });

  // Filter to user's exercises only
  const userLogs = logs.filter(log => exerciseIds.includes(log.exerciseId));

  // Map exercises
  const exerciseMap = new Map(
    userExercises.map(e => [e.id, { name: e.name, color: e.category?.color || '#808080' }])
  );

  // Aggregate by exercise
  const exerciseStats = new Map<number, {
    name: string;
    color: string;
    sets: number;
    reps: number;
    volume: number;
  }>();

  let totalVolume = 0;

  for (const log of userLogs) {
    const exercise = exerciseMap.get(log.exerciseId);
    if (!exercise) continue;

    const volume = log.metricWeight * log.reps;
    totalVolume += volume;

    if (!exerciseStats.has(log.exerciseId)) {
      exerciseStats.set(log.exerciseId, {
        name: exercise.name,
        color: exercise.color,
        sets: 0,
        reps: 0,
        volume: 0,
      });
    }

    const stats = exerciseStats.get(log.exerciseId)!;
    stats.sets += 1;
    stats.reps += log.reps;
    stats.volume += volume;
  }

  // Convert to array with percentages, sorted by volume
  return Array.from(exerciseStats.entries()).map(([exerciseId, stats]) => ({
    exerciseId,
    exerciseName: stats.name,
    categoryColor: stats.color,
    sets: stats.sets,
    reps: stats.reps,
    volume: stats.volume,
    percentage: totalVolume > 0 ? (stats.volume / totalVolume) * 100 : 0,
  })).sort((a, b) => b.volume - a.volume);
}

/**
 * Get breakdown by workout date
 */
export async function getWorkoutBreakdown(
  startDate?: string,
  endDate?: string
): Promise<WorkoutBreakdown[]> {
  const user = await requireAuth();

  // Get user's exercises
  const userExercises = await db.query.exercises.findMany({
    where: eq(exercises.userId, user.id),
    columns: { id: true },
  });

  const exerciseIds = userExercises.map(e => e.id);
  if (exerciseIds.length === 0) return [];

  // Build date filter
  const dateFilters = [];
  if (startDate) dateFilters.push(gte(trainingLogs.workoutDate, startDate));
  if (endDate) dateFilters.push(lte(trainingLogs.workoutDate, endDate));

  // Get all training logs
  const logs = await db.query.trainingLogs.findMany({
    where: dateFilters.length > 0 ? and(...dateFilters) : undefined,
    columns: {
      workoutDate: true,
      exerciseId: true,
      metricWeight: true,
      reps: true,
    },
  });

  // Filter to user's exercises only
  const userLogs = logs.filter(log => exerciseIds.includes(log.exerciseId));

  // Group by date
  const dateMap = new Map<string, {
    exerciseIds: Set<number>;
    setCount: number;
    totalVolume: number;
  }>();

  for (const log of userLogs) {
    if (!dateMap.has(log.workoutDate)) {
      dateMap.set(log.workoutDate, {
        exerciseIds: new Set(),
        setCount: 0,
        totalVolume: 0,
      });
    }

    const stats = dateMap.get(log.workoutDate)!;
    stats.exerciseIds.add(log.exerciseId);
    stats.setCount += 1;
    stats.totalVolume += log.metricWeight * log.reps;
  }

  // Convert to array
  return Array.from(dateMap.entries()).map(([date, stats]) => ({
    date,
    exerciseCount: stats.exerciseIds.size,
    setCount: stats.setCount,
    totalVolume: stats.totalVolume,
  })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get overall metrics summary
 */
export async function getMetricsSummary(
  startDate?: string,
  endDate?: string
): Promise<MetricsSummary> {
  const user = await requireAuth();

  // Get user's exercises
  const userExercises = await db.query.exercises.findMany({
    where: eq(exercises.userId, user.id),
    columns: { id: true },
  });

  const exerciseIds = userExercises.map(e => e.id);
  if (exerciseIds.length === 0) {
    return {
      totalSets: 0,
      totalReps: 0,
      totalVolume: 0,
      workoutCount: 0,
      avgVolumePerWorkout: 0,
    };
  }

  // Build date filter
  const dateFilters = [];
  if (startDate) dateFilters.push(gte(trainingLogs.workoutDate, startDate));
  if (endDate) dateFilters.push(lte(trainingLogs.workoutDate, endDate));

  // Get all training logs
  const logs = await db.query.trainingLogs.findMany({
    where: dateFilters.length > 0 ? and(...dateFilters) : undefined,
    columns: {
      workoutDate: true,
      exerciseId: true,
      metricWeight: true,
      reps: true,
    },
  });

  // Filter to user's exercises only
  const userLogs = logs.filter(log => exerciseIds.includes(log.exerciseId));

  // Calculate metrics
  const workoutDates = new Set<string>();
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;

  for (const log of userLogs) {
    workoutDates.add(log.workoutDate);
    totalSets += 1;
    totalReps += log.reps;
    totalVolume += log.metricWeight * log.reps;
  }

  const workoutCount = workoutDates.size;

  return {
    totalSets,
    totalReps,
    totalVolume,
    workoutCount,
    avgVolumePerWorkout: workoutCount > 0 ? Math.round(totalVolume / workoutCount) : 0,
  };
}
