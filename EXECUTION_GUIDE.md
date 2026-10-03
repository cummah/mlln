# Complete Execution Guide: Solution 2 Implementation

## Overview

This guide walks through the complete setup of Solution 2 (Macro-Sector Engine) for the asset folder, completely separate from the dashboard folder's Enhanced DCA model.

**System Architecture:**
```
Dashboard Folder (Enhanced DCA) ←→ Asset Folder (Solution 2)
↓                                  ↓
backtest_summary                  asset_backtest_macro
backtest_signals          +        asset_macro_metrics
                          ↓
                    Compare 2 Models
```

---

## Prerequisites

Ensure these scripts have been run (they should be from previous steps):
- ✅ `scripts/update-macro-regime.ts` — Current macro regime
- ✅ `scripts/recalculate-macro-history.ts` — Historical macro regimes
- ✅ `scripts/compute-conviction-scores.ts` — Conviction scores with modifiers

Check that these tables exist with data:
```bash
# In Supabase SQL Editor
SELECT COUNT(*) FROM asset_scores;           -- Should show ~700+
SELECT COUNT(*) FROM macro_regime_history;   -- Should show 1000+
SELECT COUNT(*) FROM backtest_signals;       -- Should show 5000+
```

---

## Step 1: Apply First Migration (Asset Backtest Macro)

**File:** `supabase/migrations/20260529_create_asset_backtest_macro.sql`

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
CREATE TABLE IF NOT EXISTS public.asset_backtest_macro (
  id                              serial PRIMARY KEY,
  asset_id                        integer NOT NULL UNIQUE REFERENCES public.assets(id) ON DELETE CASCADE,
  ticker                          text NOT NULL,
  sector                          text,

  macro_return_5y                 double precision,
  macro_invested_5y               double precision,
  macro_final_value_5y            double precision,
  macro_buy_count_5y              integer,
  macro_skip_count_5y             integer,

  macro_return_3y                 double precision,
  macro_invested_3y               double precision,
  macro_final_value_3y            double precision,
  macro_buy_count_3y              integer,
  macro_skip_count_3y             integer,

  macro_return_1y                 double precision,
  macro_invested_1y               double precision,
  macro_final_value_1y            double precision,
  macro_buy_count_1y              integer,
  macro_skip_count_1y             integer,

  standard_dca_return_5y          double precision,
  alpha_vs_standard_5y            double precision,

  regime_goldilocks_pct           double precision,
  regime_overheating_pct          double precision,
  regime_stagflation_pct          double precision,
  regime_deflation_pct            double precision,

  backtest_calculation_method     text DEFAULT 'macro-sector-sensitivity',
  last_calculated_at              timestamptz DEFAULT now(),
  calculated_at                   timestamptz DEFAULT now(),

  CONSTRAINT unique_ticker_macro UNIQUE (ticker)
);

CREATE INDEX IF NOT EXISTS idx_abm_asset_id ON public.asset_backtest_macro(asset_id);
CREATE INDEX IF NOT EXISTS idx_abm_ticker ON public.asset_backtest_macro(ticker);
CREATE INDEX IF NOT EXISTS idx_abm_sector ON public.asset_backtest_macro(sector);
CREATE INDEX IF NOT EXISTS idx_abm_return_5y ON public.asset_backtest_macro(macro_return_5y DESC);
```

**Verify:** Should return `0 rows` (table creation)

---

## Step 2: Apply Second Migration (Asset Macro Metrics)

**File:** `supabase/migrations/20260529_create_asset_macro_metrics.sql`

Run in same SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS public.asset_macro_metrics (
  id                              serial PRIMARY KEY,
  asset_id                        integer NOT NULL UNIQUE REFERENCES public.assets(id) ON DELETE CASCADE,
  ticker                          text NOT NULL,
  sector                          text,

  current_macro_regime            text,
  macro_regime_updated_at         timestamptz,

  conviction_score_current        double precision,
  dca_suitability_score           double precision,
  sector_modifier                 double precision,

  fundamental_quality_score       double precision,
  factor_exposures                jsonb,
  regime_weights                  jsonb,
  staleness_penalty               double precision,

  weekly_signal_strength          text,
  weekly_signal_amount            double precision,
  weekly_signals_total_5y         integer,

  monthly_signal_strength         text,
  monthly_signal_amount           double precision,
  monthly_signals_total_5y        integer,

  daily_signal_strength           text,
  daily_signal_amount             double precision,
  daily_signals_total_5y          integer,

  dca_return_5y                   double precision,
  dca_return_3y                   double precision,
  dca_return_1y                   double precision,

  macro_return_5y                 double precision,
  macro_return_3y                 double precision,
  macro_return_1y                 double precision,
  macro_invested_5y               double precision,
  macro_buy_count_5y              integer,
  alpha_vs_standard_5y            double precision,

  regime_distribution             jsonb,

  metrics_computed_at             timestamptz DEFAULT now(),
  metrics_updated_at              timestamptz DEFAULT now(),

  CONSTRAINT unique_ticker UNIQUE (ticker)
);

CREATE INDEX IF NOT EXISTS idx_amm_asset_id ON public.asset_macro_metrics(asset_id);
CREATE INDEX IF NOT EXISTS idx_amm_ticker ON public.asset_macro_metrics(ticker);
CREATE INDEX IF NOT EXISTS idx_amm_sector ON public.asset_macro_metrics(sector);
CREATE INDEX IF NOT EXISTS idx_amm_conviction ON public.asset_macro_metrics(conviction_score_current DESC);
CREATE INDEX IF NOT EXISTS idx_amm_regime ON public.asset_macro_metrics(current_macro_regime);
```

