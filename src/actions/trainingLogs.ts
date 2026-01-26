'use server';

import { db } from '@/db';
import { trainingLogs, exercises } from '@/db/schema';
import { eq, and, asc, desc, lt, gte, lte } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-utils';
import { createTrainingLogSchema, updateTrainingLogSchema } from '@/lib/validations/trainingLog';
import { revalidatePath } from 'next/cache';
import { detectPersonalRecords } from '@/lib/pr-detection';

export async function getTrainingLogs(date: string, exerciseId?: number) {
  const user = await requireAuth();

  // First get user's exercise IDs to filter logs
  const userExercises = await db.query.exercises.findMany({
    where: eq(exercises.userId, user.id),
    columns: { id: true },
  });
  const exerciseIds = userExercises.map(e => e.id);

  if (exerciseIds.length === 0) return [];

  let logs = await db.query.trainingLogs.findMany({
    where: eq(trainingLogs.workoutDate, date),
    with: {
      exercise: { with: { category: true } },
      workoutGroup: true,
    },
    orderBy: [asc(trainingLogs.sortOrder)],
  });

  // Filter to only user's exercises
  logs = logs.filter(log => exerciseIds.includes(log.exerciseId));

  if (exerciseId) {
    logs = logs.filter(log => log.exerciseId === exerciseId);
  }

  return logs;
}

export async function getTrainingLogById(id: number) {
  const user = await requireAuth();

  const log = await db.query.trainingLogs.findFirst({
    where: eq(trainingLogs.id, id),
    with: { exercise: true },
  });

  if (!log) return null;

  // Verify ownership through exercise
  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, log.exerciseId), eq(exercises.userId, user.id)),
  });

  if (!exercise) return null;

  return log;
}

export async function getLastWorkout(exerciseId: number, beforeDate: string) {
  const user = await requireAuth();

  // Verify user owns this exercise
  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, exerciseId), eq(exercises.userId, user.id)),
  });

  if (!exercise) return null;

  // Find the most recent workout date before the given date
  const lastLog = await db.query.trainingLogs.findFirst({
    where: and(
      eq(trainingLogs.exerciseId, exerciseId),
      lt(trainingLogs.workoutDate, beforeDate)
    ),
    orderBy: [desc(trainingLogs.workoutDate), desc(trainingLogs.id)],
  });

  if (!lastLog) return null;

  // Get all sets from that workout
  return db.query.trainingLogs.findMany({
    where: and(
      eq(trainingLogs.exerciseId, exerciseId),
      eq(trainingLogs.workoutDate, lastLog.workoutDate)
    ),
    orderBy: [asc(trainingLogs.sortOrder)],
  });
}

export async function createTrainingLog(data: unknown) {
  const user = await requireAuth();
  const parsed = createTrainingLogSchema.parse(data);

  // Verify user owns this exercise
  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, parsed.exerciseId), eq(exercises.userId, user.id)),
  });

  if (!exercise) throw new Error('Exercise not found');

  // Get current max sortOrder for this date/exercise
  const existingLogs = await db.query.trainingLogs.findMany({
    where: and(
      eq(trainingLogs.exerciseId, parsed.exerciseId),
      eq(trainingLogs.workoutDate, parsed.workoutDate)
    ),
    orderBy: [desc(trainingLogs.sortOrder)],
    limit: 1,
  });

  const nextSortOrder = existingLogs.length > 0 ? (existingLogs[0]?.sortOrder ?? 0) + 1 : 0;

  // Detect if this is a personal record
  const prResult = await detectPersonalRecords(
    parsed.exerciseId,
    parsed.workoutDate,
    parsed.metricWeight,
    parsed.reps
  );

  const [log] = await db.insert(trainingLogs).values({
    ...parsed,
    sortOrder: nextSortOrder,
    isPersonalRecord: prResult.isAnyPR,
  }).returning();

  revalidatePath('/workout');
  revalidatePath('/calendar');
  revalidatePath('/progress');
  return log;
}

export async function updateTrainingLog(id: number, data: unknown) {
  const user = await requireAuth();
  const parsed = updateTrainingLogSchema.parse(data);

  // Verify ownership
  const existingLog = await getTrainingLogById(id);
  if (!existingLog) throw new Error('Training log not found');

  const [log] = await db.update(trainingLogs)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(trainingLogs.id, id))
    .returning();

  revalidatePath('/workout');
  revalidatePath('/calendar');
  revalidatePath('/progress');
  return log;
}

export async function deleteTrainingLog(id: number) {
  const user = await requireAuth();

  // Verify ownership
  const existingLog = await getTrainingLogById(id);
  if (!existingLog) throw new Error('Training log not found');

  await db.delete(trainingLogs).where(eq(trainingLogs.id, id));

  revalidatePath('/workout');
  revalidatePath('/calendar');
  revalidatePath('/progress');
}

