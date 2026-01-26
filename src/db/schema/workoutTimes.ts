import { pgTable, serial, uuid, date, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const workoutTimes = pgTable('workout_times', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  workoutDate: date('workout_date').notNull(),
  startDateTime: timestamp('start_date_time').notNull(),
  endDateTime: timestamp('end_date_time').notNull(),
});
