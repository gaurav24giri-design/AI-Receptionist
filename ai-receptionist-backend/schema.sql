CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT,
  email TEXT,
  message TEXT NOT NULL,
  reply TEXT,
  urgent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);