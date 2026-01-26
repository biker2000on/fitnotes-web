import { pgTable, serial, uuid, integer, real, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { exercises } from './exercises';

// Goal types: 0=max_weight, 1=max_reps, 2=total_volume, 3=max_1rm,
//             4=total_distance, 5=total_duration, 6=workout_count

export const goals = pgTable('goals', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id').references(() => exercises.id, { onDelete: 'cascade' }),
  goalTypeId: integer('goal_type_id').notNull(), // 0-6 as above
  targetValue: real('target_value').notNull(),
  startDate: timestamp('start_date'),
  targetDate: timestamp('target_date'),
  isCompleted: boolean('is_completed').default(false),
  completedAt: timestamp('completed_at'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  exercise: one(exercises, { fields: [goals.exerciseId], references: [exercises.id] }),
}));
