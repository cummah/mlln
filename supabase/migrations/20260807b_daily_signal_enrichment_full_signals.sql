-- Supersedes the performance_by_date/weekly_buy_dates/monthly_buy_dates columns with a
-- single `signals` array that carries everything app/asset/daily/page.tsx needs per
-- signal (finalMult, performance, exit fields, alignment days already matched). This
-- was needed because scaling the ticker scope past ~60 (e.g. to a DCA score>50 cutoff,
-- ~587 tickers) made the live signals_1y bulk fetch time out at the Postgres level —
-- baking the trimmed, already-computed signal list into this table removes page.tsx's
-- dependency on signals_1y entirely, not just the OHLC/alignment-blob cost.
ALTER TABLE daily_signal_enrichment
  DROP COLUMN IF EXISTS performance_by_date,
  DROP COLUMN IF EXISTS weekly_buy_dates,
  DROP COLUMN IF EXISTS monthly_buy_dates,
  ADD COLUMN IF NOT EXISTS signals JSONB;
