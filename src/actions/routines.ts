'use server';

import { db } from '@/db';
import { routines, routineSections, routineSectionExercises, routineSectionExerciseSets } from '@/db/schema';
import { trainingLogs, exercises } from '@/db/schema';
import { eq, and, desc, lt, asc } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';
import type { Routine } from '@/types/routine';

export async function getRoutines(): Promise<Routine[]> {
  const user = await requireAuth();

  const userRoutines = await db.query.routines.findMany({
    where: eq(routines.userId, user.id),
    with: {
      sections: {
        with: {
          exercises: true,
        },
        orderBy: [asc(routineSections.sortOrder)],
      },
    },
    orderBy: [asc(routines.sortOrder)],
  });

  return userRoutines as unknown as Routine[];
}

export async function getRoutine(id: number): Promise<Routine | null> {
  const user = await requireAuth();

  const routine = await db.query.routines.findFirst({
    where: and(eq(routines.id, id), eq(routines.userId, user.id)),
    with: {
      sections: {
        with: {
          exercises: {
            with: {
              sets: {
                orderBy: [asc(routineSectionExerciseSets.sortOrder)],
              },
            },
          },
        },
        orderBy: [asc(routineSections.sortOrder)],
      },
    },
  });

  if (!routine) return null;

  return routine as unknown as Routine;
}

export async function createRoutine(data: { name: string; notes?: string }): Promise<Routine> {
  const user = await requireAuth();

  // Get the highest sort order to place new routine at the end
  const existingRoutines = await db.query.routines.findMany({
    where: eq(routines.userId, user.id),
    orderBy: [asc(routines.sortOrder)],
  });

  const maxSortOrder = existingRoutines.length > 0
    ? Math.max(...existingRoutines.map(r => r.sortOrder ?? 0))
    : 0;

  const [routine] = await db
    .insert(routines)
    .values({
      userId: user.id,
      name: data.name,
      notes: data.notes || null,
      sortOrder: maxSortOrder + 1,
    })
    .returning();

  revalidatePath('/routines');
  return routine as unknown as Routine;
}

export async function updateRoutine(id: number, data: { name?: string; notes?: string }): Promise<Routine> {
  const user = await requireAuth();

  // Verify ownership
  const routine = await db.query.routines.findFirst({
    where: and(eq(routines.id, id), eq(routines.userId, user.id)),
  });

  if (!routine) {
    throw new Error('Routine not found');
  }

  const [updated] = await db
    .update(routines)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(routines.id, id))
    .returning();

  revalidatePath('/routines');
  return updated as unknown as Routine;
}

export async function deleteRoutine(id: number): Promise<void> {
  const user = await requireAuth();

  // Verify ownership
  const routine = await db.query.routines.findFirst({
    where: and(eq(routines.id, id), eq(routines.userId, user.id)),
  });

  if (!routine) {
    throw new Error('Routine not found');
  }

  await db.delete(routines).where(eq(routines.id, id));

  revalidatePath('/routines');
}

export async function duplicateRoutine(id: number): Promise<Routine> {
  const user = await requireAuth();

  // Get the original routine with all its data
  const original = await getRoutine(id);

  if (!original) {
    throw new Error('Routine not found');
  }

  // Create the new routine
  const [newRoutine] = await db
    .insert(routines)
    .values({
      userId: user.id,
      name: `${original.name} (Copy)`,
      notes: original.notes,
      sortOrder: (original.sortOrder ?? 0) + 1,
    })
    .returning();

  if (!newRoutine) {
    throw new Error('Failed to create routine');
  }

  // Duplicate all sections
  for (const section of original.sections) {
    const [newSection] = await db
      .insert(routineSections)
      .values({
        routineId: newRoutine.id,
        name: section.name,
        sortOrder: section.sortOrder,
      })
      .returning();

    if (!newSection) {
      throw new Error('Failed to create section');
    }

    // Duplicate all exercises in the section
    for (const exercise of section.exercises) {
      const [newExercise] = await db
        .insert(routineSectionExercises)
        .values({
          sectionId: newSection.id,
          exerciseId: exercise.exerciseId,
          sortOrder: exercise.sortOrder,
          restTimerSeconds: exercise.restTimerSeconds ?? null,
          notes: exercise.notes ?? null,
        })
        .returning();

      if (!newExercise) {
        throw new Error('Failed to create exercise');
      }

      // Duplicate all sets
      if (exercise.sets && exercise.sets.length > 0) {
        await db.insert(routineSectionExerciseSets).values(
          exercise.sets.map(set => ({
            sectionExerciseId: newExercise.id,
            metricWeight: set.metricWeight,
            reps: set.reps,
            distance: set.distance,
            durationSeconds: set.durationSeconds,
            sortOrder: set.sortOrder,
          }))
        );
      }
    }
  }

  revalidatePath('/routines');
  const duplicated = await getRoutine(newRoutine.id);
  if (!duplicated) {
    throw new Error('Failed to retrieve duplicated routine');
  }
  return duplicated;
}

