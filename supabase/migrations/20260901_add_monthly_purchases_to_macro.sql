-- Add monthly purchase count columns to backtest_summary_macro table
-- These track the number of purchases made in each window for monthly DCA

ALTER TABLE public.backtest_summary_macro
ADD COLUMN IF NOT EXISTS monthly_std_purchases_1m INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_enh_purchases_1m INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_skipped_1m INTEGER DEFAULT 0,

ADD COLUMN IF NOT EXISTS monthly_std_purchases_3m INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_enh_purchases_3m INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_skipped_3m INTEGER DEFAULT 0,

ADD COLUMN IF NOT EXISTS monthly_std_purchases_1y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_enh_purchases_1y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_skipped_1y INTEGER DEFAULT 0,

ADD COLUMN IF NOT EXISTS monthly_std_purchases_3y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_enh_purchases_3y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_skipped_3y INTEGER DEFAULT 0,

ADD COLUMN IF NOT EXISTS monthly_std_purchases_5y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_enh_purchases_5y INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_skipped_5y INTEGER DEFAULT 0;
