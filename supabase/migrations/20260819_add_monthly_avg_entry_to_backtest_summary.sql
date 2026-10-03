-- backtest_summary was missing monthly avg-entry columns (add_monthly_columns.sql added
-- monthly return/invested/value but not avg_entry), so the Monthly DCA Calculator always
-- showed $0 avg entry for the default Signal-Enhanced model. backtest_summary_macro already
-- has these columns (see 20260530_create_backtest_summary_macro.sql) — mirroring them here.

ALTER TABLE backtest_summary
  ADD COLUMN IF NOT EXISTS monthly_std_avg_entry_1y NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS monthly_enh_avg_entry_1y NUMERIC(12,4),

  ADD COLUMN IF NOT EXISTS monthly_std_avg_entry_3y NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS monthly_enh_avg_entry_3y NUMERIC(12,4),

  ADD COLUMN IF NOT EXISTS monthly_std_avg_entry_5y NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS monthly_enh_avg_entry_5y NUMERIC(12,4);