export async function addSection(routineId: number, name: string): Promise<void> {
  const user = await requireAuth();

  // Verify routine ownership
  const routine = await db.query.routines.findFirst({
    where: and(eq(routines.id, routineId), eq(routines.userId, user.id)),
  });

  if (!routine) {
    throw new Error('Routine not found');
  }

  // Get the highest sort order for sections in this routine
  const existingSections = await db.query.routineSections.findMany({
    where: eq(routineSections.routineId, routineId),
    orderBy: [asc(routineSections.sortOrder)],
  });

  const maxSortOrder = existingSections.length > 0
    ? Math.max(...existingSections.map(s => s.sortOrder ?? 0))
    : 0;

  await db
    .insert(routineSections)
    .values({
      routineId,
      name,
      sortOrder: maxSortOrder + 1,
    });

  revalidatePath('/routines');
}

export async function updateSection(sectionId: number, data: { name?: string; sortOrder?: number }): Promise<void> {
  const user = await requireAuth();

  // Verify ownership through routine
  const section = await db.query.routineSections.findFirst({
    where: eq(routineSections.id, sectionId),
    with: { routine: true },
  });

  if (!section || section.routine.userId !== user.id) {
    throw new Error('Section not found');
  }

  await db
    .update(routineSections)
    .set(data)
    .where(eq(routineSections.id, sectionId));

  revalidatePath('/routines');
}

export async function deleteSection(sectionId: number): Promise<void> {
  const user = await requireAuth();

  // Verify ownership through routine
  const section = await db.query.routineSections.findFirst({
    where: eq(routineSections.id, sectionId),
    with: { routine: true },
  });

  if (!section || section.routine.userId !== user.id) {
    throw new Error('Section not found');
  }

  await db.delete(routineSections).where(eq(routineSections.id, sectionId));

  revalidatePath('/routines');
}

export async function addExerciseToSection(sectionId: number, exerciseId: number): Promise<void> {
  const user = await requireAuth();

  // Verify section ownership through routine
  const section = await db.query.routineSections.findFirst({
    where: eq(routineSections.id, sectionId),
    with: { routine: true },
  });

  if (!section || section.routine.userId !== user.id) {
    throw new Error('Section not found');
  }

  // Verify exercise ownership
  const exercise = await db.query.exercises.findFirst({
    where: and(eq(exercises.id, exerciseId), eq(exercises.userId, user.id)),
  });

  if (!exercise) {
    throw new Error('Exercise not found');
  }

  // Get the highest sort order for exercises in this section
  const existingExercises = await db.query.routineSectionExercises.findMany({
    where: eq(routineSectionExercises.sectionId, sectionId),
    orderBy: [asc(routineSectionExercises.sortOrder)],
  });

  const maxSortOrder = existingExercises.length > 0
    ? Math.max(...existingExercises.map(e => e.sortOrder ?? 0))
    : 0;

  await db
    .insert(routineSectionExercises)
    .values({
      sectionId,
      exerciseId,
      sortOrder: maxSortOrder + 1,
    });

  revalidatePath('/routines');
}

export async function removeExerciseFromSection(routineExerciseId: number): Promise<void> {
  const user = await requireAuth();

  // Verify ownership through section -> routine
  const sectionExercise = await db.query.routineSectionExercises.findFirst({
    where: eq(routineSectionExercises.id, routineExerciseId),
    with: {
      section: {
        with: { routine: true },
      },
    },
  });

  if (!sectionExercise || sectionExercise.section.routine.userId !== user.id) {
    throw new Error('Exercise not found');
  }

  await db
    .delete(routineSectionExercises)
    .where(eq(routineSectionExercises.id, routineExerciseId));

  revalidatePath('/routines');
}

export async function updateExerciseSortOrder(routineExerciseId: number, sortOrder: number): Promise<void> {
  const user = await requireAuth();

  // Verify ownership through section -> routine
  const sectionExercise = await db.query.routineSectionExercises.findFirst({
    where: eq(routineSectionExercises.id, routineExerciseId),
    with: {
      section: {
        with: { routine: true },
      },
    },
  });

  if (!sectionExercise || sectionExercise.section.routine.userId !== user.id) {
    throw new Error('Exercise not found');
  }

  await db
    .update(routineSectionExercises)
    .set({ sortOrder })
    .where(eq(routineSectionExercises.id, routineExerciseId));

  revalidatePath('/routines');
}

