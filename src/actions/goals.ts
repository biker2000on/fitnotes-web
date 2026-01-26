'use server';

import { auth } from '@/lib/auth';
import { db } from '@/db';
import { goals, exercises, trainingLogs } from '@/db/schema';
import { eq, and, desc, gte, lte, sum, max, count, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export type GoalType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface CreateGoalInput {
  exerciseId?: number;
  goalTypeId: GoalType;
  targetValue: number;
  startDate?: Date;
  targetDate?: Date;
}

export interface UpdateGoalInput {
  exerciseId?: number;
  goalTypeId?: GoalType;
  targetValue?: number;
  startDate?: Date;
  targetDate?: Date;
  isCompleted?: boolean;
  sortOrder?: number;
}

export interface GoalProgress {
  id: number;
  exerciseId: number | null;
  exerciseName: string | null;
  goalTypeId: number;
  targetValue: number;
  currentValue: number;
  progressPercentage: number;
  startDate: Date | null;
  targetDate: Date | null;
  isCompleted: boolean;
  completedAt: Date | null;
  sortOrder: number;
  createdAt: Date;
  daysRemaining: number | null;
}

export async function createGoal(data: CreateGoalInput) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const [goal] = await db
    .insert(goals)
    .values({
      userId: session.user.id,
      exerciseId: data.exerciseId,
      goalTypeId: data.goalTypeId,
      targetValue: data.targetValue,
      startDate: data.startDate,
      targetDate: data.targetDate,
      isCompleted: false,
    })
    .returning();

  revalidatePath('/goals');
  return goal;
}

export async function getGoals(): Promise<GoalProgress[]> {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  const userGoals = await db
    .select({
      id: goals.id,
      exerciseId: goals.exerciseId,
      goalTypeId: goals.goalTypeId,
      targetValue: goals.targetValue,
      startDate: goals.startDate,
      targetDate: goals.targetDate,
      isCompleted: goals.isCompleted,
      completedAt: goals.completedAt,
      sortOrder: goals.sortOrder,
      createdAt: goals.createdAt,
      exerciseName: exercises.name,
    })
    .from(goals)
    .leftJoin(exercises, eq(goals.exerciseId, exercises.id))
    .where(eq(goals.userId, session.user.id))
    .orderBy(desc(goals.createdAt));

  const goalsWithProgress = await Promise.all(
    userGoals.map(async (goal) => {
      const currentValue = await calculateGoalProgress(
        goal.id,
        goal.exerciseId,
        goal.goalTypeId,
        goal.startDate,
        session.user!.id
      );

      const progressPercentage = Math.min(
        Math.round((currentValue / goal.targetValue) * 100),
        100
      );

      const daysRemaining = goal.targetDate
        ? Math.ceil(
            (new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          )
        : null;

      return {
        id: goal.id,
        exerciseId: goal.exerciseId,
        exerciseName: goal.exerciseName,
        goalTypeId: goal.goalTypeId,
        targetValue: goal.targetValue,
        currentValue,
        progressPercentage,
        startDate: goal.startDate,
        targetDate: goal.targetDate,
        isCompleted: goal.isCompleted || false,
        completedAt: goal.completedAt,
        sortOrder: goal.sortOrder || 0,
        createdAt: goal.createdAt,
        daysRemaining,
      };
    })
  );

  return goalsWithProgress;
}

export async function getGoal(id: number): Promise<GoalProgress | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const [goal] = await db
    .select({
      id: goals.id,
      exerciseId: goals.exerciseId,
      goalTypeId: goals.goalTypeId,
      targetValue: goals.targetValue,
      startDate: goals.startDate,
      targetDate: goals.targetDate,
      isCompleted: goals.isCompleted,
      completedAt: goals.completedAt,
      sortOrder: goals.sortOrder,
      createdAt: goals.createdAt,
      exerciseName: exercises.name,
    })
    .from(goals)
    .leftJoin(exercises, eq(goals.exerciseId, exercises.id))
    .where(and(eq(goals.id, id), eq(goals.userId, session.user.id)));

  if (!goal) {
    return null;
  }

  const currentValue = await calculateGoalProgress(
    goal.id,
    goal.exerciseId,
    goal.goalTypeId,
    goal.startDate,
    session.user.id
  );

  const progressPercentage = Math.min(
    Math.round((currentValue / goal.targetValue) * 100),
    100
  );

  const daysRemaining = goal.targetDate
    ? Math.ceil(
        (new Date(goal.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return {
    id: goal.id,
    exerciseId: goal.exerciseId,
    exerciseName: goal.exerciseName,
    goalTypeId: goal.goalTypeId,
    targetValue: goal.targetValue,
    currentValue,
    progressPercentage,
    startDate: goal.startDate,
    targetDate: goal.targetDate,
    isCompleted: goal.isCompleted || false,
    completedAt: goal.completedAt,
    sortOrder: goal.sortOrder || 0,
    createdAt: goal.createdAt,
    daysRemaining,
  };
}

export async function updateGoal(id: number, data: UpdateGoalInput) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const [updatedGoal] = await db
    .update(goals)
    .set(data)
    .where(and(eq(goals.id, id), eq(goals.userId, session.user.id)))
    .returning();

  revalidatePath('/goals');
  return updatedGoal;
}

export async function deleteGoal(id: number) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, session.user.id)));

  revalidatePath('/goals');
}

