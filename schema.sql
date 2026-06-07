CREATE TABLE IF NOT EXISTS history_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'default',
  timestamp INTEGER NOT NULL,
  payload TEXT NOT NULL
);
