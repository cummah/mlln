-- Precomputed per-ticker weekly signal enrichment: buy-hold performance and exit fields
-- for each ticker's most recent weekly signals. Computed offline by
-- scripts/compute-weekly-signal-enrichment.ts (run: npm run compute:weekly-enrichment) so
-- app/asset/weekly/page.tsx can read it directly instead of live-fetching 450 days of OHLC
-- and the full backtest_signals row (including the unused monthly blob) per ticker on
-- every request — the same fix already applied to the daily page.
CREATE TABLE IF NOT EXISTS weekly_signal_enrichment (
  ticker      TEXT PRIMARY KEY,
  signals     JSONB,  -- [{ date, finalMult, performance, exitDate, exitReturn, exitScore, exitOpen }, ...]
  latest_date DATE,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_signal_enrichment_ticker ON weekly_signal_enrichment(ticker);
