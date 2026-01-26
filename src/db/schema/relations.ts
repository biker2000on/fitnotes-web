import { relations } from 'drizzle-orm';
import { users } from './users';
import { accounts } from './accounts';
import { sessions } from './sessions';
import { categories } from './categories';
import { exercises } from './exercises';
import { trainingLogs } from './trainingLogs';
import { workoutGroups } from './workoutGroups';
import { comments } from './comments';
import { workoutTimes } from './workoutTimes';
import { userSettings } from './userSettings';
import { routines, routineSections, routineSectionExercises, routineSectionExerciseSets } from './routines';
import { measurements, measurementRecords } from './measurements';
import { goals } from './goals';

// Users relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  categories: many(categories),
  exercises: many(exercises),
  routines: many(routines),
  goals: many(goals),
  measurements: many(measurements),
  userSettings: many(userSettings),
  workoutTimes: many(workoutTimes),
  workoutGroups: many(workoutGroups),
  comments: many(comments),
}));

// Accounts relations
export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

// Sessions relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

// Categories relations
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  exercises: many(exercises),
}));

// Exercises relations
export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  user: one(users, { fields: [exercises.userId], references: [users.id] }),
  category: one(categories, { fields: [exercises.categoryId], references: [categories.id] }),
  trainingLogs: many(trainingLogs),
  goals: many(goals),
}));

// Training logs relations
export const trainingLogsRelations = relations(trainingLogs, ({ one, many }) => ({
  exercise: one(exercises, { fields: [trainingLogs.exerciseId], references: [exercises.id] }),
  workoutGroup: one(workoutGroups, { fields: [trainingLogs.workoutGroupId], references: [workoutGroups.id] }),
  comments: many(comments),
}));

// Workout groups relations
export const workoutGroupsRelations = relations(workoutGroups, ({ one, many }) => ({
  user: one(users, { fields: [workoutGroups.userId], references: [users.id] }),
  trainingLogs: many(trainingLogs),
}));

// Comments relations
export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(users, { fields: [comments.userId], references: [users.id] }),
  trainingLog: one(trainingLogs, { fields: [comments.ownerId], references: [trainingLogs.id] }),
}));

// Workout times relations
export const workoutTimesRelations = relations(workoutTimes, ({ one }) => ({
  user: one(users, { fields: [workoutTimes.userId], references: [users.id] }),
}));

// User settings relations
export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}));

// Routines relations
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
  exercise: one(exercises, { fields: [routineSectionExercises.exerciseId], references: [exercises.id] }),
  sets: many(routineSectionExerciseSets),
}));

export const routineSectionExerciseSetsRelations = relations(routineSectionExerciseSets, ({ one }) => ({
  sectionExercise: one(routineSectionExercises, {
    fields: [routineSectionExerciseSets.sectionExerciseId],
    references: [routineSectionExercises.id],
  }),
}));

// Measurements relations
export const measurementsRelations = relations(measurements, ({ one, many }) => ({
  user: one(users, { fields: [measurements.userId], references: [users.id] }),
  records: many(measurementRecords),
}));

export const measurementRecordsRelations = relations(measurementRecords, ({ one }) => ({
  measurement: one(measurements, { fields: [measurementRecords.measurementId], references: [measurements.id] }),
}));

// Goals relations
export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  exercise: one(exercises, { fields: [goals.exerciseId], references: [exercises.id] }),
}));
