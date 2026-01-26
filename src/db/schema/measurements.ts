import { pgTable, serial, uuid, varchar, text, integer, real, timestamp, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

export const measurements = pgTable('measurements', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(), // e.g., "Body Weight", "Chest", "Waist"
  unitId: integer('unit_id').default(0), // 0=kg, 1=lbs, 2=cm, 3=inches
  goalType: integer('goal_type'), // 0=none, 1=increase, 2=decrease, 3=target
  goalValue: real('goal_value'),
  goalDate: timestamp('goal_date'),
  sortOrder: integer('sort_order').default(0),
  isDefault: boolean('is_default').default(false), // Body weight is default
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const measurementRecords = pgTable('measurement_records', {
  id: serial('id').primaryKey(),
  measurementId: integer('measurement_id')
    .notNull()
    .references(() => measurements.id, { onDelete: 'cascade' }),
  date: timestamp('date').notNull(),
  value: real('value').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
