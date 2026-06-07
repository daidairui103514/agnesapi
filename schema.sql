CREATE TABLE IF NOT EXISTS history_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  payload TEXT NOT NULL
);
