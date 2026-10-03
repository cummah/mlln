-- Add fundamental columns to the assets table
ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS industry text,
ADD COLUMN IF NOT EXISTS long_business_summary text,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS market_cap bigint,
ADD COLUMN IF NOT EXISTS beta numeric,
ADD COLUMN IF NOT EXISTS trailing_pe numeric,
ADD COLUMN IF NOT EXISTS dividend_yield numeric,
ADD COLUMN IF NOT EXISTS profit_margins numeric,
ADD COLUMN IF NOT EXISTS ev_ebitda numeric,
ADD COLUMN IF NOT EXISTS ev_fcf numeric,
ADD COLUMN IF NOT EXISTS roic numeric,
ADD COLUMN IF NOT EXISTS gross_profitability numeric,
ADD COLUMN IF NOT EXISTS operating_cash_flow numeric,
ADD COLUMN IF NOT EXISTS fundamentals_last_updated timestamptz,
ADD COLUMN IF NOT EXISTS tags text[],
ADD COLUMN IF NOT EXISTS tags_generated_at timestamptz;

-- Add GIN index for fast tag filtering
CREATE INDEX IF NOT EXISTS idx_assets_tags ON public.assets USING GIN(tags);

-- Add advanced scoring columns to the backtest_summary table
ALTER TABLE public.backtest_summary
ADD COLUMN IF NOT EXISTS fundamental_quality_score double precision,
ADD COLUMN IF NOT EXISTS final_conviction_score double precision,
ADD COLUMN IF NOT EXISTS factor_exposures jsonb,
ADD COLUMN IF NOT EXISTS ic_score double precision,
ADD COLUMN IF NOT EXISTS icir double precision;
