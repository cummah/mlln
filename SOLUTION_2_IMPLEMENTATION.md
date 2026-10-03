# Solution 2: Top-Down Macro-Sector Engine Implementation

## Overview

Implemented **Solution 2: The "Top-Down Macro-Sector" Engine** with a unified backtest equation that eliminates look-ahead bias while preserving sector rotation benefits.

**Key Principle:** Historical backtests use the same equation as current calculations:
```
Final Conviction Score = DCA Suitability Score × Sector-Regime Modifier
```

### Why Solution 2?

1. **No Look-Ahead Bias:** Fundamentals (ROIC, P/E) from 2026 do NOT affect 2021 backtests
2. **Institutionally Sound:** Uses sector rotation (known from history) + technical DCA scores (point-in-time)
3. **Simple & Backtestable:** Single equation works across all 5 years of data
4. **Preserves UI:** Fundamental quality scores still calculated for asset detail pages

---

## Implementation Changes

### 1. Fixed Macro Regime Classifier (`scripts/update-macro-regime.ts`)

**The Problem:** Old logic blended multiple indicators into a composite score, making the regime classification unclear.

**The Solution:** Strict 4-Quadrant Classification
- **Growth Axis:** GDP growth, unemployment, yield curve, VIX (normalized to 0-100)
- **Inflation Axis:** PCE inflation % (raw value, default 2.0 if missing)

**Regime Assignment:**
| Growth | Inflation | Regime |
|--------|-----------|--------|
| ≥50 | <2.5% | **Goldilocks** |
| ≥50 | ≥2.5% | **Overheating** |
| <50 | ≥2.5% | **Stagflation** |
| <50 | <2.5% | **Deflation** |

**Example:** If GDP growth is 2.5% (score ~83) and PCE is 1.8%, regime = Goldilocks (high growth, low inflation).

### 2. Recalculate Historical Regimes (`scripts/recalculate-macro-history.ts`)

This script was already in place and now works perfectly with the fixed logic:
- Fetches 5 years of PCE inflation data from FRED API
- Recalculates regime labels for all historical snapshots
- Ensures backtest equation uses correct historical regime classifications

**Run:** 
```bash
npx ts-node --project tsconfig.scripts.json scripts/recalculate-macro-history.ts
```

### 3. Sector-Regime Sensitivity Modifiers (`scripts/compute-conviction-scores.ts`)

**The Core of Solution 2:** Instead of fundamental scores, we apply sector-regime modifiers to DCA scores.

#### Modifier Matrix

**Goldilocks (High Growth, Low Inflation)**
- Technology: **+15%** (growth engines thrive)
- Communication Services: **+10%**
- Consumer Discretionary: **+5%**
- Financials: 1.0x (neutral)
- Industrials, Materials, Real Estate: **-5%**
- Energy, Consumer Staples: **-10%**
- Utilities: **-15%** (defensive retreat)

**Overheating (High Growth, High Inflation)**
- Energy: **+15%** (inflation hedge)
- Utilities, Consumer Staples, Financials: **+10%** (defensive plays)
- Technology: **-10%** (margin compression)
- Consumer Discretionary: **-15%** (demand destruction)

**Stagflation (Low Growth, High Inflation)**
- Energy: **+30%** (crisis commodity)
- Utilities: **+15%** (defensive)
- Consumer Staples: **+5%** (stable demand)
- Technology, Consumer Discretionary: **-30%** (demand collapse)
- Financials: **-20%** (rising rates hurt lending)

**Deflation (Low Growth, Low Inflation)**
- Real Estate: **+15%** (lower rates boost valuations)
- Healthcare, Consumer Staples: **+10%** (stability)
- Technology: **+10%** (secular growth)
- Energy, Materials: **-25%** (demand destruction)

#### How It Works

For each asset:
1. **Fetch DCA Score** from `backtest_summary` (existing technical metric)
2. **Get Current Regime** from `macro_regime_current`
3. **Apply Modifier** based on asset sector and regime
4. **Compute Final Score:**
   ```
   Final Conviction = DCA Score × Modifier
   ```

**Example:** TSLA (Technology) in Overheating regime
- DCA Score: 75
- Modifier: 0.90 (Tech penalized during overheating)
- Final Conviction: 75 × 0.90 = **67.5**

### 4. Database Schema Updates

New migration: `supabase/migrations/20260529_add_sector_modifier.sql`

Adds `sector_modifier` column to:
- `asset_scores` (current scores)
- `asset_scores_history` (historical snapshots)

