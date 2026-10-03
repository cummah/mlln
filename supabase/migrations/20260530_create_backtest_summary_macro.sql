-- Create backtest_summary_macro table
-- Same structure as backtest_summary but enh_* columns contain macro-adjusted values
-- instead of signal-enhanced values

CREATE TABLE IF NOT EXISTS public.backtest_summary_macro (
  id SERIAL PRIMARY KEY,
  ticker TEXT UNIQUE NOT NULL,
  name TEXT,
  sector TEXT,
  backtest_start TIMESTAMP,
  backtest_start_year INTEGER,

  -- Weekly DCA - 1 month
  std_return_1m NUMERIC(10,2),
  enh_return_1m NUMERIC(10,2),
  alpha_1m NUMERIC(10,2),
  std_invested_1m NUMERIC(12,2),
  enh_invested_1m NUMERIC(12,2),
  std_value_1m NUMERIC(12,2),
  enh_value_1m NUMERIC(12,2),
  std_purchases_1m INTEGER,
  enh_purchases_1m INTEGER,

  -- Weekly DCA - 3 months
  std_return_3m NUMERIC(10,2),
  enh_return_3m NUMERIC(10,2),
  alpha_3m NUMERIC(10,2),
  std_invested_3m NUMERIC(12,2),
  enh_invested_3m NUMERIC(12,2),
  std_value_3m NUMERIC(12,2),
  enh_value_3m NUMERIC(12,2),
  std_purchases_3m INTEGER,
  enh_purchases_3m INTEGER,

  -- Weekly DCA - 1 year
  std_return_1y NUMERIC(10,2),
  enh_return_1y NUMERIC(10,2),
  alpha_1y NUMERIC(10,2),
  std_invested_1y NUMERIC(12,2),
  enh_invested_1y NUMERIC(12,2),
  std_value_1y NUMERIC(12,2),
  enh_value_1y NUMERIC(12,2),
  std_purchases_1y INTEGER,
  enh_purchases_1y INTEGER,
  std_avg_entry_1y NUMERIC(12,4),
  enh_avg_entry_1y NUMERIC(12,4),
  std_shares_1y NUMERIC(10,2),
  enh_shares_1y NUMERIC(10,2),

  -- Weekly DCA - 3 years
  std_return_3y NUMERIC(10,2),
  enh_return_3y NUMERIC(10,2),
  alpha_3y NUMERIC(10,2),
  std_invested_3y NUMERIC(12,2),
  enh_invested_3y NUMERIC(12,2),
  std_value_3y NUMERIC(12,2),
  enh_value_3y NUMERIC(12,2),
  std_purchases_3y INTEGER,
  enh_purchases_3y INTEGER,
  std_avg_entry_3y NUMERIC(12,4),
  enh_avg_entry_3y NUMERIC(12,4),
  std_shares_3y NUMERIC(10,2),
  enh_shares_3y NUMERIC(10,2),

  -- Weekly DCA - 5 years
  std_return_5y NUMERIC(10,2),
  enh_return_5y NUMERIC(10,2),
  alpha_5y NUMERIC(10,2),
  std_invested_5y NUMERIC(12,2),
  enh_invested_5y NUMERIC(12,2),
  std_value_5y NUMERIC(12,2),
  enh_value_5y NUMERIC(12,2),
  std_purchases_5y INTEGER,
  enh_purchases_5y INTEGER,
  std_avg_entry_5y NUMERIC(12,4),
  enh_avg_entry_5y NUMERIC(12,4),
  std_shares_5y NUMERIC(10,2),
  enh_shares_5y NUMERIC(10,2),

  -- Monthly DCA - 1 month
  monthly_std_return_1m NUMERIC(10,2),
  monthly_enh_return_1m NUMERIC(10,2),
  monthly_alpha_1m NUMERIC(10,2),
  monthly_std_invested_1m NUMERIC(12,2),
  monthly_enh_invested_1m NUMERIC(12,2),
  monthly_std_value_1m NUMERIC(12,2),
  monthly_enh_value_1m NUMERIC(12,2),

  -- Monthly DCA - 3 months
  monthly_std_return_3m NUMERIC(10,2),
  monthly_enh_return_3m NUMERIC(10,2),
  monthly_alpha_3m NUMERIC(10,2),
  monthly_std_invested_3m NUMERIC(12,2),
  monthly_enh_invested_3m NUMERIC(12,2),
  monthly_std_value_3m NUMERIC(12,2),
  monthly_enh_value_3m NUMERIC(12,2),

  -- Monthly DCA - 1 year
  monthly_std_return_1y NUMERIC(10,2),
  monthly_enh_return_1y NUMERIC(10,2),
  monthly_alpha_1y NUMERIC(10,2),
  monthly_std_invested_1y NUMERIC(12,2),
  monthly_enh_invested_1y NUMERIC(12,2),
  monthly_std_value_1y NUMERIC(12,2),
  monthly_enh_value_1y NUMERIC(12,2),
  monthly_std_avg_entry_1y NUMERIC(12,4),
  monthly_enh_avg_entry_1y NUMERIC(12,4),

  -- Monthly DCA - 3 years
  monthly_std_return_3y NUMERIC(10,2),
  monthly_enh_return_3y NUMERIC(10,2),
  monthly_alpha_3y NUMERIC(10,2),
  monthly_std_invested_3y NUMERIC(12,2),
  monthly_enh_invested_3y NUMERIC(12,2),
  monthly_std_value_3y NUMERIC(12,2),
  monthly_enh_value_3y NUMERIC(12,2),
  monthly_std_avg_entry_3y NUMERIC(12,4),
  monthly_enh_avg_entry_3y NUMERIC(12,4),

  -- Monthly DCA - 5 years
  monthly_std_return_5y NUMERIC(10,2),
  monthly_enh_return_5y NUMERIC(10,2),
  monthly_alpha_5y NUMERIC(10,2),
  monthly_std_invested_5y NUMERIC(12,2),
  monthly_enh_invested_5y NUMERIC(12,2),
  monthly_std_value_5y NUMERIC(12,2),
  monthly_enh_value_5y NUMERIC(12,2),
  monthly_std_avg_entry_5y NUMERIC(12,4),
  monthly_enh_avg_entry_5y NUMERIC(12,4),

  -- Metadata
  dca_suitability_score NUMERIC(5,2),
  macro_regime TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backtest_summary_macro_ticker ON public.backtest_summary_macro(ticker);
