'use server';

import { db } from '@/db';
import { workoutTimes } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

export async function getWorkoutTime(date: string) {
  const user = await requireAuth();

  const workoutTime = await db.query.workoutTimes.findFirst({
    where: and(
      eq(workoutTimes.userId, user.id),
      eq(workoutTimes.workoutDate, date)
    ),
  });

  return workoutTime;
}

export async function startWorkout(date: string) {
  const user = await requireAuth();

  // Check if workout time already exists
  const existing = await getWorkoutTime(date);

  if (existing) {
    // Update start time if not already started
    if (!existing.startDateTime) {
      const [updated] = await db
        .update(workoutTimes)
        .set({ startDateTime: new Date() })
        .where(eq(workoutTimes.id, existing.id))
        .returning();

      revalidatePath('/workout');
      return updated;
    }
    return existing;
  }

  // Create new workout time record
  const [newWorkoutTime] = await db
    .insert(workoutTimes)
    .values({
      userId: user.id,
      workoutDate: date,
      startDateTime: new Date(),
      endDateTime: new Date(), // Placeholder, will be updated on endWorkout
    })
    .returning();

  revalidatePath('/workout');
  return newWorkoutTime;
}

export async function endWorkout(date: string) {
  const user = await requireAuth();

  const existing = await getWorkoutTime(date);

  if (!existing) {
    throw new Error('No workout session found');
  }

  const [updated] = await db
    .update(workoutTimes)
    .set({ endDateTime: new Date() })
    .where(eq(workoutTimes.id, existing.id))
    .returning();

  revalidatePath('/workout');
  return updated;
}

export async function deleteWorkoutTime(date: string) {
  const user = await requireAuth();

  const existing = await getWorkoutTime(date);

  if (!existing) {
    return;
  }

  await db
    .delete(workoutTimes)
    .where(eq(workoutTimes.id, existing.id));

  revalidatePath('/workout');
}