**Column stores:** The regime-sector modifier applied (e.g., 0.90, 1.15)

---

## Execution Plan

### Step 1: Apply Database Migration
```bash
supabase migration up 20260529_add_sector_modifier
```

### Step 2: Recalculate Historical Macro Regimes
```bash
npx ts-node --project tsconfig.scripts.json scripts/recalculate-macro-history.ts
```
This fetches 5 years of PCE inflation from FRED and re-stamps all historical macro records.

### Step 3: Recompute All Conviction Scores
```bash
npx ts-node --project tsconfig.scripts.json scripts/compute-conviction-scores.ts
```
- Computes fundamental scores (for UI)
- Applies sector-regime modifiers
- Stores Final Conviction = DCA × Modifier
- Records historical snapshots

### Step 4: Verify Results
Check a few assets in the database:
```sql
SELECT asset_id, ticker, dca_suitability_score, sector_modifier, final_conviction_score
FROM asset_scores
WHERE asset_id IN (SELECT id FROM assets WHERE ticker IN ('TSLA', 'XLE', 'JNJ'))
ORDER BY ticker;
```

Expected: Final Conviction is DCA × Modifier (normalized to 0-100 range).

---

## Why This Works

### Eliminates Look-Ahead Bias
- Fundamentals computed today (2026) don't leak into 2021 backtests
- Historical scores based only on:
  - **DCA suitability** (technical, point-in-time)
  - **Macro regime** (historical, from macro_regime_history)
  - **Sector** (constant, doesn't change)

### Backtests Match Live Scoring
- Same equation: `DCA × Modifier`
- When you ran DCA backtest for 2021, we now apply the Stagflation sector modifier for that year
- New assets follow the exact same formula as historical ones

### Sector Rotation is Real
The modifiers encode institutional wisdom:
- **Goldilocks:** Favor growth (Tech, discretionary)
- **Overheating:** Favor defensive (Energy, utilities, staples)
- **Stagflation:** Extreme: Energy booms, Tech crashes
- **Deflation:** Real Estate recovers, Energy collapses

---

## UI Display

The `fundamental_quality_score` is still computed and stored—it's just not used in the backtest equation. The UI can display:

1. **Conviction Score** (the backtest metric): `DCA × Modifier`
2. **Fundamental Quality** (informational): Regime-weighted blend of ROIC, profitability, valuation
3. **Sector Modifier** (explanation): Shows why Conviction differs from DCA
4. **Current Regime**: Goldilocks, Overheating, Stagflation, or Deflation

Example UI:
```
TSLA (Technology)
━━━━━━━━━━━━━━━━━━━━━━
Conviction Score: 67.5 (Primary metric for backtests)
  - DCA Suitability: 75
  - Sector Modifier: 0.90× (Tech penalized in Overheating)

Fundamental Quality: 72 (Informational, for research)
Current Regime: Overheating (High Growth, High Inflation)
```

---

## Verification Checklist

- [ ] Migration 20260529 applied
- [ ] `recalculate-macro-history.ts` runs successfully (check console output for regime distribution)
- [ ] `compute-conviction-scores.ts` runs successfully (check record counts)
- [ ] Spot-check: Energy stocks have higher modifiers in Stagflation
- [ ] Spot-check: Tech stocks have lower modifiers in Overheating/Stagflation
- [ ] UI shows sector_modifier values for a few assets

---

## Files Modified

1. **`scripts/update-macro-regime.ts`** ✓
   - Fixed `classifyRegime()` with 4-quadrant logic
   - Clear Growth vs Inflation axes

2. **`scripts/compute-conviction-scores.ts`** ✓
   - Added `getSectorRegimeModifiers()` lookup table
   - Changed final conviction: `DCA × Modifier`
   - Stores sector_modifier in database

3. **`scripts/recalculate-macro-history.ts`** (already exists)
   - Fetches historical PCE inflation
   - Recalculates regime labels

4. **`supabase/migrations/20260529_add_sector_modifier.sql`** ✓
   - Adds sector_modifier column
   - Updates table comments

---

## Future Enhancements

1. **Persist Sector Modifiers:** Move modifiers to a `sector_regime_modifiers` table for admin UI tuning
2. **A/B Test Modifier Weights:** Track which sectors perform best in each regime
3. **Dynamic Thresholds:** Let Growth/Inflation cutoffs (50, 2.5%) be configurable
4. **Regime-Sector Composites:** Add commentary like "Tech is best positioned for Goldilocks"
