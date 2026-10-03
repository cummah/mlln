-- Create backtest_signals table to store pre-computed buy signals for instant page loads
CREATE TABLE IF NOT EXISTS backtest_signals (
  id BIGSERIAL PRIMARY KEY,
  ticker VARCHAR(10) NOT NULL UNIQUE,

  -- 5Y window signals - Weekly
  signals_5y_weekly JSONB,
  current_signal_5y_weekly JSONB,

  -- 5Y window signals - Monthly
  signals_5y_monthly JSONB,
  current_signal_5y_monthly JSONB,

  -- Metadata
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_ticker FOREIGN KEY (ticker) REFERENCES assets(ticker) ON DELETE CASCADE
);

-- Create index for fast lookups by ticker
CREATE INDEX IF NOT EXISTS idx_backtest_signals_ticker ON backtest_signals(ticker);
CREATE INDEX IF NOT EXISTS idx_backtest_signals_updated_at ON backtest_signals(updated_at);
