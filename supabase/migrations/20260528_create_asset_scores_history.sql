-- Create asset_scores_history table
-- Daily snapshots of conviction and fundamental scores for each asset
-- Used to show scores as they were at the time each signal fired

CREATE TABLE IF NOT EXISTS public.asset_scores_history (
  id                          serial PRIMARY KEY,
  asset_id                    integer NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  snapshot_date               date NOT NULL,

  fundamental_quality_score   double precision,
  dca_suitability_score       double precision,
  final_conviction_score      double precision,
  macro_regime_state          text,
  staleness_penalty           double precision,

  created_at                  timestamptz DEFAULT now(),

  CONSTRAINT uq_ash_asset_date UNIQUE (asset_id, snapshot_date)
);

-- Index for fast lookup by asset_id and date
CREATE INDEX IF NOT EXISTS idx_ash_asset_date ON public.asset_scores_history(asset_id, snapshot_date DESC);

-- Index for finding most recent score before a given date
CREATE INDEX IF NOT EXISTS idx_ash_date ON public.asset_scores_history(snapshot_date DESC);