export interface PredefinedSet {
  id?: number;
  metricWeight?: number | null;
  reps?: number | null;
  distance?: number | null;
  durationSeconds?: number | null;
  sortOrder: number;
}

export async function getPredefinedSets(sectionExerciseId: number) {
  const { requireAuth } = await import('@/lib/auth-utils');
  await requireAuth();

  const { db } = await import('@/db');
  const { routineSectionExerciseSets } = await import('@/db/schema');
  const { eq, asc } = await import('drizzle-orm');

  const sets = await db.query.routineSectionExerciseSets.findMany({
    where: eq(routineSectionExerciseSets.sectionExerciseId, sectionExerciseId),
    orderBy: [asc(routineSectionExerciseSets.sortOrder)],
  });

  return sets;
}

export async function savePredefinedSets(sectionExerciseId: number, sets: PredefinedSet[]) {
  const { requireAuth } = await import('@/lib/auth-utils');
  await requireAuth();

  const { db } = await import('@/db');
  const { routineSectionExerciseSets } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  // Delete all existing sets for this exercise
  await db
    .delete(routineSectionExerciseSets)
    .where(eq(routineSectionExerciseSets.sectionExerciseId, sectionExerciseId));

  // Insert new sets
  if (sets.length > 0) {
    await db.insert(routineSectionExerciseSets).values(
      sets.map((set, index) => ({
        sectionExerciseId,
        metricWeight: set.metricWeight,
        reps: set.reps,
        distance: set.distance,
        durationSeconds: set.durationSeconds,
        sortOrder: index,
      }))
    );
  }

  return { success: true };
}

export async function applyRoutineToWorkout(
  routineId: number,
  workoutDate: string,
  option: 'blank' | 'template' | 'last'
): Promise<{ exerciseCount: number; setCount: number } | null> {
  const user = await requireAuth();

  // Get the routine with all its sections, exercises, and sets
  const routine = await db.query.routines.findFirst({
    where: and(eq(routines.id, routineId), eq(routines.userId, user.id)),
    with: {
      sections: {
        with: {
          exercises: {
            with: {
              sets: {
                orderBy: [asc(routineSectionExerciseSets.sortOrder)],
              },
            },
          },
        },
        orderBy: [asc(routineSections.sortOrder)],
      },
    },
  });

  if (!routine) return null;

  let totalExercises = 0;
  let totalSets = 0;

  // Iterate through all sections and exercises
  for (const section of routine.sections) {
    for (const routineExercise of section.exercises) {
      // Verify user owns this exercise
      const exercise = await db.query.exercises.findFirst({
        where: and(
          eq(exercises.id, routineExercise.exerciseId),
          eq(exercises.userId, user.id)
        ),
      });

      if (!exercise) continue;

      totalExercises++;

      if (option === 'blank') {
        // Create exercise with no sets
        // Don't create any training logs
        continue;
      } else if (option === 'template') {
        // Use predefined sets from routine
        if (routineExercise.sets.length > 0) {
          for (const [index, templateSet] of routineExercise.sets.entries()) {
            await db.insert(trainingLogs).values({
              exerciseId: routineExercise.exerciseId,
              workoutDate,
              metricWeight: templateSet.metricWeight ?? 0,
              reps: templateSet.reps ?? 0,
              unit: 0,
              distance: templateSet.distance ?? 0,
              durationSeconds: templateSet.durationSeconds ?? 0,
              sortOrder: index,
              isComplete: false,
              isPersonalRecord: false,
            });
            totalSets++;
          }
        }
      } else if (option === 'last') {
        // Copy from last workout
        // Find the most recent workout date before the given date
        const lastLog = await db.query.trainingLogs.findFirst({
          where: and(
            eq(trainingLogs.exerciseId, routineExercise.exerciseId),
            lt(trainingLogs.workoutDate, workoutDate)
          ),
          orderBy: [desc(trainingLogs.workoutDate), desc(trainingLogs.id)],
        });

        if (lastLog) {
          // Get all sets from that workout
          const previousSets = await db.query.trainingLogs.findMany({
            where: and(
              eq(trainingLogs.exerciseId, routineExercise.exerciseId),
              eq(trainingLogs.workoutDate, lastLog.workoutDate)
            ),
            orderBy: [asc(trainingLogs.sortOrder)],
          });

          for (const [index, previousSet] of previousSets.entries()) {
            await db.insert(trainingLogs).values({
              exerciseId: routineExercise.exerciseId,
              workoutDate,
              metricWeight: previousSet.metricWeight,
              reps: previousSet.reps,
              unit: previousSet.unit,
              distance: previousSet.distance,
              durationSeconds: previousSet.durationSeconds,
              sortOrder: index,
              isComplete: false,
              isPersonalRecord: false,
            });
            totalSets++;
          }
        }
      }
    }
  }

  revalidatePath('/workout');
  return { exerciseCount: totalExercises, setCount: totalSets };
}

