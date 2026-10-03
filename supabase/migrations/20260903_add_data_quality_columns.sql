-- Add data quality tracking columns to backtest_signals table
ALTER TABLE backtest_signals
ADD COLUMN IF NOT EXISTS data_quality_score NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS warning_message TEXT;
