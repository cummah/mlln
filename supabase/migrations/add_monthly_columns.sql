-- Add monthly DCA columns to backtest_summary table

ALTER TABLE backtest_summary
  ADD COLUMN IF NOT EXISTS monthly_std_return_1y  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_return_1y  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_alpha_1y        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_std_invested_1y NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_invested_1y NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_std_value_1y    NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_value_1y    NUMERIC(15,2),

  ADD COLUMN IF NOT EXISTS monthly_std_return_3y  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_return_3y  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_alpha_3y        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_std_invested_3y NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_invested_3y NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_std_value_3y    NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_value_3y    NUMERIC(15,2),

  ADD COLUMN IF NOT EXISTS monthly_std_return_5y  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_return_5y  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_alpha_5y        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_std_invested_5y NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_invested_5y NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_std_value_5y    NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_value_5y    NUMERIC(15,2);
