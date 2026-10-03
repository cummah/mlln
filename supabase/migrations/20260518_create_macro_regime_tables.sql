-- Create macro_regime_current table
-- Single-row table holding the current macro environment snapshot
-- Written to by Colab notebook, read by frontend for deployment_multiplier calculation
CREATE TABLE IF NOT EXISTS macro_regime_current (
  id              serial PRIMARY KEY,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  macro_score     float,
  regime_label    text,
  yield_curve_spread float,
  credit_spread   float,
  vix_level       float,
  global_trade_signal float,
  us_initial_claims float,
  composite_signal text,
  source_notes    text
);

-- Create macro_regime_history table
-- Date-keyed snapshot history of macro regime values
-- Allows time-series analysis of macro conditions
CREATE TABLE IF NOT EXISTS macro_regime_history (
  id              serial PRIMARY KEY,
  snapshot_date   date UNIQUE NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  macro_score     float,
  regime_label    text,
  yield_curve_spread float,
  credit_spread   float,
  vix_level       float,
  global_trade_signal float,
  us_initial_claims float,
  composite_signal text,
  source_notes    text
);
