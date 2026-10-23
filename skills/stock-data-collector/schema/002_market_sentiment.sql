CREATE TABLE IF NOT EXISTS market_sentiment (
  ticker TEXT NOT NULL, -- same normalized ticker as ohlcv_daily.ticker
  sentiment_date TEXT NOT NULL, -- YYYY-MM-DD the analysis was created (UTC)
  level TEXT NOT NULL CHECK (level IN ('negative', 'neutral', 'positive')),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100), -- 0 most negative, 100 most positive
  analysis TEXT NOT NULL, -- full sentiment analysis text
  sources TEXT NOT NULL, -- JSON array of {"publisher", "url"} from allowlisted news outlets
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, -- UTC
  PRIMARY KEY (ticker, sentiment_date)
);
