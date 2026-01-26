'use server';

import { db } from '@/db';
import { comments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

// Owner type IDs
const OWNER_TYPE_SET = 1; // For training log sets
const OWNER_TYPE_WORKOUT = 2; // For workout day

/**
 * Get comment for a specific set (training log)
 */
export async function getSetComment(trainingLogId: number) {
  const user = await requireAuth();

  const comment = await db.query.comments.findFirst({
    where: and(
      eq(comments.userId, user.id),
      eq(comments.ownerTypeId, OWNER_TYPE_SET),
      eq(comments.ownerId, trainingLogId)
    ),
  });

  return comment;
}

/**
 * Get all comments for a workout date
 */
export async function getWorkoutComments(date: string) {
  const user = await requireAuth();

  const allComments = await db.query.comments.findMany({
    where: and(
      eq(comments.userId, user.id),
      eq(comments.date, date)
    ),
  });

  return allComments;
}

/**
 * Get workout-level comment for a specific date
 */
export async function getWorkoutComment(date: string) {
  const user = await requireAuth();

  const comment = await db.query.comments.findFirst({
    where: and(
      eq(comments.userId, user.id),
      eq(comments.ownerTypeId, OWNER_TYPE_WORKOUT),
      eq(comments.date, date)
    ),
  });

  return comment;
}

/**
 * Create or update a comment for a specific set
 */
export async function upsertSetComment(trainingLogId: number, date: string, commentText: string) {
  const user = await requireAuth();

  // Check if comment already exists
  const existingComment = await db.query.comments.findFirst({
    where: and(
      eq(comments.userId, user.id),
      eq(comments.ownerTypeId, OWNER_TYPE_SET),
      eq(comments.ownerId, trainingLogId)
    ),
  });

  if (existingComment) {
    // Update existing comment
    const [updated] = await db
      .update(comments)
      .set({ comment: commentText })
      .where(eq(comments.id, existingComment.id))
      .returning();

    revalidatePath('/workout');
    return updated;
  } else {
    // Create new comment
    const [created] = await db
      .insert(comments)
      .values({
        userId: user.id,
        date,
        ownerTypeId: OWNER_TYPE_SET,
        ownerId: trainingLogId,
        comment: commentText,
      })
      .returning();

    revalidatePath('/workout');
    return created;
  }
}

/**
 * Create or update a workout-level comment for a specific date
 */
export async function upsertWorkoutComment(date: string, commentText: string) {
  const user = await requireAuth();

  // Check if comment already exists
  const existingComment = await db.query.comments.findFirst({
    where: and(
      eq(comments.userId, user.id),
      eq(comments.ownerTypeId, OWNER_TYPE_WORKOUT),
      eq(comments.date, date)
    ),
  });

  if (existingComment) {
    // Update existing comment
    const [updated] = await db
      .update(comments)
      .set({ comment: commentText })
      .where(eq(comments.id, existingComment.id))
      .returning();

    revalidatePath('/workout');
    return updated;
  } else {
    // Create new comment
    const [created] = await db
      .insert(comments)
      .values({
        userId: user.id,
        date,
        ownerTypeId: OWNER_TYPE_WORKOUT,
        ownerId: 0, // Not used for workout-level comments
        comment: commentText,
      })
      .returning();

    revalidatePath('/workout');
    return created;
  }
}

/**
 * Delete a comment by ID
 */
export async function deleteComment(commentId: number) {
  const user = await requireAuth();

  // Verify ownership
  const comment = await db.query.comments.findFirst({
    where: and(
      eq(comments.id, commentId),
      eq(comments.userId, user.id)
    ),
  });

  if (!comment) {
    throw new Error('Comment not found or unauthorized');
  }

  await db.delete(comments).where(eq(comments.id, commentId));

  revalidatePath('/workout');
}
