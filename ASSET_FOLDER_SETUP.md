# Asset Folder Setup: Macro-Aware Metrics (Solution 2)

## Architecture: Two Models Running in Parallel

```
┌─────────────────────────────────────┐
│  DASHBOARD FOLDER                   │
│  ├── Enhanced DCA Model             │
│  ├── Uses: backtest_summary         │
│  ├── Uses: backtest_signals         │
│  └── Status: UNTOUCHED              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ASSET FOLDER (NEW)                 │
│  ├── Solution 2: Macro-Sector       │
│  ├── Uses: asset_macro_metrics      │
│  ├── Conviction = DCA × Modifier    │
│  └── Status: IN PROGRESS            │
└─────────────────────────────────────┘
```

This allows **A/B testing** both models on identical assets.

---

## Files Created

### 1. Database Migration
**File:** `supabase/migrations/20260529_create_asset_macro_metrics.sql`
- Creates `asset_macro_metrics` table
- Stores conviction scores, modifiers, signals, and fundamental data
- **NOT used by dashboard**

### 2. Population Script
**File:** `scripts/populate-asset-macro-metrics.ts`
- Merges data from `asset_scores`, `backtest_summary`, `backtest_signals`
- Populates `asset_macro_metrics` table
- Run after all previous scripts

### 3. New API Route
**File:** `app/api/asset/[ticker]/metrics/route.ts`
- Returns macro metrics for asset folder only
- **Separate from** `/api/dashboard/[ticker]`
- Returns conviction scores, macro regime, signals, and modifiers

---

## Execution Steps

### Step 1: Apply Migration
```bash
supabase migration up
```

Verify:
```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name = 'asset_macro_metrics';
-- Should return 1
```

### Step 2: Run Previous Scripts (if not done)
If you haven't run the compute conviction scores script, run it first:
```bash
npx ts-node --project tsconfig.scripts.json scripts/compute-conviction-scores.ts
```

### Step 3: Populate Asset Macro Metrics
```bash
npx ts-node --project tsconfig.scripts.json scripts/populate-asset-macro-metrics.ts
```

Expected output:
```
Found X active assets to process
✓ Successfully upserted all rows
✓ Population complete: X processed, 0 failed
```

### Step 4: Verify Data
```sql
SELECT ticker, sector, conviction_score_current, sector_modifier, 
       current_macro_regime, weekly_signal_strength
FROM asset_macro_metrics
LIMIT 10;
```

---

## Update Asset Folder Pages

### Update: `app/asset/[ticker]/page.tsx`

Replace this:
```typescript
const url = `${protocol}://${host}/api/dashboard/${ticker}`;
```

With:
```typescript
const url = `${protocol}://${host}/api/asset/${ticker}/metrics`;
```

**Why:** Pulls from new `asset_macro_metrics` table instead of dashboard's backtest_summary.

---

## Update: `app/asset/daily/page.tsx`

This page displays daily signals. Update to use new API:

```typescript
// OLD (pulls from backtest_signals directly)
// NEW: Pull from asset_macro_metrics for consistency
const url = `${protocol}://${host}/api/asset/${ticker}/metrics`;
```

---

## Update: `app/asset/weekly/page.tsx`

Update to use new API for weekly signals:

```typescript
const url = `${protocol}://${host}/api/asset/${ticker}/metrics`;
```

Similarly pulls `weeklySignal.strength` and `weeklySignal.amount` from the response.

---

## Update: `app/asset/monthly/page.tsx`

Update to use new API for monthly signals:

```typescript
const url = `${protocol}://${host}/api/asset/${ticker}/metrics`;
```

Similarly pulls `monthlySignal.strength` and `monthlySignal.amount`.

---

## Data Flow

### Old (Dashboard)
```
backtest_summary → /api/dashboard/[ticker] → dashboard page
backtest_signals → /api/dashboard/[ticker] → dashboard page
```

### New (Asset)
```
asset_scores ────┐
backtest_summary ├→ populate-asset-macro-metrics.ts ──→ asset_macro_metrics
backtest_signals─┘
                                      ↓
                    /api/asset/[ticker]/metrics
                                      ↓
                        app/asset/[ticker]/page.tsx
```

---

## Component Updates Needed

### `BacktestTiles` Component
If this component is used in asset pages, it may need to map new fields:

Old:
```typescript
const { enhReturn5y, alpha5y } = data;
```

New (from asset metrics API):
```typescript
const { returns: { return5y } } = data;
const convictionScore = data.convictionScore;  // New metric
```

### `SignalDataSection` Component
Update to use new signal structure:

Old:
```typescript
const { weeklySignalAmount, weeklySignalStrength } = data;
```

New:
```typescript
const { weeklySignal: { amount, strength } } = data;
```

---

## Verification Checklist

- [ ] Migration applied: `asset_macro_metrics` table exists
- [ ] Population script runs: all assets have conviction scores
- [ ] API route works: curl test
  ```bash
  curl http://localhost:3000/api/asset/TSLA/metrics
  ```
- [ ] Asset page loads: no errors in console
- [ ] Conviction score displays correctly
- [ ] Macro regime label shows (Goldilocks, Overheating, etc.)
- [ ] Sector modifier visible
- [ ] Signals display (weekly, monthly, daily)
- [ ] Dashboard folder still works unchanged

---

## Troubleshooting

### "No metrics found for TICKER"
**Cause:** `populate-asset-macro-metrics.ts` hasn't been run or failed
**Fix:** 
```bash
npx ts-node --project tsconfig.scripts.json scripts/populate-asset-macro-metrics.ts
```

### "column X does not exist"
**Cause:** Migration not applied
**Fix:**
```bash
supabase migration up
supabase db pull  # Sync schema locally
```

### Asset page shows old data
**Cause:** API endpoint still points to old `/api/dashboard/`
**Fix:** Update page to use new `/api/asset/[ticker]/metrics` endpoint

---

## Summary

| Component | Old Location | New Location | Status |
|-----------|---|---|---|
| Metrics Table | `backtest_summary` | `asset_macro_metrics` | New |
| API Endpoint | `/api/dashboard/[ticker]` | `/api/asset/[ticker]/metrics` | New |
| Scoring Model | Enhanced DCA | Macro-Sector (Solution 2) | New |
| Asset Pages | Using dashboard data | Using new metrics | Update needed |
| Dashboard Pages | Unchanged | Unchanged | ✓ Safe |

All changes are **isolated** to the asset folder. Dashboard remains completely untouched.
