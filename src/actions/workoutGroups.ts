'use server';

import { db } from '@/db';
import { workoutGroups, trainingLogs, exercises } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

/**
 * Create a new workout group (superset)
 * @param workoutDate - The date of the workout
 * @param name - Optional name for the group
 * @param color - Optional color for the group (hex color code)
 * @returns The created workout group
 */
export async function createWorkoutGroup(
  workoutDate: string,
  name?: string,
  color?: string
) {
  const user = await requireAuth();

  const [group] = await db.insert(workoutGroups).values({
    userId: user.id,
    workoutDate,
    name: name || null,
    color: color || '#3b82f6', // default blue
    autoJumpEnabled: true,
    restTimerAutoStart: false,
  }).returning();

  revalidatePath('/workout');
  return group;
}

/**
 * Delete a workout group
 * Sets all associated training logs' workoutGroupId to null
 * @param id - The workout group ID to delete
 */
export async function deleteWorkoutGroup(id: number) {
  const user = await requireAuth();

  // Verify ownership
  const group = await db.query.workoutGroups.findFirst({
    where: and(
      eq(workoutGroups.id, id),
      eq(workoutGroups.userId, user.id)
    ),
  });

  if (!group) {
    throw new Error('Workout group not found');
  }

  // Unlink all logs from this group (set to null)
  await db.update(trainingLogs)
    .set({ workoutGroupId: null })
    .where(eq(trainingLogs.workoutGroupId, id));

  // Delete the group
  await db.delete(workoutGroups).where(eq(workoutGroups.id, id));

  revalidatePath('/workout');
}

/**
 * Get all workout groups for a specific date
 * @param workoutDate - The date to get groups for
 * @returns Array of workout groups with their associated logs
 */
export async function getWorkoutGroups(workoutDate: string) {
  const user = await requireAuth();

  const groups = await db.query.workoutGroups.findMany({
    where: and(
      eq(workoutGroups.userId, user.id),
      eq(workoutGroups.workoutDate, workoutDate)
    ),
    with: {
      trainingLogs: {
        with: {
          exercise: {
            with: {
              category: true,
            },
          },
        },
      },
    },
  });

  return groups;
}

/**
 * Assign multiple training logs to a workout group (create superset)
 * @param logIds - Array of training log IDs to assign
 * @param groupId - The workout group ID to assign to
 */
export async function assignLogsToGroup(logIds: number[], groupId: number) {
  const user = await requireAuth();

  // Verify group ownership
  const group = await db.query.workoutGroups.findFirst({
    where: and(
      eq(workoutGroups.id, groupId),
      eq(workoutGroups.userId, user.id)
    ),
  });

  if (!group) {
    throw new Error('Workout group not found');
  }

  // Verify all logs belong to user's exercises
  const logs = await db.query.trainingLogs.findMany({
    where: inArray(trainingLogs.id, logIds),
    with: { exercise: true },
  });

  const userExerciseIds = await db.query.exercises.findMany({
    where: eq(exercises.userId, user.id),
    columns: { id: true },
  });

  const exerciseIdSet = new Set(userExerciseIds.map(e => e.id));

  for (const log of logs) {
    if (!exerciseIdSet.has(log.exerciseId)) {
      throw new Error('Unauthorized: Training log does not belong to user');
    }
  }

  // Assign all logs to the group
  await db.update(trainingLogs)
    .set({ workoutGroupId: groupId })
    .where(inArray(trainingLogs.id, logIds));

  revalidatePath('/workout');
}

/**
 * Remove a training log from its workout group
 * @param logId - The training log ID to remove
 */
export async function removeLogFromGroup(logId: number) {
  const user = await requireAuth();

  // Verify log ownership through exercise
  const log = await db.query.trainingLogs.findFirst({
    where: eq(trainingLogs.id, logId),
    with: { exercise: true },
  });

  if (!log) {
    throw new Error('Training log not found');
  }

  const exercise = await db.query.exercises.findFirst({
    where: and(
      eq(exercises.id, log.exerciseId),
      eq(exercises.userId, user.id)
    ),
  });

  if (!exercise) {
    throw new Error('Unauthorized');
  }

  // Remove from group
  await db.update(trainingLogs)
    .set({ workoutGroupId: null })
    .where(eq(trainingLogs.id, logId));

  revalidatePath('/workout');
}

/**
 * Update workout group details
 * @param id - The workout group ID
 * @param data - Data to update (name, color)
 */
export async function updateWorkoutGroup(
  id: number,
  data: { name?: string; color?: string }
) {
  const user = await requireAuth();

  // Verify ownership
  const group = await db.query.workoutGroups.findFirst({
    where: and(
      eq(workoutGroups.id, id),
      eq(workoutGroups.userId, user.id)
    ),
  });

  if (!group) {
    throw new Error('Workout group not found');
  }

  const [updated] = await db.update(workoutGroups)
    .set(data)
    .where(eq(workoutGroups.id, id))
    .returning();

  revalidatePath('/workout');
  return updated;
}
