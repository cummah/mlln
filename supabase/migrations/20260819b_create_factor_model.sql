-- Create factor_model_loadings and factor_model_history tables
-- Backs the PCA statistical factor model that replaces the hardcoded
-- sector x regime matrix previously used by scripts/compute-macro-backtest.ts

CREATE TABLE IF NOT EXISTS public.factor_model_loadings (
  ticker              TEXT PRIMARY KEY,
  loadings            JSONB NOT NULL,   -- { "f1": 0.12, "f2": -0.05, ... } ticker's exposure to each PCA factor
  explained_variance  JSONB,            -- [0.31, 0.14, 0.09, 0.06, 0.04] variance ratio per factor, fit-wide
  fit_start           DATE,
  fit_end             DATE,
  computed_at         TIMESTAMPTZ DEFAULT now()
);

-- Date-indexed factor "regime" series - plays the role macro_regime_history
-- played before, but the state is estimated (a momentum z-score per factor)
-- instead of a hand-assigned label.
CREATE TABLE IF NOT EXISTS public.factor_model_history (
  date                    DATE NOT NULL,
  factor_index            INTEGER NOT NULL,
  factor_return           NUMERIC,
  factor_momentum_zscore  NUMERIC,
  PRIMARY KEY (date, factor_index)
);

CREATE INDEX IF NOT EXISTS idx_factor_model_history_date ON public.factor_model_history(date);

-- Current blended factor state per asset, surfaced on the daily/weekly/monthly
-- signal pages alongside the existing macro_regime_state/final_conviction_score.
ALTER TABLE public.asset_scores
  ADD COLUMN IF NOT EXISTS factor_regime_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS factor_regime_label TEXT;
