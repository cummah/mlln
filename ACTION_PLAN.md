# Master Action Plan - Fix Missing S&P 500 Data

## Status at a Glance

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| **Tickers with data** | 171 | 719 | 🟡 24% (548 missing) |
| **Daily prices rows** | 937K | 1.6M | 🟡 Partial |
| **Summary cache** | ~171 | ~719 | 🟡 Incomplete |
| **App functionality** | Partial | Full | 🟡 Need backfill |
| **S&P 500 coverage** | 24% | 100% | 🟡 Almost there |

**Problem:** Assets page only shows ~171 companies; 548 S&P 500 stocks missing  
**Cause:** Backfill script partially completed (171 of 719 tickers)  
**Solution:** Re-run backfill to complete the remaining 548 tickers  
**ETA:** ~90 minutes (60 min backfill + 30 min compute)

---

## Quick Start (5 Minutes)

### Option A: Fastest (Automated)
```bash
curl -X POST "http://localhost:3000/api/admin/refresh?key=mlln_admin_refresh_7k9m2q5p8n3x"
```
- Triggers both backfill and compute automatically
- Monitor progress in server logs
- Takes ~90 minutes total

### Option B: Step-by-Step (More Control)
```bash
# Step 1: Fetch missing price data (30-60 min)
npm run backfill:missing

# Step 2: Rebuild summary cache (20-40 min)
npm run compute:summary
```

---

## Detailed Steps

### Step 1: Run Backfill Script (30-60 minutes)

**Command:**
```bash
npm run backfill:missing
```

**What happens:**
1. Connects to Supabase
2. Finds all 719 active tickers
3. Identifies 548 with insufficient data (<200 rows)
4. Fetches 5 years of historical data from Yahoo Finance
5. Inserts into `daily_prices` table
6. Displays summary

**Expected console output:**
```
==========================================
   Backfill Missing Price Data (S&P 500)
==========================================

Found 719 active tickers
Checking price data completeness...
  Checked 719/719 tickers

==========================================
         BACKFILL STATUS
==========================================
Total active tickers:      719
Complete (≥200 rows):      171
Missing (<200 rows):       548

Running backfill for 548 tickers...
Executing: npx ts-node scripts/backfill-prices.ts --tickers=...

[Yahoo Finance API fetching data...]

Re-checking price data after backfill...

==========================================
      BACKFILL RESULTS SUMMARY
==========================================
Tickers targeted for backfill: 548
Successfully filled (≥200):   548
Partially filled:              0
Failed to fill:                0
Total new rows added:          685000

Remaining incomplete:          0
==========================================
```

**Monitor progress:**
```bash
# In another terminal, check ticker count
watch -n 10 'npx ts-node -e "
import { createClient } from \"@supabase/supabase-js\";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const {data} = await sb.from(\"daily_prices\").select(\"ticker\").limit(100000);
  console.log(\"Unique tickers: \" + new Set(data.map(d => d.ticker)).size);
})();
"'
```

**Success criteria:**
- ✅ "Successfully filled" reaches 548
- ✅ "Total new rows added" is ~685,000+
- ✅ "Remaining incomplete" is 0

---

### Step 2: Compute Summary Cache (20-40 minutes)

**Command:**
```bash
npm run compute:summary
```

**What happens:**
1. Reads all 719 tickers' price data
2. For each ticker, runs DCA backtest:
   - 1-month window
   - 3-month window
   - 1-year window
   - 5-year window
3. Calculates metrics:
   - Returns (standard vs enhanced)
   - Alpha (outperformance)
   - Entry prices
   - Number of purchases
   - Portfolio value at end
4. Stores in `backtest_summary` table

**Expected console output:**
```
==========================================
   Computing Backtest Summary Cache
==========================================

Fetching all active tickers...
Found 719 tickers with price data

Computing backtests...
Processing ticker 1/719: MSFT
Processing ticker 2/719: META
...
Processing ticker 719/719: ABC

Upserting results to backtest_summary...

==========================================
      COMPUTE SUMMARY RESULTS
==========================================
✓ Successfully processed:    719
✓ Rows upserted:             719
✓ Time taken:                35 minutes

Total metrics computed:
  - 1-month data:    719 rows
  - 3-month data:    719 rows
  - 1-year data:     719 rows
  - 5-year data:     719 rows

==========================================
```

