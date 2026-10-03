-- Current EWMA volatility-timing state per asset, alongside factor_regime_score/label.
-- Written by scripts/compute-macro-backtest.ts (currentVolBonus), surfaced on the
-- daily/weekly/monthly signal pages as a second, independent filter next to Factor Regime.
ALTER TABLE public.asset_scores
  ADD COLUMN IF NOT EXISTS vol_timing_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS vol_timing_label TEXT;
