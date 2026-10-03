-- Create asset_scores table
-- Isolated scoring system for app/asset section only
-- Stores computed fundamental quality, DCA suitability, and conviction scores
-- Dashboard and sectors pages do NOT use this table

CREATE TABLE IF NOT EXISTS public.asset_scores (
  id              serial PRIMARY KEY,
  asset_id        integer NOT NULL UNIQUE REFERENCES public.assets(id) ON DELETE CASCADE,

  -- Core scores
  fundamental_quality_score    double precision,
  dca_suitability_score        double precision,
  final_conviction_score       double precision,

  -- Factor analysis
  factor_exposures             jsonb,  -- { "z_roic": 0.8, "z_ev_ebitda": -0.2, "z_roc": 1.1, ... }
  information_coefficient      double precision,
  information_coefficient_ir   double precision,

  -- Macro context
  macro_regime_state           text,    -- 'Goldilocks', 'Overheating', 'Stagflation', 'Deflation'
  regime_weights               jsonb,   -- { "quality": 0.4, "value": 0.3, "growth": 0.3 }

  -- Time decay
  staleness_penalty            double precision,  -- exp(-lambda * days_since_update)

  -- Metadata
  computed_at                  timestamptz DEFAULT now(),
  updated_at                   timestamptz DEFAULT now(),

  -- Audit trail
  computation_notes            text
);

-- Index for fast lookups in app/asset
CREATE INDEX IF NOT EXISTS idx_asset_scores_asset_id ON public.asset_scores(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_scores_macro_regime ON public.asset_scores(macro_regime_state);
CREATE INDEX IF NOT EXISTS idx_asset_scores_conviction ON public.asset_scores(final_conviction_score DESC);

-- Create macro_regime_weights table
-- Maps regime states to factor weight vectors
CREATE TABLE IF NOT EXISTS public.macro_regime_weights (
  id              serial PRIMARY KEY,
  regime_state    text NOT NULL UNIQUE,  -- 'Goldilocks', 'Overheating', 'Stagflation', 'Deflation'

  -- Factor weights (must sum to 1.0)
  weight_quality  double precision DEFAULT 0.4,
  weight_value    double precision DEFAULT 0.3,
  weight_growth   double precision DEFAULT 0.3,

  -- Optional: sentiment/momentum weights
  weight_momentum double precision DEFAULT 0.0,

  description     text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Seed default regime weights
INSERT INTO public.macro_regime_weights (regime_state, weight_quality, weight_value, weight_growth, description)
VALUES
  ('Goldilocks', 0.4, 0.3, 0.3, 'Stable growth, balanced portfolio'),
  ('Overheating', 0.5, 0.2, 0.3, 'High inflation, quality favored'),
  ('Stagflation', 0.6, 0.2, 0.2, 'High risk, quality defensive'),
  ('Deflation', 0.2, 0.5, 0.3, 'Risk-off, value opportunity')
ON CONFLICT (regime_state) DO NOTHING;
