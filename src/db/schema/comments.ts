import { pgTable, serial, uuid, date, integer, text } from 'drizzle-orm/pg-core';
import { users } from './users';

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  ownerTypeId: integer('owner_type_id').notNull(),
  ownerId: integer('owner_id').notNull(),
  comment: text('comment').notNull(),
});
