import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const historyItems = sqliteTable('history_items', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'image', 'video', 'chat', etc.
  timestamp: integer('timestamp').notNull(),
  payload: text('payload').notNull(), // JSON string representing the full item
});
