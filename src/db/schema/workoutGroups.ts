import { pgTable, serial, uuid, text, date, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

export const workoutGroups = pgTable('workout_groups', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name'),
  workoutDate: date('workout_date').notNull(),
  color: text('color'),
  autoJumpEnabled: boolean('auto_jump_enabled').notNull().default(true),
  restTimerAutoStart: boolean('rest_timer_auto_start').notNull().default(false),
});
