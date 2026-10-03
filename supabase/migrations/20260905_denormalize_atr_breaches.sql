-- Create table to store ATR breach data separately from signals_1y JSON
CREATE TABLE IF NOT EXISTS daily_signal_atr_breaches (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  ticker TEXT NOT NULL,
  signal_date TEXT NOT NULL,
  atr_multiplier DECIMAL(3, 1) NOT NULL,
  breach_date TEXT,
  breach_return DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (ticker, signal_date, atr_multiplier)
);

CREATE INDEX IF NOT EXISTS idx_daily_signal_atr_breaches_ticker ON daily_signal_atr_breaches(ticker);
CREATE INDEX IF NOT EXISTS idx_daily_signal_atr_breaches_signal_date ON daily_signal_atr_breaches(signal_date);
CREATE INDEX IF NOT EXISTS idx_daily_signal_atr_breaches_ticker_signal_date ON daily_signal_atr_breaches(ticker, signal_date);
