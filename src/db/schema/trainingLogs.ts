import { pgTable, serial, integer, date, boolean, timestamp } from 'drizzle-orm/pg-core';
import { exercises } from './exercises';
import { workoutGroups } from './workoutGroups';

export const trainingLogs = pgTable('training_logs', {
  id: serial('id').primaryKey(),
  exerciseId: integer('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  workoutDate: date('workout_date').notNull(),
  metricWeight: integer('metric_weight').notNull(),
  reps: integer('reps').notNull(),
  unit: integer('unit').notNull().default(0),
  distance: integer('distance').notNull().default(0),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  isPersonalRecord: boolean('is_personal_record').notNull().default(false),
  isPersonalRecordFirst: boolean('is_personal_record_first').notNull().default(false),
  isComplete: boolean('is_complete').notNull().default(false),
  isPendingUpdate: boolean('is_pending_update').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  workoutGroupId: integer('workout_group_id').references(() => workoutGroups.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
