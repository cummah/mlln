-- Same as weekly_signal_enrichment (see 20260809_create_weekly_signal_enrichment.sql) but
-- for the monthly page. Computed offline by
-- scripts/compute-monthly-signal-enrichment.ts (run: npm run compute:monthly-enrichment).
-- Monthly's live OHLC fetch was the most expensive of the three signal pages (1825-day
-- lookback per ticker vs weekly's 450), making it the biggest beneficiary of this move.
CREATE TABLE IF NOT EXISTS monthly_signal_enrichment (
  ticker      TEXT PRIMARY KEY,
  signals     JSONB,  -- [{ date, finalMult, performance, exitDate, exitReturn, exitScore, exitOpen }, ...]
  latest_date DATE,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monthly_signal_enrichment_ticker ON monthly_signal_enrichment(ticker);
