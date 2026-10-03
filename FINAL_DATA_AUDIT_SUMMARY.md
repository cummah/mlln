# Final Data Audit Summary
**Date:** April 28, 2026  
**Status:** 🟡 **PARTIALLY LOADED** - 171 of 719 active tickers have data (24% coverage)

---

## Executive Summary

Your Supabase database has **970 assets** (719 active, 251 inactive). Price data is **partially loaded**:
- ✅ **171 active tickers have data** (24% - includes MSFT, META, JNJ, JPM, and others)
- ❌ **548 active tickers are MISSING data** (76% - needs backfill)
- ⏸️ **251 inactive tickers correctly excluded** (delisted/removed from S&P 500)

**Impact:** Assets page only works for ~171 companies; 548 S&P 500 stocks show "no data"

---

## Current State

| Metric | Count | Status |
|--------|-------|--------|
| **Total Assets** | 970 | ✓ Complete |
| **Active Assets** | 719 | ✓ Correct |
| **With Price Data** | 171 | 🟡 Partial (24%) |
| **Missing Price Data** | 548 | ❌ Need backfill (76%) |
| **Inactive/Delisted** | 251 | ✓ Expected |
| **Daily_Prices Rows** | 937,813 | - |

---

## Which Tickers Have Data (171 Total)

### Sample of Tickers WITH Data
**Major Companies:**
- MSFT (Microsoft)
- META (Meta)
- JNJ (Johnson & Johnson)
- JPM (JPMorgan Chase)
- COF (Capital One)
- EMR (Emerson Electric)
- HCA (HCA Healthcare)
- DHI (D.R. Horton)
- FAST (Fastenal)
- GRMN (Garmin)
- GPN (Global Payments)
- KKR (KKR & Co.)
- LVS (Las Vegas Sands)

**Full list:** See `TICKERS_WITH_DATA.txt` (171 companies)

---

## Which Tickers Need Data (548 Total)

### Critical Missing - S&P 500 "Mega-Cap" Stocks
**Tech/Software:**
- AAPL (Apple) ❌
- GOOGL/GOOG (Google) ❌
- NVDA (NVIDIA) ❌
- TSLA (Tesla) ❌
- AMZN (Amazon) ❌

**Finance/Banking:**
- BRK-B (Berkshire Hathaway) ❌
- XYZ (Block, Inc.) ❌
- BX (Blackstone) ❌
- SCHW (Charles Schwab) ❌
- CME (CME Group) ❌

**Healthcare:**
- UNH (UnitedHealth) ❌
- PFE (Pfizer) ❌
- ABBV (AbbVie) ❌
- BIIB (Biogen) ❌

**Retail/Discretionary:**
- AMZN (Amazon) ❌
- TSLA (Tesla) ❌
- DRI (Darden Restaurants) ❌
- EBAY (eBay) ❌

### Missing by Sector (Top 5)
| Sector | Missing | Total | Coverage |
|--------|---------|-------|----------|
| **Financials** | 116 | 132 | 12% |
| **Information Technology** | 84 | 96 | 13% |
| **Industrials** | 70 | 90 | 22% |
| **Consumer Discretionary** | 52 | 62 | 16% |
| **Health Care** | 35 | 60 | 42% |

**Full list:** See `TICKERS_MISSING_DATA.txt` (548 companies)

---

## Why This Matters

### For Users
- ❌ Can't view AAPL, TSLA, NVDA, AMZN, GOOGL, BRK.B, UNH, PFE data
- ❌ 548 stocks show "not found" on assets page
- ✅ 171 stocks load fine
- ❌ Sector performance incomplete
- ❌ Comparative analysis missing most companies

### For the App
- ❌ Dashboard fails for 548 tickers
- ✅ Works for 171 tickers
- ⚠️ Summary cache incomplete (only ~171 companies)
- ⚠️ Signal calculations can't run without price data

### Coverage by S&P 500 Percentage
- **Have Data:** ~24% of S&P 500 companies
- **Missing Data:** ~76% of S&P 500 companies
- **Needed for Full Functionality:** All 500 companies + indexes

---

## Root Cause

The backfill process **partially completed** around 171 tickers, then stopped. Likely causes:
1. **Script interrupted** during bulk fetch
2. **Yahoo Finance rate limiting** kicked in
3. **Network timeout** after processing some tickers
4. **Partial batch** in earlier run that completed, then additional tickers stopped

**Evidence:** 171 tickers successfully loaded suggests the process worked initially but didn't complete the full 719.

---

## Recovery Plan

### Run Backfill to Complete Missing 548 Tickers

**Command:**
```bash
npm run backfill:missing
```

**What it does:**
1. Checks all 719 active tickers
2. Finds those with <200 price rows (548 missing)
3. Fetches 5 years of data from Yahoo Finance
4. Inserts into daily_prices table
5. Calculates coverage

**Expected output:**
```
Tickers targeted for backfill: 548
Successfully filled (≥200): 548
Rows upserted: ~685,000
```

**Time:** 30-60 minutes

**Monitor progress:**
```bash
# In another terminal, watch the count increase
watch -n 5 'sqlite3 sqlitedb "SELECT COUNT(DISTINCT ticker) FROM daily_prices;"'
# Should go from 171 → 200 → 300 → ... → 719
```

---

### Then Rebuild Summary Cache

**Command:**
```bash
npm run compute:summary
```

**What it does:**
1. Reads all 719 tickers' price data
2. Runs DCA backtest simulations (1M, 3M, 1Y, 5Y windows)
3. Calculates returns, alpha, entry prices
4. Populates backtest_summary table

