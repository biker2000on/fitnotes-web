'use server';

import { db } from '@/db';
import { exercises, categories } from '@/db/schema';
import { eq, and, asc, ilike } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-utils';
import { createExerciseSchema, updateExerciseSchema } from '@/lib/validations/exercise';
import { revalidatePath } from 'next/cache';

export async function getExercises(categoryId?: number) {
  const user = await requireAuth();

  const whereClause = categoryId
    ? and(eq(exercises.userId, user.id), eq(exercises.categoryId, categoryId))
    : eq(exercises.userId, user.id);

  return db.query.exercises.findMany({
    where: whereClause,
    with: { category: true },
    orderBy: [asc(exercises.name)],
  });
}

export async function getExerciseById(id: number) {
  const user = await requireAuth();
  return db.query.exercises.findFirst({
    where: and(eq(exercises.id, id), eq(exercises.userId, user.id)),
    with: { category: true },
  });
}

export async function searchExercises(query: string) {
  const user = await requireAuth();
  return db.query.exercises.findMany({
    where: and(
      eq(exercises.userId, user.id),
      ilike(exercises.name, `%${query}%`)
    ),
    with: { category: true },
    limit: 20,
  });
}

export async function createExercise(data: unknown) {
  const user = await requireAuth();
  const parsed = createExerciseSchema.parse(data);

  const [exercise] = await db.insert(exercises).values({
    ...parsed,
    userId: user.id,
  }).returning();

  revalidatePath('/exercises');
  revalidatePath('/workout');
  return exercise;
}

export async function updateExercise(id: number, data: unknown) {
  const user = await requireAuth();
  const parsed = updateExerciseSchema.parse(data);

  const [exercise] = await db.update(exercises)
    .set({ ...parsed, updatedAt: new Date() })
    .where(and(eq(exercises.id, id), eq(exercises.userId, user.id)))
    .returning();

  revalidatePath('/exercises');
  revalidatePath('/workout');
  return exercise;
}

export async function deleteExercise(id: number) {
  const user = await requireAuth();

  await db.delete(exercises)
    .where(and(eq(exercises.id, id), eq(exercises.userId, user.id)));

  revalidatePath('/exercises');
  revalidatePath('/workout');
}

export async function toggleFavorite(id: number) {
  const user = await requireAuth();

  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, id), eq(exercises.userId, user.id)),
  });

  if (!exercise) throw new Error('Exercise not found');

  const [updated] = await db.update(exercises)
    .set({ isFavorite: !exercise.isFavorite, updatedAt: new Date() })
    .where(eq(exercises.id, id))
    .returning();

  revalidatePath('/exercises');
  revalidatePath('/workout');
  return updated;
}

export async function getFavoriteExercises() {
  const user = await requireAuth();
  return db.query.exercises.findMany({
    where: and(eq(exercises.userId, user.id), eq(exercises.isFavorite, true)),
    with: { category: true },
    orderBy: [asc(exercises.name)],
  });
}
