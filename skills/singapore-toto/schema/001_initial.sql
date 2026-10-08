CREATE TABLE IF NOT EXISTS toto_results (
  draw INTEGER PRIMARY KEY,
  draw_date TEXT NOT NULL UNIQUE,
  winning_number_1 INTEGER NOT NULL,
  winning_number_2 INTEGER NOT NULL,
  winning_number_3 INTEGER NOT NULL,
  winning_number_4 INTEGER NOT NULL,
  winning_number_5 INTEGER NOT NULL,
  winning_number_6 INTEGER NOT NULL,
  additional_number INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
