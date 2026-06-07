import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const historyItems = sqliteTable('history_items', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().default('default'),
  type: text('type').notNull(), // 'image', 'video', 'chat', etc.
  timestamp: integer('timestamp').notNull(),
  payload: text('payload').notNull(), // JSON string representing the full item
});
