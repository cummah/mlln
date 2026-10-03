# Backtest Summary Setup - Final Steps

## Status: Ready to Deploy ✅

You have **694 backtest computations ready** to be stored. Now we need to:
1. Create the table in Supabase
2. Populate it with the computed data

---

## Step 1: Create the Table in Supabase

### Quick Instructions:
1. Go to: **https://app.supabase.com**
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. **Paste the SQL below** (all of it)
6. Click **Run** (top right)
7. Wait for "Success" message

### SQL to Run:

```sql
-- Create backtest_summary table for SEO pre-computed results
CREATE TABLE IF NOT EXISTS backtest_summary (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  ticker VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  sector VARCHAR(100),
  backtest_start DATE,

  -- 1Y results
  std_return_1y NUMERIC(10,2),
  enh_return_1y NUMERIC(10,2),
  alpha_1y NUMERIC(10,2),
  std_invested_1y NUMERIC(15,2),
  enh_invested_1y NUMERIC(15,2),
  std_value_1y NUMERIC(15,2),
  enh_value_1y NUMERIC(15,2),
  std_purchases_1y INTEGER,
  enh_purchases_1y INTEGER,
  std_avg_entry_1y NUMERIC(15,2),
  enh_avg_entry_1y NUMERIC(15,2),
  std_shares_1y NUMERIC(15,6),
  enh_shares_1y NUMERIC(15,6),

  -- 3Y results
  std_return_3y NUMERIC(10,2),
  enh_return_3y NUMERIC(10,2),
  alpha_3y NUMERIC(10,2),
  std_invested_3y NUMERIC(15,2),
  enh_invested_3y NUMERIC(15,2),
  std_value_3y NUMERIC(15,2),
  enh_value_3y NUMERIC(15,2),
  std_purchases_3y INTEGER,
  enh_purchases_3y INTEGER,
  std_avg_entry_3y NUMERIC(15,2),
  enh_avg_entry_3y NUMERIC(15,2),
  std_shares_3y NUMERIC(15,6),
  enh_shares_3y NUMERIC(15,6),

  -- 5Y results
  std_return_5y NUMERIC(10,2),
  enh_return_5y NUMERIC(10,2),
  alpha_5y NUMERIC(10,2),
  std_invested_5y NUMERIC(15,2),
  enh_invested_5y NUMERIC(15,2),
  std_value_5y NUMERIC(15,2),
  enh_value_5y NUMERIC(15,2),
  std_purchases_5y INTEGER,
  enh_purchases_5y INTEGER,
  std_avg_entry_5y NUMERIC(15,2),
  enh_avg_entry_5y NUMERIC(15,2),
  std_shares_5y NUMERIC(15,6),
  enh_shares_5y NUMERIC(15,6),

  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_backtest_summary_ticker ON backtest_summary(ticker);
CREATE INDEX IF NOT EXISTS idx_backtest_summary_sector ON backtest_summary(sector);
```

---

## Step 2: Populate the Table

Once the table is created, run this command in your terminal:

```bash
npx tsx scripts/compute-backtest-summary.ts
```

This will:
- ✅ Process all 719 assets
- ✅ Generate 694 successful backtest computations
- ✅ Upsert them into the `backtest_summary` table
- ✅ Handle duplicates automatically (unique ticker constraint)
- ✅ Take ~6-7 minutes to complete

Expected output at the end:
```
==========================================
        BACKTEST SUMMARY COMPLETE
==========================================
Total assets:              719
Successfully processed:    694
Rows upserted:             694
==========================================
```

---

## Step 3: Verify Data

After the script completes, verify the data was stored:

```bash
npx tsx scripts/check-backtest-summary.ts
```

You should see sample rows from SPY, AAPL, MSFT, etc. with their 5-year backtest returns.

---

## What Happens Next

Once the table is populated:

1. **SEO pages use real data**: All 694 assets have dynamic metadata, narratives, FAQs, and OG images
2. **getBacktestSummary() reads from table**: No more API fallbacks, pure database queries
3. **All pages scale**: The dashboard supports all 694 assets with pre-computed backtests
4. **Zero duplicates**: Unique ticker constraint + upsert logic ensures clean data

---

## Files Involved

- `scripts/compute-backtest-summary.ts` - Computes all backtests and populates table
- `scripts/check-backtest-summary.ts` - Verifies data was stored correctly
- `lib/backtest-summary.ts` - Reads from table (with API fallback)
- `supabase/migrations/create_backtest_summary.sql` - Table schema

---

## Troubleshooting

**Q: "Could not find the table" error**
- The table wasn't created. Go back to Step 1 and run the SQL.

**Q: "Rows upserted: 0"**
- Table exists but there's a schema mismatch. Verify all column names match exactly (snake_case).

**Q: Script hangs/never completes**
- Check Supabase status. If database is slow, the 694 computations + upserts may take 10+ minutes.

**Q: Need to re-run computation**
- Safe to run anytime. The upsert will replace old data with new data per ticker.

---

## Summary

✅ 694 backtest computations ready  
⏳ Table needs to be created in Supabase (1 min manual step)  
📊 Populating will take ~6-7 minutes  
🚀 Then all SEO features go live with real data
