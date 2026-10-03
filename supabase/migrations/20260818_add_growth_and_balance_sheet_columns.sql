-- Growth and balance-sheet health columns sourced from stockanalysis.com,
-- to complement the existing point-in-time value/quality columns.
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS revenue bigint,
ADD COLUMN IF NOT EXISTS revenue_growth numeric,
ADD COLUMN IF NOT EXISTS net_income_growth numeric,
ADD COLUMN IF NOT EXISTS eps_growth numeric,
ADD COLUMN IF NOT EXISTS debt_to_equity numeric,
ADD COLUMN IF NOT EXISTS current_ratio numeric,
ADD COLUMN IF NOT EXISTS roe numeric;