**Verify:** Table created successfully

---

## Step 3: Calculate Macro Backtest Results

**Script:** `scripts/calculate-asset-backtest-macro.ts`

This is the heavy lifting—recalculates all backtests with sector-regime modifiers applied:

```bash
cd c:\Users\Dell\mlln-ai
npx ts-node --project tsconfig.scripts.json scripts/calculate-asset-backtest-macro.ts
```

**What it does:**
- For each asset, gets all historical DCA signals
- For each signal date, looks up the macro regime at that time
- Applies sector-regime modifier to the DCA investment amount
- Recalculates returns using modified amounts
- Stores in `asset_backtest_macro` table

**Expected output:**
```
Found 716 assets to backtest
Processed 50 assets...
Processed 100 assets...
...
Upserting 716 backtest results...
✓ Successfully upserted all backtest results
✓ Backtest calculation complete: 716 processed, 0 failed
```

**Time:** ~2-5 minutes (fetches macro regimes for thousands of signals)

**Verify:**
```sql
SELECT COUNT(*), AVG(macro_return_5y), MIN(macro_return_5y), MAX(macro_return_5y)
FROM asset_backtest_macro;
-- Should show: 716 rows, average return, min/max ranges
```

---

## Step 4: Populate Asset Macro Metrics

**Script:** `scripts/populate-asset-macro-metrics.ts`

Merges data from all sources into a single metrics table:

```bash
npx ts-node --project tsconfig.scripts.json scripts/populate-asset-macro-metrics.ts
```

**What it does:**
- Pulls current conviction scores from `asset_scores`
- Pulls macro backtest results from `asset_backtest_macro`
- Pulls signals from `backtest_signals`
- Pulls DCA returns from `backtest_summary` (for comparison)
- Merges all into `asset_macro_metrics` table

**Expected output:**
```
Found 716 active assets to process
Upserting 716 rows into asset_macro_metrics...
✓ Successfully upserted all rows
✓ Population complete: 716 processed, 0 failed
```

**Verify:**
```sql
SELECT ticker, conviction_score_current, macro_return_5y, dca_return_5y, alpha_vs_standard_5y
FROM asset_macro_metrics
WHERE ticker IN ('AAPL', 'TSLA', 'XLE')
ORDER BY ticker;
```

---

## Step 5: Create New API Route for Asset Folder

**File:** `app/api/asset/[ticker]/metrics/route.ts`

Already created. This route returns data from `asset_macro_metrics` table, completely separate from `/api/dashboard/[ticker]`.

---

## Step 6: Update Asset Folder Pages

Update these files to use the new API endpoint:

### 6a. `app/asset/[ticker]/page.tsx`

