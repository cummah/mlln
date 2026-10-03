-- Add 1M and 3M columns to backtest_summary table (weekly DCA)
ALTER TABLE backtest_summary
  ADD COLUMN IF NOT EXISTS std_return_1m    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS enh_return_1m    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS alpha_1m         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS std_invested_1m  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS enh_invested_1m  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS std_value_1m     NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS enh_value_1m     NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS std_purchases_1m INTEGER,
  ADD COLUMN IF NOT EXISTS enh_purchases_1m INTEGER,

  ADD COLUMN IF NOT EXISTS std_return_3m    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS enh_return_3m    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS alpha_3m         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS std_invested_3m  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS enh_invested_3m  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS std_value_3m     NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS enh_value_3m     NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS std_purchases_3m INTEGER,
  ADD COLUMN IF NOT EXISTS enh_purchases_3m INTEGER,

  -- Add monthly DCA columns for 1M and 3M
  ADD COLUMN IF NOT EXISTS monthly_std_return_1m    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_return_1m    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_alpha_1m         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_std_invested_1m  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_invested_1m  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_std_value_1m     NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_value_1m     NUMERIC(15,2),

  ADD COLUMN IF NOT EXISTS monthly_std_return_3m    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_return_3m    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_alpha_3m         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS monthly_std_invested_3m  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_invested_3m  NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_std_value_3m     NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS monthly_enh_value_3m     NUMERIC(15,2);
