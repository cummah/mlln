-- Add missing macro performance columns to asset_macro_metrics

ALTER TABLE public.asset_macro_metrics
ADD COLUMN IF NOT EXISTS macro_return_5y double precision,
ADD COLUMN IF NOT EXISTS macro_return_3y double precision,
ADD COLUMN IF NOT EXISTS macro_return_1y double precision,
ADD COLUMN IF NOT EXISTS macro_invested_5y double precision,
ADD COLUMN IF NOT EXISTS macro_buy_count_5y integer,
ADD COLUMN IF NOT EXISTS alpha_vs_standard_5y double precision,
ADD COLUMN IF NOT EXISTS regime_distribution jsonb;
