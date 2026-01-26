'use server';

import { db } from '@/db';
import { categories } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-utils';
import { createCategorySchema, updateCategorySchema } from '@/lib/validations/category';
import { revalidatePath } from 'next/cache';

export async function getCategories() {
  const user = await requireAuth();
  return db.query.categories.findMany({
    where: eq(categories.userId, user.id),
    orderBy: [asc(categories.sortOrder), asc(categories.name)],
  });
}

export async function getCategoryById(id: number) {
  const user = await requireAuth();
  return db.query.categories.findFirst({
    where: and(eq(categories.id, id), eq(categories.userId, user.id)),
  });
}

export async function createCategory(data: unknown) {
  const user = await requireAuth();
  const parsed = createCategorySchema.parse(data);

  const [category] = await db.insert(categories).values({
    ...parsed,
    userId: user.id,
  }).returning();

  revalidatePath('/exercises');
  return category;
}

export async function updateCategory(id: number, data: unknown) {
  const user = await requireAuth();
  const parsed = updateCategorySchema.parse(data);

  const [category] = await db.update(categories)
    .set({ ...parsed, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
    .returning();

  revalidatePath('/exercises');
  return category;
}

export async function deleteCategory(id: number) {
  const user = await requireAuth();

  await db.delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));

  revalidatePath('/exercises');
}

export async function reorderCategories(orderedIds: number[]) {
  const user = await requireAuth();

  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(categories)
        .set({ sortOrder: index })
        .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
    )
  );

  revalidatePath('/exercises');
}
