import { z } from 'zod';

export const createTrainingLogSchema = z.object({
  exerciseId: z.number().int().positive(),
  workoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  metricWeight: z.number().int().min(0), // in grams
  reps: z.number().int().min(0),
  unit: z.number().int().min(0).max(2).default(0),
  distance: z.number().int().min(0).default(0), // in meters
  durationSeconds: z.number().int().min(0).default(0),
  isComplete: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  workoutGroupId: z.number().int().optional(),
});

export const updateTrainingLogSchema = createTrainingLogSchema.partial().extend({
  isPersonalRecord: z.boolean().optional(),
});
