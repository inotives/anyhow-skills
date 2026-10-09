CREATE TABLE IF NOT EXISTS ohlcv_daily (
  ticker VARCHAR NOT NULL,
  trading_date DATE NOT NULL,
  open DOUBLE NOT NULL,
  high DOUBLE NOT NULL,
  low DOUBLE NOT NULL,
  close DOUBLE NOT NULL,
  adj_close DOUBLE,
  volume BIGINT NOT NULL,
  source VARCHAR NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ticker, trading_date)
);
