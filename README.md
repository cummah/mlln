# mlln.ai

Dollar cost averaging backtests and daily buy signals for about 2,000 stocks and ETFs. A plain fixed-amount DCA is compared with an
Enhanced DCA that scales each buy by a multiplier from price indicators. Next.js 14 (app router) on Vercel, data in Supabase.

## How the data flows

End-of-day data, loaded once each evening after the US market closes.

1. **Prices.** `scripts/nightly.ts` fetches new daily bars from Yahoo Finance into `daily_prices`.
2. **Signals.** Every indicator is a pure function of the trailing 756 bars, so a historic signal is exactly what it would have been on
   that date. The engine is in `lib/engine`, the database side in `lib/pipeline`. Results go to `buy_signals`, `exit_events`
   and `current_signal`. The `signal_feed` view joins them for the pages.
3. **Integrity checks.** Price coverage, VIX freshness, value ranges, mass-zero columns and entry fills are checked before anything is
   written. If one fails the job exits non-zero and writes nothing.
4. **Summary.** `scripts/summary.ts` rebuilds `backtest_summary` (1m, 3m, 1y, 3y, 5y windows) and the DCA suitability score.
5. **Site refresh.** The workflow calls `/api/revalidate`, and every data page is rebuilt from the new rows.

The pages never query the database per visit. They are rendered once a day (`force-static`) and refreshed by step 5.

The workflow is `.github/workflows/nightly.yml`: 03:30 UTC Tuesday to Saturday, or run it by hand from the Actions tab.

## Setup

```bash
npm ci
cp .env.local.example .env.local   # fill in the values
npm run dev
```

Schema changes are SQL files in `supabase/migrations`, applied by pasting them into the Supabase SQL editor. `supabase/schema.sql`
holds the two base tables (`assets`, `daily_prices`).

## Commands

| Command | What it does |
|---|---|
| `npm run nightly` | The whole nightly job: prices, factors, signals, checks, write |
| `npm run nightly:dry` | The same, but derives and checks without writing signals |
| `npm run backfill` | Rebuild all history from stored prices (long) |
| `npm run summary` | Rebuild the per-ticker summary table |
| `npm run test` | Selftests: engine, factor model, pipeline, signals, summary |
| `npm run assets:*` | Maintain the `assets` list (seed, sync index members, sectors, mark inactive) |

## Rules worth knowing

- Never read `daily_prices` by date across many tickers. The table is indexed by ticker and date together, so a date-wide read
  hits the database statement timeout. Read by ticker.
- Zero means zero. A missing value is `null` and the page shows a dash or "n/a", never a made-up zero.
- `/portfolio` layout is deliberately frozen.
- A GitHub workflow file with a YAML error is rejected silently as a failed run with no jobs. Check it with a YAML parser before pushing.
