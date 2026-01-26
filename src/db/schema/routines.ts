import { pgTable, serial, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const routines = pgTable('routines', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  notes: text('notes'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const routineSections = pgTable('routine_sections', {
  id: serial('id').primaryKey(),
  routineId: integer('routine_id')
    .notNull()
    .references(() => routines.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').default(0),
});

export const routineSectionExercises = pgTable('routine_section_exercises', {
  id: serial('id').primaryKey(),
  sectionId: integer('section_id')
    .notNull()
    .references(() => routineSections.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id').notNull(), // references exercises table
  sortOrder: integer('sort_order').default(0),
  restTimerSeconds: integer('rest_timer_seconds'),
  notes: text('notes'),
});

export const routineSectionExerciseSets = pgTable('routine_section_exercise_sets', {
  id: serial('id').primaryKey(),
  sectionExerciseId: integer('section_exercise_id')
    .notNull()
    .references(() => routineSectionExercises.id, { onDelete: 'cascade' }),
  metricWeight: integer('metric_weight'), // in grams
  reps: integer('reps'),
  distance: integer('distance'), // in meters
  durationSeconds: integer('duration_seconds'),
  sortOrder: integer('sort_order').default(0),
});

// Add relations
export const routinesRelations = relations(routines, ({ one, many }) => ({
  user: one(users, { fields: [routines.userId], references: [users.id] }),
  sections: many(routineSections),
}));

export const routineSectionsRelations = relations(routineSections, ({ one, many }) => ({
  routine: one(routines, { fields: [routineSections.routineId], references: [routines.id] }),
  exercises: many(routineSectionExercises),
}));

export const routineSectionExercisesRelations = relations(routineSectionExercises, ({ one, many }) => ({
  section: one(routineSections, { fields: [routineSectionExercises.sectionId], references: [routineSections.id] }),
  sets: many(routineSectionExerciseSets),
}));

export const routineSectionExerciseSetsRelations = relations(routineSectionExerciseSets, ({ one }) => ({
  sectionExercise: one(routineSectionExercises, {
    fields: [routineSectionExerciseSets.sectionExerciseId],
    references: [routineSectionExercises.id],
  }),
}));
