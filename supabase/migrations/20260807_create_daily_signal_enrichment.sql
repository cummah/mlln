-- Precomputed per-ticker signal enrichment: buy-hold performance by date, plus the
-- compact weekly/monthly buy-date lists used for timeframe alignment. Computed
-- offline by scripts/compute-daily-signal-enrichment.ts (run: npm run compute:daily-enrichment)
-- so app/asset/daily/page.tsx can read it directly instead of live-fetching full
-- OHLC history and the 25-85KB signals_5y_weekly/monthly blobs per ticker on every request.
CREATE TABLE IF NOT EXISTS daily_signal_enrichment (
  ticker              TEXT PRIMARY KEY,
  performance_by_date JSONB,  -- { "2026-07-01": 3.42, ... } buy-hold % return, mark-to-market at compute time
  weekly_buy_dates    JSONB,  -- [epoch_ms, ...] dates where a weekly signal had finalMult > 0
  monthly_buy_dates   JSONB,  -- [epoch_ms, ...] dates where a monthly signal had finalMult > 0
  latest_date         DATE,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_signal_enrichment_ticker ON daily_signal_enrichment(ticker);
