-- Asset Backtest Macro Results (Solution 2)
-- Stores backtest returns calculated using Macro-Sector Sensitivity approach
-- Separate from dashboard's Enhanced DCA backtest results
-- Formula: Return = sum(DCA × Sector-Regime Modifier) over historical period

CREATE TABLE IF NOT EXISTS public.asset_backtest_macro (
  id                              serial PRIMARY KEY,
  asset_id                        integer NOT NULL UNIQUE REFERENCES public.assets(id) ON DELETE CASCADE,
  ticker                          text NOT NULL,
  sector                          text,

  -- 5-Year Backtest Results (Macro-Sector Formula)
  macro_return_5y                 double precision,  -- % return with modifiers applied
  macro_invested_5y               double precision,  -- $ actually invested
  macro_final_value_5y            double precision,  -- $ final portfolio value
  macro_buy_count_5y              integer,           -- # of buy signals executed
  macro_skip_count_5y             integer,           -- # of skipped signals

  -- 3-Year Backtest Results
  macro_return_3y                 double precision,
  macro_invested_3y               double precision,
  macro_final_value_3y            double precision,
  macro_buy_count_3y              integer,
  macro_skip_count_3y             integer,

  -- 1-Year Backtest Results
  macro_return_1y                 double precision,
  macro_invested_1y               double precision,
  macro_final_value_1y            double precision,
  macro_buy_count_1y              integer,
  macro_skip_count_1y             integer,

  -- Comparison with Standard DCA (reference)
  standard_dca_return_5y          double precision,  -- For comparison
  alpha_vs_standard_5y            double precision,  -- Macro - Standard

  -- Historical Regime Distribution (for this backtest period)
  regime_goldilocks_pct           double precision,  -- % of time in each regime
  regime_overheating_pct          double precision,
  regime_stagflation_pct          double precision,
  regime_deflation_pct            double precision,

  -- Metadata
  backtest_calculation_method     text DEFAULT 'macro-sector-sensitivity',
  last_calculated_at              timestamptz DEFAULT now(),
  calculated_at                   timestamptz DEFAULT now(),

  CONSTRAINT unique_ticker_macro UNIQUE (ticker)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_abm_asset_id ON public.asset_backtest_macro(asset_id);
CREATE INDEX IF NOT EXISTS idx_abm_ticker ON public.asset_backtest_macro(ticker);
CREATE INDEX IF NOT EXISTS idx_abm_sector ON public.asset_backtest_macro(sector);
CREATE INDEX IF NOT EXISTS idx_abm_return_5y ON public.asset_backtest_macro(macro_return_5y DESC);

COMMENT ON TABLE public.asset_backtest_macro IS
  'Backtest results using Solution 2: Macro-Sector Sensitivity Engine
   Formula: Return = sum(DCA × Sector-Regime Modifier) over historical period
   Completely separate from Enhanced DCA model (dashboard)
   Allows A/B testing both models';

COMMENT ON COLUMN public.asset_backtest_macro.macro_return_5y IS
  'Total return % when applying sector-regime modifiers to DCA signals
   If modifier was 0.9 in Overheating, that signal invested 10% less
   If modifier was 1.15 in Goldilocks, that signal invested 15% more';
