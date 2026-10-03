# Complete Cleanup & Rebuild Plan

## Overview
1. **Delete incomplete data** (874K rows of junk)
2. **Clean assets table** (remove duplicates, mark invalid as inactive)
3. **Backfill with rate limiting** (properly fetch S&P 500 data)

**Total Time:** ~60-90 minutes

---

## STEP 1: Delete Incomplete Data (5 minutes)

**Command:**
```bash
node cleanup-1-delete-incomplete.js
```

**What it does:**
- Keeps only the 45 tickers with complete 5+ year data:
  - ^VIX, SPY (3K+ rows each)
  - 43 other stocks/ETFs (1,333 rows = 5.3 years trading days)
- Deletes ~874K rows of partial/incomplete data
- Result: Clean, complete dataset ready for expansion

**Expected output:**
```
Total rows before: 937,813
Rows to KEEP: ~63,000
Rows to DELETE: ~874,813
[Deleting...]
Total rows after: ~63,000
✓ CLEANUP SUCCESSFUL
```

---

## STEP 2: Validate & Clean Assets Table (30-45 minutes)

**Command:**
```bash
node cleanup-2-validate-real-assets.js
```

**What it does:**
- Deletes all duplicate entries
- Validates each ticker on Yahoo Finance (checks if it's a real asset)
- Marks any ticker that doesn't exist as `is_active = false`
- Keeps everything that exists (S&P 500 + MSCI + ETFs + indexes)

**Validation process:**
1. Finds and deletes duplicate ticker entries
2. Tests each unique ticker on Yahoo Finance API
3. If ticker found → Mark as active ✓
4. If ticker not found → Mark as inactive ✗
5. All index tickers (^VIX, ^GSPC, etc.) automatically marked valid

**Expected output:**
```
Total assets in database: 970
Found XX duplicate entries
Deleted: XX duplicates

Unique assets to validate: ~960
Validating assets on Yahoo Finance...
  Checked 50/960 - AAPL ✓ VALID
  Checked 100/960 - XYZ ✗ NOT FOUND
  ...

Active assets (real, validated): ~550-600
Inactive assets (not found): ~350-400
```

**Why this approach:**
- Automatic validation against real data source
- No manual curated lists needed
- Includes S&P 500, MSCI, all legitimate ETFs
- Only removes what doesn't actually exist

---

## STEP 3: Backfill Missing Data (45-75 minutes)

**Command:**
```bash
npm run backfill:prices -- --tickers=[all-active-tickers]
# Or better, use the improved script:
npx ts-node --project tsconfig.scripts.json cleanup-3-backfill-improved.ts
```

**Key improvements in new script:**
- ✅ **Rate limiting:** 2-second delay between requests (vs 150ms before)
- ✅ **Better error handling:** Shows which tickers fail and why
- ✅ **Skip already-complete:** Doesn't re-fetch tickers with 1000+ rows
- ✅ **Progress logging:** Shows real-time progress
- ✅ **Resume capability:** Can restart without re-fetching successful tickers

**What it does:**
1. Gets all active tickers from cleaned assets table
2. Checks which already have complete data (skip these)
3. Fetches remaining tickers from Yahoo Finance (2s delay between requests)
4. Upserts into daily_prices table
5. Reports success/failure

**Expected output:**
```
Found 80 active tickers
Already complete: 45
Need to backfill: 35

[1/35] AAPL: Fetching... SUCCESS (1333 rows)
[2/35] MSFT: Fetching... SUCCESS (1333 rows)
...
[35/35] ZZZ: Fetching... FAILED (no data from Yahoo Finance)

==========================================
         BACKFILL SUMMARY
==========================================
Tickers processed:     35/35
Successful:            33
Failed:                2
Total rows upserted:   ~43,890
Already complete:      45
Time taken:            117 seconds

Failed tickers:
  - ZZZ: No data returned
  - XYZ: Network timeout
```

---

## EXECUTION PLAN

### Run all 3 steps in sequence:

```bash
# Step 1: Delete junk data (5 min)
node cleanup-1-delete-incomplete.js

# Step 2: Validate assets on Yahoo Finance (30-45 min)
node cleanup-2-validate-real-assets.js

# Step 3: Backfill missing data (45-75 min)
npx ts-node --project tsconfig.scripts.json cleanup-3-backfill-improved.ts
```

**Total time: ~90-120 minutes**

**Or** run them one at a time and verify between steps.

---

## Verification After Completion

### Check daily_prices
```bash
# Should show ~80 tickers with 1333+ rows each
node << 'EOF'
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { count } = await sb.from('daily_prices').select('*', { count: 'exact' }).limit(0);
  const { data } = await sb.from('daily_prices').select('ticker').limit(100000);
  const unique = [...new Set(data.map(d => d.ticker))].sort();
  
  console.log(`\nTotal rows: ${count?.toLocaleString()}`);
  console.log(`Unique tickers: ${unique.length}`);
  console.log(`\nAll tickers:\n${unique.join('\n')}`);
})();
EOF
```

### Check assets table
```bash
# Should show ~80 active assets
node << 'EOF'
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data } = await sb.from('assets').select('ticker', { count: 'exact' }).eq('is_active', true);
  console.log(`Active assets: ${data?.length}`);
})();
EOF
```

### Test dashboard
1. Start dev server: `npm run dev`
2. Open http://localhost:3000
3. Search for: AAPL, MSFT, GOOGL, NVDA, TSLA
4. All should load with charts

---

## Expected Final State

✅ **Daily Prices Table**
- ~400K-500K rows (from 550-600 tickers with ~1,333 rows each)
- 550-600 unique tickers (S&P 500 + MSCI + indexes + ETFs)
- All with complete 5-year trading data
- No duplicate data, no partial data

✅ **Assets Table**
- 550-600 active tickers (validated on Yahoo Finance as real assets)
- ~360-380 inactive tickers (not found on Yahoo Finance)
- No duplicates
- Includes: S&P 500 companies, MSCI stocks, major indexes, ETFs

✅ **App Functionality**
- Dashboard works for all 550-600 validated tickers
- Charts show 5+ years of history
- No "not found" errors for real assets
- Complete data coverage for all active tickers
- Works with S&P 500, MSCI, indexes, ETFs

---

## Rollback Plan (If Needed)

If something goes wrong:
1. Stop the backfill script
2. You can safely delete and re-run step 2 (assets cleanup)
3. Step 1 (delete data) is permanent - can only restore from backup

**Best practice:** Run step 1, verify with queries, then proceed to steps 2-3.

---

## Notes

- **Rate limiting:** 2 seconds per request is conservative - can reduce to 1 second if needed
- **Failed tickers:** Some tickers may not exist on Yahoo Finance (delisted, typos, etc.)
- **Partial data:** If a ticker has <1000 rows after backfill, it likely has limited historical data on Yahoo Finance
- **Resume:** If backfill stops midway, just re-run step 3 - it skips tickers that already have 1000+ rows

---

## Ready?

Run: `node cleanup-1-delete-incomplete.js`