export async function copyPreviousSets(exerciseId: number, toDate: string) {
  const user = await requireAuth();

  const previousSets = await getLastWorkout(exerciseId, toDate);
  if (!previousSets || previousSets.length === 0) return [];

  const newLogs = await Promise.all(
    previousSets.map((set, index) =>
      db.insert(trainingLogs).values({
        exerciseId,
        workoutDate: toDate,
        metricWeight: set.metricWeight,
        reps: set.reps,
        unit: set.unit,
        distance: set.distance,
        durationSeconds: set.durationSeconds,
        sortOrder: index,
        isComplete: false,
        isPersonalRecord: false,
      }).returning()
    )
  );

  revalidatePath('/workout');
  return newLogs.flat();
}

export async function reorderTrainingLogs(orderedIds: number[]) {
  const user = await requireAuth();

  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(trainingLogs)
        .set({ sortOrder: index })
        .where(eq(trainingLogs.id, id))
    )
  );

  revalidatePath('/workout');
}

// Get workout dates for calendar
export async function getWorkoutDates(startDate: string, endDate: string) {
  const user = await requireAuth();

  const userExercises = await db.query.exercises.findMany({
    where: eq(exercises.userId, user.id),
    columns: { id: true, categoryId: true },
    with: { category: { columns: { color: true } } },
  });

  const exerciseMap = new Map(userExercises.map(e => [e.id, e.category?.color]));
  const exerciseIds = userExercises.map(e => e.id);

  if (exerciseIds.length === 0) return [];

  const logs = await db.query.trainingLogs.findMany({
    where: and(
      gte(trainingLogs.workoutDate, startDate),
      lte(trainingLogs.workoutDate, endDate)
    ),
    columns: { workoutDate: true, exerciseId: true },
  });

  // Group by date and collect category colors
  const dateMap = new Map<string, Set<string>>();

  for (const log of logs) {
    if (!exerciseIds.includes(log.exerciseId)) continue;

    const color = exerciseMap.get(log.exerciseId);
    if (!color) continue;

    if (!dateMap.has(log.workoutDate)) {
      dateMap.set(log.workoutDate, new Set());
    }
    dateMap.get(log.workoutDate)!.add(color);
  }

  return Array.from(dateMap.entries()).map(([date, colors]) => ({
    date,
    categoryColors: Array.from(colors),
  }));
}

// Get paginated workout history
export async function getWorkoutHistory(limit: number = 20, offset: number = 0) {
  const user = await requireAuth();

  // Get user's exercise IDs
  const userExercises = await db.query.exercises.findMany({
    where: eq(exercises.userId, user.id),
    columns: { id: true },
  });
  const exerciseIds = userExercises.map(e => e.id);

  if (exerciseIds.length === 0) return [];

  // Get all logs
  const logs = await db.query.trainingLogs.findMany({
    with: { exercise: { with: { category: true } } },
    orderBy: [desc(trainingLogs.workoutDate), desc(trainingLogs.id)],
  });

  // Filter to user's exercises
  const userLogs = logs.filter(log => exerciseIds.includes(log.exerciseId));

  // Group by date
  const dateMap = new Map<string, typeof userLogs>();
  for (const log of userLogs) {
    if (!dateMap.has(log.workoutDate)) {
      dateMap.set(log.workoutDate, []);
    }
    dateMap.get(log.workoutDate)!.push(log);
  }

  // Convert to array and paginate
  const workoutDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));
  const paginatedDates = workoutDates.slice(offset, offset + limit);

  return paginatedDates.map(date => ({
    date,
    logs: dateMap.get(date) || [],
  }));
}

// Get workout summary for a specific date
export async function getWorkoutSummary(date: string) {
  const user = await requireAuth();

  // Get user's exercise IDs
  const userExercises = await db.query.exercises.findMany({
    where: eq(exercises.userId, user.id),
    columns: { id: true },
  });
  const exerciseIds = userExercises.map(e => e.id);

  if (exerciseIds.length === 0) {
    return {
      date,
      exerciseCount: 0,
      setCount: 0,
      totalVolume: 0,
      exercises: [],
    };
  }

  // Get all logs for this date
  const logs = await db.query.trainingLogs.findMany({
    where: eq(trainingLogs.workoutDate, date),
    with: { exercise: { with: { category: true } } },
  });

  // Filter to user's exercises
  const userLogs = logs.filter(log => exerciseIds.includes(log.exerciseId));

  // Calculate stats
  const exerciseSet = new Set(userLogs.map(log => log.exerciseId));
  const setCount = userLogs.length;
  const totalVolume = userLogs.reduce((sum, log) => sum + (log.metricWeight * log.reps), 0);

  // Get unique exercises
  const exerciseMap = new Map<number, typeof userLogs[0]['exercise']>();
  for (const log of userLogs) {
    if (!exerciseMap.has(log.exerciseId)) {
      exerciseMap.set(log.exerciseId, log.exercise);
    }
  }

  return {
    date,
    exerciseCount: exerciseSet.size,
    setCount,
    totalVolume,
    exercises: Array.from(exerciseMap.values()),
  };
}
