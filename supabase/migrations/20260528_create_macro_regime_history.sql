-- Create macro_regime_history table for historical regime classifications
-- Tracks daily regime classifications based on FRED macro data

CREATE TABLE IF NOT EXISTS public.macro_regime_history (
  id                    serial PRIMARY KEY,
  regime_date           date NOT NULL UNIQUE,
  regime_label          text NOT NULL,

  -- Macro indicators used for classification
  vix_level             double precision,
  yield_curve_slope     double precision,
  inflation_rate        double precision,
  unemployment_rate     double precision,

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Index for fast lookups by date
CREATE INDEX IF NOT EXISTS idx_macro_regime_history_date ON public.macro_regime_history(regime_date DESC);

-- Index for looking up regime on or before a specific date
CREATE INDEX IF NOT EXISTS idx_macro_regime_history_date_asc ON public.macro_regime_history(regime_date ASC);
