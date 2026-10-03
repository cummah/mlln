-- Create signals table to store current weekly and monthly signals
CREATE TABLE IF NOT EXISTS signals (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  ticker VARCHAR(20) UNIQUE NOT NULL,

  -- Weekly signal
  weekly_date DATE,
  weekly_rsi NUMERIC(10, 2),
  weekly_rsi_multiplier NUMERIC(10, 4),
  weekly_ema_distance_pct NUMERIC(10, 2),
  weekly_ema_multiplier NUMERIC(10, 4),
  weekly_adx NUMERIC(10, 2),
  weekly_plus_di NUMERIC(10, 2),
  weekly_minus_di NUMERIC(10, 2),
  weekly_regime VARCHAR(20),
  weekly_regime_multiplier NUMERIC(10, 4),
  weekly_drawdown_pct NUMERIC(10, 2),
  weekly_drawdown_multiplier NUMERIC(10, 4),
  weekly_vix NUMERIC(10, 2),
  weekly_vix_multiplier NUMERIC(10, 4),
  weekly_final_multiplier NUMERIC(10, 4),
  weekly_base_amount NUMERIC(15, 2),
  weekly_final_amount NUMERIC(15, 2),
  weekly_is_capped BOOLEAN,

  -- Monthly signal
  monthly_date DATE,
  monthly_rsi NUMERIC(10, 2),
  monthly_rsi_multiplier NUMERIC(10, 4),
  monthly_ema_distance_pct NUMERIC(10, 2),
  monthly_ema_multiplier NUMERIC(10, 4),
  monthly_adx NUMERIC(10, 2),
  monthly_plus_di NUMERIC(10, 2),
  monthly_minus_di NUMERIC(10, 2),
  monthly_regime VARCHAR(20),
  monthly_regime_multiplier NUMERIC(10, 4),
  monthly_drawdown_pct NUMERIC(10, 2),
  monthly_drawdown_multiplier NUMERIC(10, 4),
  monthly_vix NUMERIC(10, 2),
  monthly_vix_multiplier NUMERIC(10, 4),
  monthly_final_multiplier NUMERIC(10, 4),
  monthly_base_amount NUMERIC(15, 2),
  monthly_final_amount NUMERIC(15, 2),
  monthly_is_capped BOOLEAN,

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_signals_ticker ON signals(ticker);
CREATE INDEX IF NOT EXISTS idx_signals_updated_at ON signals(updated_at DESC);

-- Create signal_history table to track top recent buy opportunities
CREATE TABLE IF NOT EXISTS signal_history (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  ticker VARCHAR(20) NOT NULL,
  frequency VARCHAR(20) NOT NULL,  -- 'weekly' or 'monthly'
  signal_date DATE NOT NULL,       -- when this buy signal occurred in backtest
  rank INTEGER,                     -- rank among recent buys (1 = highest mult)

  rsi NUMERIC(10, 2),
  rsi_multiplier NUMERIC(10, 4),
  ema_distance_pct NUMERIC(10, 2),
  ema_multiplier NUMERIC(10, 4),
  adx NUMERIC(10, 2),
  plus_di NUMERIC(10, 2),
  minus_di NUMERIC(10, 2),
  regime VARCHAR(20),
  regime_multiplier NUMERIC(10, 4),
  drawdown_pct NUMERIC(10, 2),
  drawdown_multiplier NUMERIC(10, 4),
  vix NUMERIC(10, 2),
  vix_multiplier NUMERIC(10, 4),
  final_multiplier NUMERIC(10, 4),
  base_amount NUMERIC(15, 2),
  final_amount NUMERIC(15, 2),
  is_capped BOOLEAN,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(ticker, frequency, signal_date)
);

CREATE INDEX IF NOT EXISTS idx_signal_history_ticker_freq ON signal_history(ticker, frequency);
CREATE INDEX IF NOT EXISTS idx_signal_history_signal_date ON signal_history(signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_signal_history_rank ON signal_history(ticker, frequency, rank);