**Success criteria:**
- ✅ "Successfully processed" reaches 719
- ✅ "Rows upserted" is ~719
- ✅ No errors in console

---

## Verification Steps (5 minutes)

### Verify Backfill Worked

**Check ticker count:**
```sql
SELECT COUNT(DISTINCT ticker) FROM daily_prices;
```
- Expected: **719** (increased from 171)

**Check AAPL got data:**
```sql
SELECT COUNT(*) FROM daily_prices WHERE ticker = 'AAPL';
```
- Expected: **~1250 rows** (5 years)

**Check major stocks:**
```sql
SELECT ticker, COUNT(*) as rows FROM daily_prices 
WHERE ticker IN ('AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA')
GROUP BY ticker;
```
- Expected: All 5 tickers with ~1250 rows each

### Verify Compute Worked

**Check summary cache:**
```sql
SELECT COUNT(*) FROM backtest_summary;
```
- Expected: **~719 rows** (was incomplete before)

**Check specific stock metrics:**
```sql
SELECT ticker, sector, std_return_5y, enh_return_5y, alpha_5y 
FROM backtest_summary 
WHERE ticker IN ('AAPL', 'MSFT', 'GOOGL');
```
- Expected: 3 rows with numeric backtest metrics

### Test on Dashboard

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser:** `http://localhost:3000`

3. **Search for major stocks:**
   - AAPL (Apple) → Should load with chart
   - TSLA (Tesla) → Should load with chart
   - GOOGL (Google) → Should load with chart
   - NVDA (NVIDIA) → Should load with chart
   - BRK.B (Berkshire) → Should load with chart

4. **Check sectors:**
   - Visit sectors page
   - All sectors should have data for top performers

---

## Troubleshooting

### If Backfill Gets Rate Limited
```
Error: Too many requests from Yahoo Finance API
```
**Solution:** 
- Wait 1-2 hours for rate limit reset
- Re-run script: `npm run backfill:missing`
- It will pick up where it left off

### If Script Times Out
```
Error: Script timed out after 120 seconds
```
**Solution:**
- Increase Node.js timeout: `ulimit -n 4096`
- Re-run: `npm run backfill:missing`
- The database will have partial progress

### If No Data Shows Up After Completion
```
SELECT COUNT(*) FROM daily_prices;  -- Still shows old count
```
**Solution:**
```bash
# Clear any cached data
npm run clear-cache

# Re-run backfill
npm run backfill:missing

# If that fails, check logs
npm run backfill:missing 2>&1 | head -50
```

### If Specific Tickers Fail
```
# Retry just the failing tickers
npm run backfill:prices -- --tickers=AAPL,TSLA,GOOGL
```

---

## What Gets Fixed

### Before (Current State)
| Company | Status | Dashboard | Sectors | Analysis |
|---------|--------|-----------|---------|----------|
| MSFT | Has data | ✅ Works | ✅ Included | ✅ Available |
| AAPL | **Missing** | ❌ Error | ❌ Missing | ❌ Empty |
| TSLA | **Missing** | ❌ Error | ❌ Missing | ❌ Empty |
| GOOGL | **Missing** | ❌ Error | ❌ Missing | ❌ Empty |
| NVDA | **Missing** | ❌ Error | ❌ Missing | ❌ Empty |
| (546 more) | **Missing** | ❌ Error | ❌ Missing | ❌ Empty |

