CREATE TABLE IF NOT EXISTS ohlcv_daily (
  ticker TEXT NOT NULL,
  trading_date TEXT NOT NULL, -- YYYY-MM-DD (UTC)
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  adj_close REAL,
  volume INTEGER NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, -- UTC
  PRIMARY KEY (ticker, trading_date)
);
