# Supabase Data Issues Analysis

**Report Date:** April 28, 2026  
**Status:** 🔴 CRITICAL - Missing S&P 500 price data

---

## Executive Summary

The database contains **970 assets** (719 active, 251 inactive) representing S&P 500 companies and indexes, but only **1 ticker has price data** (^VIX). This prevents the assets page and dashboard from loading data, causing the missing ticker and empty data issues.

### Current State vs Expected State

| Component | Current | Expected |
|-----------|---------|----------|
| **Assets** | 970 | 970 ✓ |
| **Active Assets** | 719 | ~500 S&P 500 + indexes |
| **Daily Prices Table** | 937,813 rows but 1 ticker only | 500+ tickers × 1,250 days (5 years) |
| **Backtest Summary** | 709 rows (VIX only) | 700+ rows (all active companies) |
| **Backtest Signals** | Missing table | Should exist |

---

## 1. Missing Price Data Issue

### The Problem
- **Only 1 ticker has historical price data:** ^VIX (VIX Index)
- **Missing:** 969 tickers (all S&P 500 companies and other indexes)
- **Data in daily_prices table:** 937,813 rows - but ALL from a single ticker

### Why This Breaks the App
1. **Assets Page:** When trying to load ticker data, it returns empty (no rows for that ticker)
2. **Dashboard:** Shows "not found" for S&P 500 companies because `daily_prices` has no data
3. **Backtests:** Can't compute returns without price data
4. **Summary Cache:** Only 709 rows instead of 700+ needed

### Root Cause
The `backfill:missing` script runs but fails silently to fetch price data for 969 of 719 active tickers. Possible causes:
- Yahoo Finance API rate limiting or failures
- Network timeouts during bulk fetch
- Script error in `backfill-prices.ts` not properly handled

---

## 2. Empty Assets Needing Data

### Tickers with NO Data (969 total)

**S&P 500 Companies - Sample (all affected):**
- AAPL, MSFT, GOOGL, AMZN, TSLA, NVDA, META, BRK.B, JNJ, V
- (... 510+ more S&P 500 symbols)

**Other Major Indexes (also missing):**
- Should include: SPY, QQQ, DIA, IWM, etc.
- Currently: None have data

**Full list in database:** Run this query to see all 969 tickers without data:
```sql
SELECT ticker, name FROM assets 
WHERE ticker NOT IN (SELECT DISTINCT ticker FROM daily_prices)
ORDER BY ticker;
```

---

## 3. Inactive Assets

**251 inactive assets** were removed from S&P 500 or delisted:
- None have price data (as expected)
- These should NOT be in the update process

**Correct handling:** The `backfill:missing` script filters for `is_active = true`, which is correct.

---

## 4. Summary Cache Status

**Backtest Summary Table:** 709 rows
- Expected: ~710 rows (one per active ticker)
- Current: Only contains ^VIX data
- **Status:** Incomplete - needs rebuild after price data is loaded

**Backtest Signals Table:**
- Status: Missing table (not created in schema)
- Impact: Some calculations may fail if code expects this table

---

## 5. Data Update Process

The system uses a two-step process to populate the assets page:

```
Step 1: Backfill Price Data
├─ Script: npm run backfill:missing
├─ Process: Fetch 5 years of OHLCV data from Yahoo Finance for each ticker
├─ Target: 719 active tickers × ~1,250 trading days = ~900K rows
├─ Current: ✗ Only 1 ticker successfully fetched
└─ Next: Store in daily_prices table

Step 2: Compute Summary Cache
├─ Script: npm run compute:summary
├─ Process: Run DCA backtests for 1M, 3M, 1Y, 5Y windows
├─ Target: 719 rows (one per active ticker)
├─ Current: ✗ Only 709 rows (VIX data)
└─ Output: backtest_summary table (used by API/dashboard)
```

---

## 6. Solution Plan

### Phase 1: Immediate - Fetch Missing Price Data
```bash
npm run backfill:missing
```

