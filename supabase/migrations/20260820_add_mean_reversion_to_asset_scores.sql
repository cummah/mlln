-- Current Ornstein-Uhlenbeck (AR(1)) mean-reversion state per asset, alongside
-- factor_regime_score/label and vol_timing_score/label. Written by
-- scripts/compute-macro-backtest.ts (currentMRBonus), surfaced on the
-- daily/weekly/monthly signal pages as a third, independent filter.
ALTER TABLE public.asset_scores
  ADD COLUMN IF NOT EXISTS mean_reversion_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS mean_reversion_label TEXT;
