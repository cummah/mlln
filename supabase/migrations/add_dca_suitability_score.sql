-- Migration: add dca_suitability_score column to backtest_summary
-- Scores each asset 1-100 on how well-suited it is for Enhanced DCA
-- See types/score-methodology.md for full scoring criteria

ALTER TABLE backtest_summary
  ADD COLUMN IF NOT EXISTS dca_suitability_score numeric(5,2);

COMMENT ON COLUMN backtest_summary.dca_suitability_score IS
  'Composite score 1-100 measuring asset suitability for Enhanced DCA. '
  'Components: alpha consistency (35), absolute profitability (25), '
  'capital efficiency (20), short-term defence (10), weekly/monthly convergence (10). '
  'See types/score-methodology.md for full methodology.';
