-- Asset Folder: Macro-Aware Metrics (Solution 2)
-- Completely separate from dashboard's Enhanced DCA model
-- Used ONLY by app/asset/* pages

CREATE TABLE IF NOT EXISTS public.asset_macro_metrics (
  id                              serial PRIMARY KEY,
  asset_id                        integer NOT NULL UNIQUE REFERENCES public.assets(id) ON DELETE CASCADE,
  ticker                          text NOT NULL,
  sector                          text,

  -- Macro Regime Context
  current_macro_regime            text,              -- Goldilocks, Overheating, Stagflation, Deflation
  macro_regime_updated_at         timestamptz,

  -- Solution 2: Conviction Score = DCA × Sector-Regime Modifier
  conviction_score_current        double precision,  -- Final score for today
  dca_suitability_score           double precision,  -- Base DCA score (from backtest)
  sector_modifier                 double precision,  -- Regime-sector adjustment

  -- Fundamental Quality (UI display only, not in backtest equation)
  fundamental_quality_score       double precision,
  factor_exposures                jsonb,             -- z-scores
  regime_weights                  jsonb,             -- quality/value/growth weights
  staleness_penalty               double precision,  -- time-decay on fundamentals

  -- Signal Data (Weekly frequency)
  weekly_signal_strength          text,              -- 'buy', 'skip', 'sell'
  weekly_signal_amount            double precision,  -- Amount to deploy this week
  weekly_signals_total_5y         integer,           -- Count of buy signals in 5Y

  -- Signal Data (Monthly frequency)
  monthly_signal_strength         text,
  monthly_signal_amount           double precision,
  monthly_signals_total_5y        integer,

  -- Signal Data (Daily frequency)
  daily_signal_strength           text,
  daily_signal_amount             double precision,
  daily_signals_total_5y          integer,

  -- Performance Metrics (Enhanced DCA, from dashboard)
  dca_return_5y                   double precision,  -- % return over 5 years (Enhanced DCA)
  dca_return_3y                   double precision,
  dca_return_1y                   double precision,

  -- Performance Metrics (Macro-Sector Solution 2)
  macro_return_5y                 double precision,  -- % return using sector-regime modifiers
  macro_return_3y                 double precision,
  macro_return_1y                 double precision,
  macro_invested_5y               double precision,  -- $ actually invested with modifiers
  macro_buy_count_5y              integer,           -- # of buy signals executed
  alpha_vs_standard_5y            double precision,  -- Macro return - Standard DCA return

  -- Macro Regime Distribution (during backtest period)
  regime_distribution             jsonb,             -- {goldilocks: %, overheating: %, etc}

  -- Timestamps
  metrics_computed_at             timestamptz DEFAULT now(),
  metrics_updated_at              timestamptz DEFAULT now(),

  CONSTRAINT unique_ticker UNIQUE (ticker)
);

-- Indexes for fast lookups in asset/* pages
CREATE INDEX IF NOT EXISTS idx_amm_asset_id ON public.asset_macro_metrics(asset_id);
CREATE INDEX IF NOT EXISTS idx_amm_ticker ON public.asset_macro_metrics(ticker);
CREATE INDEX IF NOT EXISTS idx_amm_sector ON public.asset_macro_metrics(sector);
CREATE INDEX IF NOT EXISTS idx_amm_conviction ON public.asset_macro_metrics(conviction_score_current DESC);
CREATE INDEX IF NOT EXISTS idx_amm_regime ON public.asset_macro_metrics(current_macro_regime);

COMMENT ON TABLE public.asset_macro_metrics IS
  'Asset Folder Metrics (Solution 2: Macro-Sector Engine)
   Completely separate from dashboard''s Enhanced DCA model
   Conviction Score = DCA × Sector-Regime Modifier
   No look-ahead bias: uses point-in-time data only';