Find this line:
```typescript
const url = `${protocol}://${host}/api/dashboard/${ticker}`;
```

Replace with:
```typescript
const url = `${protocol}://${host}/api/asset/${ticker}/metrics`;
```

### 6b. `app/asset/daily/page.tsx`

Same change: `/api/dashboard/` → `/api/asset/[ticker]/metrics`

### 6c. `app/asset/weekly/page.tsx`

Same change.

### 6d. `app/asset/monthly/page.tsx`

Same change.

---

## Verification Checklist

After all steps complete:

```bash
# 1. Check migrations applied
# In Supabase SQL Editor:
SELECT COUNT(*) FROM asset_backtest_macro;  -- Should be ~716
SELECT COUNT(*) FROM asset_macro_metrics;   -- Should be ~716

# 2. Spot-check data
SELECT ticker, sector, conviction_score_current, sector_modifier, 
       macro_return_5y, dca_return_5y, alpha_vs_standard_5y,
       current_macro_regime
FROM asset_macro_metrics
WHERE ticker IN ('AAPL', 'MSFT', 'TSLA', 'XLE', 'JNJ')
ORDER BY ticker;

# 3. Check regime distribution
SELECT current_macro_regime, COUNT(*) as count
FROM asset_macro_metrics
GROUP BY current_macro_regime;
-- Should show distribution across Goldilocks, Overheating, Stagflation, Deflation
```

---

## Expected Results

### Sample Data (TSLA - Technology)

| Metric | Value | Interpretation |
|--------|-------|---|
| Conviction Score | 67.5 | Current score = DCA (75) × Modifier (0.90) |
| Macro Return 5Y | 156% | Return using sector modifiers |
| DCA Return 5Y | 165% | Enhanced DCA return (reference) |
| Alpha vs Standard | -9% | Macro underperformed by 9% in this period |
| Current Regime | Overheating | High Growth, High Inflation |
| Sector Modifier | 0.90 | Tech penalized 10% in Overheating |
| Regime Distribution | Deflation: 45%, Goldilocks: 30%, Overheating: 20%, Stagflation: 5% | Historical regime mix |

---

## Dashboard vs Asset Folder Comparison

After implementation, you can compare side-by-side:

```sql
-- Compare both models for same assets
SELECT 
  a.ticker,
  a.sector,
  bs.enhReturn5y as "Dashboard DCA 5Y %",
  abm.macro_return_5y as "Asset Macro 5Y %",
  (abm.macro_return_5y - bs.enhReturn5y) as "Difference %",
  CASE WHEN abm.macro_return_5y > bs.enhReturn5y THEN 'Macro Wins'
       ELSE 'DCA Wins' END as Winner
FROM asset_macro_metrics amm
LEFT JOIN asset_backtest_macro abm ON amm.ticker = abm.ticker
LEFT JOIN backtest_summary bs ON amm.ticker = bs.ticker
LEFT JOIN assets a ON amm.asset_id = a.id
WHERE a.is_active = true
ORDER BY "Difference %" DESC
LIMIT 20;
```

This shows which model performed better for each asset over 5 years.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "No metrics found" error | Populate script not run | Run step 4: `populate-asset-macro-metrics.ts` |
| Asset page shows old data | API endpoint not updated | Update files in step 6 to use new endpoint |
| Macro returns seem wrong | Backtest calc script not run | Run step 3: `calculate-asset-backtest-macro.ts` |
| Different conviction scores | Computation script not run | Verify `compute-conviction-scores.ts` was run earlier |

---

## Next Steps

1. ✅ Run migrations (Step 1-2)
2. ✅ Calculate backtest (Step 3)
3. ✅ Populate metrics (Step 4)
4. ✅ Create API route (Step 5 - already done)
5. ✅ Update asset pages (Step 6)
6. 🧪 Test in browser: Navigate to `/asset/TSLA` and verify it shows macro metrics
7. 📊 A/B Test: Compare `/dashboard/TSLA` (Enhanced DCA) vs `/asset/TSLA` (Macro-Sector)

---

## Summary

**What's Running in Parallel:**

| Component | Dashboard | Asset Folder |
|-----------|-----------|--------------|
| Scoring Model | Enhanced DCA | Macro-Sector Sensitivity |
| Backtest Table | `backtest_summary` | `asset_backtest_macro` |
| Metrics Table | N/A | `asset_macro_metrics` |
| API Endpoint | `/api/dashboard/[ticker]` | `/api/asset/[ticker]/metrics` |
| Pages | `/dashboard/*` | `/asset/*` |
| Status | Untouched ✓ | New Implementation ✓ |

Both models evaluate the same assets but with different methodologies. This allows true A/B testing.