/**
 * Reorder sections within a routine
 */
export async function reorderSections(routineId: number, sectionIds: number[]) {
  const user = await requireAuth();

  // Verify routine ownership
  const routine = await db.query.routines.findFirst({
    where: and(eq(routines.id, routineId), eq(routines.userId, user.id)),
  });

  if (!routine) {
    throw new Error('Routine not found');
  }

  // Update sort order for each section
  await Promise.all(
    sectionIds.map((sectionId, index) =>
      db
        .update(routineSections)
        .set({ sortOrder: index })
        .where(eq(routineSections.id, sectionId))
    )
  );

  revalidatePath('/routines');
}

/**
 * Reorder exercises within a section
 */
export async function reorderExercises(sectionId: number, exerciseIds: number[]) {
  const user = await requireAuth();

  // Verify section ownership through routine
  const section = await db.query.routineSections.findFirst({
    where: eq(routineSections.id, sectionId),
    with: { routine: true },
  });

  if (!section || section.routine.userId !== user.id) {
    throw new Error('Section not found');
  }

  // Update sort order for each exercise
  await Promise.all(
    exerciseIds.map((exerciseId, index) =>
      db
        .update(routineSectionExercises)
        .set({ sortOrder: index })
        .where(eq(routineSectionExercises.id, exerciseId))
    )
  );

  revalidatePath('/routines');
}

/**
 * Create a predefined set for an exercise in a routine
 */
export async function createPredefinedSet(
  sectionExerciseId: number,
  data: {
    metricWeight?: number;
    reps?: number;
    distance?: number;
    durationSeconds?: number;
  }
) {
  const user = await requireAuth();

  // Verify ownership through section -> routine
  const sectionExercise = await db.query.routineSectionExercises.findFirst({
    where: eq(routineSectionExercises.id, sectionExerciseId),
    with: {
      section: {
        with: { routine: true },
      },
    },
  });

  if (!sectionExercise || sectionExercise.section.routine.userId !== user.id) {
    throw new Error('Exercise not found');
  }

  // Get the highest sort order for sets in this exercise
  const existingSets = await db.query.routineSectionExerciseSets.findMany({
    where: eq(routineSectionExerciseSets.sectionExerciseId, sectionExerciseId),
    orderBy: [asc(routineSectionExerciseSets.sortOrder)],
  });

  const maxSortOrder = existingSets.length > 0
    ? Math.max(...existingSets.map(s => s.sortOrder ?? 0))
    : 0;

  const [set] = await db
    .insert(routineSectionExerciseSets)
    .values({
      sectionExerciseId,
      metricWeight: data.metricWeight || null,
      reps: data.reps || null,
      distance: data.distance || null,
      durationSeconds: data.durationSeconds || null,
      sortOrder: maxSortOrder + 1,
    })
    .returning();

  revalidatePath('/routines');
  return set;
}

/**
 * Update a predefined set
 */
export async function updatePredefinedSet(
  id: number,
  data: {
    metricWeight?: number;
    reps?: number;
    distance?: number;
    durationSeconds?: number;
  }
) {
  const user = await requireAuth();

  // Verify ownership through section exercise -> section -> routine
  const set = await db.query.routineSectionExerciseSets.findFirst({
    where: eq(routineSectionExerciseSets.id, id),
    with: {
      sectionExercise: {
        with: {
          section: {
            with: { routine: true },
          },
        },
      },
    },
  });

  if (!set || set.sectionExercise.section.routine.userId !== user.id) {
    throw new Error('Set not found');
  }

  const [updated] = await db
    .update(routineSectionExerciseSets)
    .set({
      metricWeight: data.metricWeight ?? null,
      reps: data.reps ?? null,
      distance: data.distance ?? null,
      durationSeconds: data.durationSeconds ?? null,
    })
    .where(eq(routineSectionExerciseSets.id, id))
    .returning();

  revalidatePath('/routines');
  return updated;
}

/**
 * Delete a predefined set
 */
export async function deletePredefinedSet(id: number) {
  const user = await requireAuth();

  // Verify ownership through section exercise -> section -> routine
  const set = await db.query.routineSectionExerciseSets.findFirst({
    where: eq(routineSectionExerciseSets.id, id),
    with: {
      sectionExercise: {
        with: {
          section: {
            with: { routine: true },
          },
        },
      },
    },
  });

  if (!set || set.sectionExercise.section.routine.userId !== user.id) {
    throw new Error('Set not found');
  }

  await db
    .delete(routineSectionExerciseSets)
    .where(eq(routineSectionExerciseSets.id, id));

  revalidatePath('/routines');
}
