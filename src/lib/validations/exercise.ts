import { z } from 'zod';

export const createExerciseSchema = z.object({
  name: z.string().min(1).max(200),
  categoryId: z.number().int().positive(),
  exerciseTypeId: z.number().int().min(0).max(3).default(0),
  notes: z.string().optional(),
  weightIncrement: z.number().int().optional(), // in grams
  defaultRestTime: z.number().int().optional(), // in seconds
  weightUnitId: z.number().int().min(0).max(2).default(0),
  isFavorite: z.boolean().default(false),
});

export const updateExerciseSchema = createExerciseSchema.partial();
