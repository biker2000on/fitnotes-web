import { pgTable, serial, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';
import { categories } from './categories';

export const exercises = pgTable('exercises', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  exerciseTypeId: integer('exercise_type_id').notNull().default(0),
  notes: text('notes'),
  weightIncrement: integer('weight_increment'),
  defaultGraphId: integer('default_graph_id'),
  defaultRestTime: integer('default_rest_time'),
  weightUnitId: integer('weight_unit_id').notNull().default(0),
  isFavorite: boolean('is_favorite').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const exercisesRelations = relations(exercises, ({ one }) => ({
  user: one(users, {
    fields: [exercises.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [exercises.categoryId],
    references: [categories.id],
  }),
}));