export async function getGoalProgress(goalId: number): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) {
    return 0;
  }

  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, session.user.id)));

  if (!goal) {
    return 0;
  }

  return calculateGoalProgress(
    goal.id,
    goal.exerciseId,
    goal.goalTypeId,
    goal.startDate,
    session.user.id
  );
}

export async function checkGoalCompletion(goalId: number) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, session.user.id)));

  if (!goal || goal.isCompleted) {
    return;
  }

  const currentValue = await calculateGoalProgress(
    goal.id,
    goal.exerciseId,
    goal.goalTypeId,
    goal.startDate,
    session.user.id
  );

  if (currentValue >= goal.targetValue) {
    await db
      .update(goals)
      .set({
        isCompleted: true,
        completedAt: new Date(),
      })
      .where(eq(goals.id, goalId));

    revalidatePath('/goals');
  }
}

async function calculateGoalProgress(
  goalId: number,
  exerciseId: number | null,
  goalTypeId: number,
  startDate: Date | null,
  userId: string
): Promise<number> {
  const dateString = startDate ? startDate.toISOString().split('T')[0] : null;

  // Goal type 6: workout_count (no exercise needed)
  if (goalTypeId === 6) {
    const result = await db
      .select({ count: count() })
      .from(trainingLogs)
      .innerJoin(exercises, eq(trainingLogs.exerciseId, exercises.id))
      .where(
        dateString
          ? and(eq(exercises.userId, userId), gte(trainingLogs.workoutDate, dateString))
          : eq(exercises.userId, userId)
      );
    return result[0]?.count || 0;
  }

  // All other goal types require an exerciseId
  if (!exerciseId) {
    return 0;
  }

  const baseCondition = dateString
    ? and(eq(trainingLogs.exerciseId, exerciseId), gte(trainingLogs.workoutDate, dateString))
    : eq(trainingLogs.exerciseId, exerciseId);

  switch (goalTypeId) {
    case 0: // max_weight
      const maxWeightResult = await db
        .select({ maxWeight: max(trainingLogs.metricWeight) })
        .from(trainingLogs)
        .where(baseCondition);
      return maxWeightResult[0]?.maxWeight || 0;

    case 1: // max_reps
      const maxRepsResult = await db
        .select({ maxReps: max(trainingLogs.reps) })
        .from(trainingLogs)
        .where(baseCondition);
      return maxRepsResult[0]?.maxReps || 0;

    case 2: // total_volume
      const volumeResult = await db
        .select({
          totalVolume: sql<number>`sum(${trainingLogs.metricWeight} * ${trainingLogs.reps})`,
        })
        .from(trainingLogs)
        .where(baseCondition);
      return volumeResult[0]?.totalVolume || 0;

    case 3: // max_1rm (using Epley formula: weight * (1 + reps/30))
      const oneRmResult = await db
        .select({
          weight: trainingLogs.metricWeight,
          reps: trainingLogs.reps,
        })
        .from(trainingLogs)
        .where(baseCondition);

      const max1rm = oneRmResult.reduce((maxRm, log) => {
        const estimated1rm = log.weight * (1 + log.reps / 30);
        return Math.max(maxRm, estimated1rm);
      }, 0);
      return Math.round(max1rm);

    case 4: // total_distance
      const distanceResult = await db
        .select({ totalDistance: sum(trainingLogs.distance) })
        .from(trainingLogs)
        .where(baseCondition);
      return Number(distanceResult[0]?.totalDistance || 0);

    case 5: // total_duration
      const durationResult = await db
        .select({ totalDuration: sum(trainingLogs.durationSeconds) })
        .from(trainingLogs)
        .where(baseCondition);
      const totalSeconds = Number(durationResult[0]?.totalDuration || 0);
      return totalSeconds / 3600; // Convert to hours

    default:
      return 0;
  }
}