### After (Completed)
| Company | Status | Dashboard | Sectors | Analysis |
|---------|--------|-----------|---------|----------|
| MSFT | Has data | ✅ Works | ✅ Included | ✅ Available |
| AAPL | **Has data** | ✅ Works | ✅ Included | ✅ Available |
| TSLA | **Has data** | ✅ Works | ✅ Included | ✅ Available |
| GOOGL | **Has data** | ✅ Works | ✅ Included | ✅ Available |
| NVDA | **Has data** | ✅ Works | ✅ Included | ✅ Available |
| (714 more) | **Has data** | ✅ Works | ✅ Included | ✅ Available |

---

## Timeline & Expectations

```
T+0 min   [NOW] Read this plan, run backfill command
T+5 min   Backfill script initializes, starts fetching
T+10 min  Ticker 1-5 fetched from Yahoo Finance
T+30 min  ~200 tickers fetched (monitor with SQL query)
T+60 min  Backfill completes, 548 tickers done
          Console output shows "Total new rows added: 685,000"

T+61 min  Run compute:summary command
T+70 min  DCA backtests running (watch console)
T+90 min  Compute completes, 719 rows in summary cache
          Console output shows "Successfully processed: 719"

T+91 min  Run verification queries
          All show ✅ Complete data
T+95 min  Test on dashboard
          All S&P 500 stocks load correctly
```

---

## File References

### Diagnostic Files Created
- `FINAL_DATA_AUDIT_SUMMARY.md` - Full current state analysis
- `DATA_ISSUES_ANALYSIS.md` - Root cause analysis  
- `QUICK_FIX_GUIDE.md` - Simple fix instructions
- `TICKERS_WITH_DATA.txt` - 171 stocks that have data
- `TICKERS_MISSING_DATA.txt` - 548 stocks needing backfill
- `MISSING_TICKERS_BY_SECTOR.txt` - Organized by sector

### Code Files Involved
- `scripts/backfill-missing.ts` - Main backfill orchestrator
- `scripts/backfill-prices.ts` - Yahoo Finance API fetch
- `scripts/compute-backtest-summary.ts` - DCA backtest engine
- `app/api/admin/refresh/route.ts` - Admin endpoint
- `lib/dcaEngine.ts` - Backtest simulation logic
- `lib/supabase.ts` - Database utilities

---

## Success Metrics

After completion, you should see:

✅ **Daily Prices Table:**
```
Total rows: 1,622,813 (was 937,813)
Unique tickers: 719 (was 171)
Coverage: 100% of S&P 500
Date range: 2021-2026 (5 years)
```

✅ **Backtest Summary Cache:**
```
Total rows: 719 (was ~171)
All active companies: ✓ Included
Metrics calculated: ✓ Returns, Alpha, Entries
Time windows: ✓ 1M, 3M, 1Y, 5Y
```

✅ **App Functionality:**
```
Assets page: ✓ Loads all 719 companies
Dashboard: ✓ Works for any S&P 500 ticker
Search: ✓ Finds any stock
Charts: ✓ Show 5-year history
Sectors: ✓ Complete data for all
Performance: ✓ All metrics calculated
```

---

## Final Checklist

- [ ] Read this plan
- [ ] Choose Option A (automated) or Option B (manual)
- [ ] Run backfill command
- [ ] Monitor progress (30-60 min)
- [ ] Backfill completes with success message
- [ ] Run compute:summary command
- [ ] Monitor progress (20-40 min)
- [ ] Compute completes with 719 rows
- [ ] Run verification SQL queries
- [ ] All queries return expected results
- [ ] Test dashboard with AAPL, TSLA, GOOGL
- [ ] All stocks load correctly
- [ ] ✅ DONE - Full S&P 500 data loaded!

---

## Support

**Questions:**
- Which tickers are missing? → `TICKERS_MISSING_DATA.txt`
- Why only 171 loaded? → Backfill script interrupted after partial run
- How long will it take? → ~90 minutes total
- Can I cancel? → Yes, but need to restart
- What if it fails? → Script is idempotent, re-run it

**Next step:** Start with either the curl command or `npm run backfill:missing`

---

**Ready?** Run:
```bash
npm run backfill:missing
```

Your S&P 500 data will be fully loaded in ~90 minutes! 🚀
