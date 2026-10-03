CREATE TABLE IF NOT EXISTS daily_signals (
  ticker        TEXT PRIMARY KEY,
  signals_1y    JSONB,
  current_signal JSONB,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_signals_ticker ON daily_signals(ticker);
