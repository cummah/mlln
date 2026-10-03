-- Add sector_modifier column to support Solution 2: Macro-Sector Sensitivity Engine
-- This column stores the regime-sector modifier applied to DCA scores

ALTER TABLE public.asset_scores
ADD COLUMN IF NOT EXISTS sector_modifier double precision DEFAULT 1.0;

ALTER TABLE public.asset_scores_history
ADD COLUMN IF NOT EXISTS sector_modifier double precision DEFAULT 1.0;

-- Update comment to reflect Solution 2
COMMENT ON TABLE public.asset_scores IS
  'Solution 2: Macro-Sector Sensitivity Engine
   Final Conviction = DCA Score * Sector Modifier
   Removes look-ahead bias by dropping stock-specific fundamentals from backtest equation
   Fundamental scores retained for UI display only';

COMMENT ON COLUMN public.asset_scores.sector_modifier IS
  'Regime-sector modifier: DCA * modifier = Final Conviction
   Goldilocks: Tech +15%, Energy -10%
   Overheating: Energy +15%, Tech -10%
   Stagflation: Energy +30%, Tech -30%
   Deflation: Real Estate +15%, Energy -25%';
