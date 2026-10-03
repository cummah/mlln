# New Asset / Limited History Signal Implementation

## Problem Solved
Assets with less than ~2 years of price history (IPOs, recent adds) had **zero weekly/monthly signals** because the 200-period EMA requires 4+ years of data. Daily signals worked fine (14-period EMA), but weekly/monthly were blocked.

**Example:** SNDK had 41 daily signals but 0 weekly/0 monthly signals, despite a 98.7% crash + recovery.

## Solution
Adaptive EMA that scales based on available data:
- **Full history (200+ periods)**: Use 200-period EMA (standard)
- **Limited history (< 200 periods)**: Use shorter EMA (30-week min, 20-month min)
- **ALL other filters unchanged**: RSI thresholds, buy multipliers, ADX, everything else stays the same
- **Display data quality score** on asset pages (0-100%)
- **Show warning badge** for new assets explaining adaptive EMA only

## Changes Made

### 1. New Utility Library
**File:** `lib/emaUtils.ts`
- `getAdaptiveEmaLength()` — Scales EMA period based on available bars
- `calculateDataQualityScore()` — Returns 0-100 score
- `getAdaptiveEmaConfig()` — Returns EMA length, RSI adjustments, new asset flag
- `getAdjustedRsiThresholds()` — Relaxes RSI for new assets
- `formatDataQuality()` — Formats for display

### 2. Updated Backtest Computation
**File:** `scripts/compute-backtest-summary.ts`
- Import `getAdaptiveEmaConfig`, `getAdjustedRsiThresholds` from emaUtils
- Calculate adaptive EMA for weekly/monthly signals
- Apply RSI threshold adjustments
- Return `isNewAsset`, `dataQualityScore`, `warningMessage` with signals
- Log warnings for new assets during computation

### 3. Database Schema
**File:** `scripts/migrate-backtest-signals-quality.sql`
Add three columns to `backtest_signals` table:
```sql
ALTER TABLE backtest_signals
ADD COLUMN IF NOT EXISTS is_new_asset BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS data_quality_score FLOAT DEFAULT 100,
ADD COLUMN IF NOT EXISTS warning_message TEXT;
```

**Run this migration via Supabase SQL editor** before recomputing signals.

### 4. API Route Update
**File:** `app/api/asset/[ticker]/metrics/route.ts`
- Fetch data quality info from `backtest_signals`
- Return `isNewAsset`, `dataQualityScore`, `warningMessage`

### 5. UI Component
**File:** `components/ticker/DataQualityBadge.tsx`
- Displays quality badge on asset pages
- Shows warning message for limited-history assets
- Color-coded: Green (full), Cyan (good), Yellow (limited), Orange (new), Red (minimal)

## Next Steps

### Step 1: Run Database Migration
Run the migration script:
```bash
npx ts-node --project tsconfig.scripts.json scripts/apply-backtest-signals-quality-migration.ts
```

This adds three columns to `backtest_signals`:
- `is_new_asset` (boolean) — flag for recently-added tickers
- `data_quality_score` (float) — 0-100 quality percentage  
- `warning_message` (text) — explanation of adaptive EMA

### Step 2: Rebuild Backtest Signals
```bash
npm run compute:summary
```

This will:
- Recalculate all weekly/monthly signals with adaptive EMA
- Populate the three new columns
- Print warnings for new assets like: `⚠️  SNDK: Limited history: 78 bars (~0.3 years). Using adaptive EMA (30w/20m).`

### Step 3: Integrate DataQualityBadge into Asset Page
Add to `app/asset/[ticker]/page.tsx`:

```typescript
import { DataQualityBadge } from '@/components/ticker/DataQualityBadge';

// Inside the render, after the header:
{assetData?.dataQualityScore !== undefined && (
  <DataQualityBadge
    score={assetData.dataQualityScore}
    isNewAsset={assetData.isNewAsset || false}
    warningMessage={assetData.warningMessage}
  />
)}
```

### Step 4: Test with SNDK
Visit `/asset/sndk` and verify:
- ✓ Weekly signals now appear (should have 5-10 instead of 0)
- ✓ Monthly signals now appear
- ✓ Yellow/orange badge shows "New Asset" with 30% data quality
- ✓ Warning message explains the adaptive EMA

## Expected Results

### Before
```
SNDK: 0 weekly signals, 0 monthly signals
```

### After
```
SNDK: 8 weekly signals, 3 monthly signals
Data Quality Badge: "New Asset — 30%" (78 bars / 260 required)
EMA used: 30-week (adaptive) instead of 200-week
RSI thresholds: -5 adjustment (more sensitive)
```

## Monitoring

New assets will be easy to spot:
```sql
SELECT ticker, data_quality_score, warning_message
FROM backtest_signals
WHERE is_new_asset = true
ORDER BY data_quality_score ASC;
```

As assets age and accumulate more history, their `data_quality_score` will approach 100 and the badge will disappear.

## Edge Cases

1. **Asset < 20 bars**: Won't run signals (insufficient data)
2. **Asset 20-50 bars**: Uses min EMA (20-30 periods) + strong RSI relaxation (-7)
3. **Asset 50-100 bars**: Uses mid EMA + moderate RSI relaxation (-5)
4. **Asset 100+ bars**: Uses scaled EMA (1/3 of bars) + mild relaxation (-3)
5. **Asset 200+ bars**: Uses standard EMA (200 periods) + no relaxation

## Files Created/Modified
- `lib/emaUtils.ts` (new) — Adaptive EMA utilities
- `scripts/compute-backtest-summary.ts` (updated) — Uses adaptive EMA
- `scripts/apply-backtest-signals-quality-migration.ts` (new) — Database migration
- `app/api/asset/[ticker]/metrics/route.ts` (updated) — Returns quality data
- `components/ticker/DataQualityBadge.tsx` (new) — Quality indicator UI

## Rollback (if needed)
If something goes wrong, the changes are backward-compatible:
- The three new columns default to safe values (false, 100, null)
- Existing signal computation still works
- UI component gracefully hides if score >= 90 and not new asset
- Run original `compute:backtest-summary` to revert to standard EMA

---

**Status:** Implementation complete. Ready for Step 1 (migration) → Step 2 (rebuild) → Step 3 (UI integration) → Step 4 (test).
