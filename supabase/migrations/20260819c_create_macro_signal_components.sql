-- Create macro_signal_components table
-- Raw per-buy PCA factor tilt + EWMA volatility components (kept separate, not combined)
-- for each ticker's weekly/monthly buy dates. Backs the live Factor Tilt / Volatility
-- Timing toggles on the ticker page (app/api/asset/[ticker]/macro-backtest), which
-- recombine them on demand via lib/macroBacktestEngine.ts instead of reading the single
-- combined number baked into backtest_summary_macro.

CREATE TABLE IF NOT EXISTS public.macro_signal_components (
  ticker        TEXT PRIMARY KEY,
  weekly_buys   JSONB NOT NULL,   -- [{ date, close, factorModifier, volBonus }, ...]
  monthly_buys  JSONB NOT NULL,   -- same shape, monthly cadence
  latest_close  NUMERIC,
  updated_at    TIMESTAMPTZ DEFAULT now()
);