**Expected output:**
```
Successfully processed: 719
Rows upserted: 719
```

**Time:** 20-40 minutes

---

## One-Command Solution

Run the admin endpoint to trigger both steps:
```bash
curl -X POST "http://localhost:3000/api/admin/refresh?key=mlln_admin_refresh_7k9m2q5p8n3x"
```

This will:
1. Call `npm run backfill:missing`
2. Wait for completion
3. Call `npm run compute:summary`
4. Return results

**Total time:** ~60-90 minutes

---

## Verification Steps

### After Backfill Completes
```sql
-- Check ticker count increased
SELECT COUNT(DISTINCT ticker) FROM daily_prices;
-- Expected: 719 (increased from 171)

-- Check specific major stocks got loaded
SELECT COUNT(*) FROM daily_prices WHERE ticker = 'AAPL';
-- Expected: ~1250 rows (5 years of trading days)

SELECT COUNT(*) FROM daily_prices WHERE ticker = 'TSLA';
-- Expected: ~1250 rows

SELECT COUNT(*) FROM daily_prices WHERE ticker = 'GOOGL';
-- Expected: ~1250 rows
```

### After Compute Summary Completes
```sql
-- Check summary rows
SELECT COUNT(*) FROM backtest_summary;
-- Expected: ~719 rows

-- Check specific stock metrics
SELECT ticker, std_return_5y, enh_return_5y, alpha_5y 
FROM backtest_summary 
WHERE ticker IN ('AAPL', 'MSFT', 'GOOGL', 'NVDA');
-- Expected: 4 rows with backtest metrics
```

### Test on Dashboard
1. Visit: `http://localhost:3000`
2. Search for: AAPL
3. Should load with 5-year price chart
4. Repeat for TSLA, GOOGL, NVDA, etc.

---

## Expected Outcome

After running both scripts:

✅ **Daily Prices Table:**
- 937,813 existing rows + 685,000 new = 1,622,813 total rows
- 719 unique tickers (all S&P 500 companies)
- 5 years of history for each (2021-2026)

✅ **Backtest Summary Cache:**
- 719 rows (one per active ticker)
- All major metrics: returns, alpha, entry prices, positions
- Ready for instant API responses

✅ **App Functionality:**
- Assets page loads all 500+ S&P 500 stocks
- Dashboard works for any ticker
- Sector analysis includes all companies
- Comparative performance calculations accurate
- Signals calculated correctly

✅ **User Experience:**
- No more "ticker not found" errors
- All S&P 500 data searchable
- Historical charts fully functional
- Performance comparisons complete

---

## Data Files Generated

| File | Purpose | Records |
|------|---------|---------|
| `TICKERS_WITH_DATA.txt` | Companies with price data | 171 |
| `TICKERS_MISSING_DATA.txt` | Companies needing backfill | 548 |
| `TICKERS_INACTIVE_NO_DATA.txt` | Delisted (not updated) | 251 |
| `MISSING_TICKERS_BY_SECTOR.txt` | Organized by sector | 548 |
| `MISSING_TICKERS_LIST.txt` | Comma-separated for scripts | 548 |

---

## Timeline

| Phase | Action | Duration | Status |
|-------|--------|----------|--------|
| **Now** | Review this report | 5 min | 📖 Reading |
| **Step 1** | Run backfill | 30-60 min | ⏳ Next |
| **Step 2** | Compute summary | 20-40 min | ⏳ After step 1 |
| **Step 3** | Verify data | 5 min | ✓ Quick check |
| **Total** | **All done** | **~90 min** | Ready soon |

---

## Key Insights

### What This Means for Your App

**Current (171 tickers):**
- Can show ~24% of S&P 500 companies
- Dashboard works for some stocks
- Sector analysis incomplete
- Backtests partial

**After Backfill (719 tickers):**
- All S&P 500 companies fully supported
- Dashboard works for any stock
- Complete sector analysis
- Full comparative backtests

### Why 171 Tickers Got Loaded

Possible timeline:
1. Initial backfill run started
2. Successfully fetched ~171 tickers from Yahoo Finance
3. Script stopped (rate limit / timeout / error)
4. Remaining 548 tickers never processed

### Why This Wasn't Critical Until Now

- Maybe assets page wasn't heavily used for missing stocks
- Error handling might have silently skipped failures
- No automated re-runs to complete the backfill

---

## Next Steps

1. **Review this report** ✓ (you are here)
2. **Run backfill:** `npm run backfill:missing`
3. **Wait for completion** (30-60 min)
4. **Run compute:** `npm run compute:summary`
5. **Wait for completion** (20-40 min)
6. **Test dashboard** with AAPL, TSLA, GOOGL, etc.
7. **Confirm:** All data loading correctly

Once complete, your assets page will have full S&P 500 coverage!

---

## Questions?

- **Which tickers are missing?** See `TICKERS_MISSING_DATA.txt`
- **Which tickers have data?** See `TICKERS_WITH_DATA.txt`
- **By sector?** See `MISSING_TICKERS_BY_SECTOR.txt`
- **How long will it take?** ~90 minutes total
- **Can I cancel?** Yes, but it'll need to restart
- **What if it fails again?** Just re-run—it picks up where it left off

---

**Report Generated:** April 28, 2026  
**Database:** gdzbgeoxvhwooudjkxao.supabase.co  
**Coverage:** 24% → 100% with backfill  
**ETA to Fix:** ~90 minutes  
**Priority:** High (core functionality blocked for 76% of S&P 500)