**What this does:**
1. Identifies 719 active tickers with <200 price rows
2. Fetches ~5 years of historical data from Yahoo Finance
3. Stores in `daily_prices` table
4. **Time estimate:** 30-60 minutes (depends on API rate limits)

**Monitoring:**
- Check progress by running: `SELECT COUNT(DISTINCT ticker) FROM daily_prices;`
- Should increase from 1 to 719

### Phase 2: Rebuild Cache - Compute Backtest Summary
```bash
npm run compute:summary
```

**What this does:**
1. Reads 5 years of price data for each ticker
2. Simulates DCA (Dollar Cost Averaging) strategies
3. Calculates returns, alpha, and other metrics
4. Populates `backtest_summary` table
5. **Time estimate:** 20-40 minutes (CPU-intensive)

**Monitoring:**
- Check progress: `SELECT COUNT(*) FROM backtest_summary;`
- Should reach ~710 rows

### Phase 3: Verify - Check Data Load
```bash
npm run backfill:prices -- --tickers=AAPL,MSFT,GOOGL
```

Then visit dashboard to confirm Apple, Microsoft, and Google data loads.

---

## 7. Indexes to Include

The 970 assets include:

**S&P 500 Index Components:** ~500 stocks
- AAPL, MSFT, GOOGL, AMZN, NVDA, etc.

**Major Indexes:** 
- ^GSPC (S&P 500)
- ^IXIC (Nasdaq)
- ^DJI (Dow Jones)
- ^VIX (Volatility) ✓ Already has data

**Other Indexes in assets table:**
- SPY, QQQ, DIA, IWM, EEM, etc.

All should have 5+ years of data after backfill completes.

---

## 8. How to Run the Full Update

**Option A: Via Admin Endpoint (Recommended)**
```bash
curl -X POST "http://localhost:3000/api/admin/refresh?key=mlln_admin_refresh_7k9m2q5p8n3x"
```

This triggers both steps (backfill + compute) in sequence.

**Option B: Manual Commands**
```bash
# Step 1: Fetch all missing price data
npm run backfill:missing

# Step 2: Compute backtest summary cache
npm run compute:summary

# Step 3: Check results
npm run sync:sp500  # If needed, re-sync S&P 500 list
```

---

## 9. Expected Outcome

After completing the update:

✓ `daily_prices` will have data for 719 tickers  
✓ `backtest_summary` will have 709-710 rows with backtest metrics  
✓ Assets page will load and display all S&P 500 data  
✓ Dashboard will show historical performance for all companies  
✓ All index data will be current (5 years history)  

---

## 10. Code Files Involved

| File | Purpose |
|------|---------|
| `scripts/backfill-missing.ts` | Checks which tickers need data, calls backfill-prices |
| `scripts/backfill-prices.ts` | Fetches from Yahoo Finance API |
| `scripts/compute-backtest-summary.ts` | Runs DCA backtests, updates summary cache |
| `lib/supabase.ts` | Database connection utilities |
| `lib/dcaEngine.ts` | DCA simulation logic |
| `app/api/admin/refresh/route.ts` | HTTP endpoint to trigger both scripts |

---

## 11. Key Metrics After Fix

Expected database state:

```
Assets Table:
- Total: 970
- Active: 719
- Inactive: 251

Daily Prices Table:
- Total Rows: ~900,000 (719 tickers × ~1,250 trading days)
- Unique Tickers: 719 (+ ^VIX already there = 719)

Backtest Summary Table:
- Rows: 709-710 (all active tickers)
- Time Range: 5 years

Coverage:
- S&P 500 Companies: 500+ ✓
- Indexes: ~20 ✓
- Data Completeness: 100% of active assets ✓
```

---

## Next Steps

1. **Review this analysis** to confirm approach
2. **Run the backfill:** `npm run backfill:missing` (or via admin endpoint)
3. **Monitor progress** (check daily_prices count)
4. **Run summary compute:** `npm run compute:summary`
5. **Verify on dashboard:** Load a few stocks to confirm data

Once complete, the assets page will display all S&P 500 companies with 5 years of historical data.
