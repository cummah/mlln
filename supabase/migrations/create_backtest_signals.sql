-- Create backtest_signals table for storing DCA signal data
CREATE TABLE IF NOT EXISTS backtest_signals (
  ticker TEXT PRIMARY KEY,
  signals_5y_weekly JSONB,
  current_signal_5y_weekly JSONB,
  signals_5y_monthly JSONB,
  current_signal_5y_monthly JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on ticker for fast lookups
CREATE INDEX IF NOT EXISTS idx_backtest_signals_ticker ON backtest_signals(ticker);
