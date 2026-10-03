# Adding Asset Type to Assets Table

## Implementation Plan

This guide will help you add the `asset_type` column to the assets table and classify all 717 active assets.

### Step 1: Add the Column (Manual - Supabase Dashboard)

The asset_type column must be added via the Supabase Dashboard since direct database access requires additional credentials.

**Time required:** 2 minutes

1. **Go to Supabase Dashboard:**
   - Open: https://app.supabase.com/project/gdzbgeoxvhwooudjkxao/sql

2. **Create New Query:**
   - Click "New query" button
   - Delete any placeholder text

3. **Copy and Paste this SQL:**
   ```sql
   -- Add asset_type column to assets table
   ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type TEXT;
   
   -- Create an index for faster filtering by asset type
   CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);
   ```

4. **Execute:**
   - Click "Run" (or press Ctrl+Enter)
   - You should see: "Success. No rows returned."

5. **Verify:**
   - The column now exists. You can test with:
     ```sql
     SELECT ticker, asset_type FROM assets LIMIT 5;
     ```
   - Should show: 5 rows with `asset_type` as NULL

---

### Step 2: Classify Assets (Automated)

Once the column exists, run the classification script to populate asset types.

**Time required:** 20-30 minutes (depending on Yahoo Finance API response times)

```bash
npx ts-node --project tsconfig.scripts.json scripts/classify-assets.ts
```

**What happens:**
1. Fetches all 717 active assets from the database
2. Queries Yahoo Finance API for each ticker's quote type
3. Maps Yahoo's types to our internal types:
   - `EQUITY` → `stock`
   - `ETF` → `etf`
   - `INDEX` → `index`
   - `MUTUALFUND` → `etf`
4. Saves results to `scripts/asset-classification-results.json`
5. Updates the assets table with the determined types

**Expected output:**
```
Fetching active assets from Supabase...
Found 717 active assets. Classifying...
Processing batch 1/36...
Processing batch 2/36...
...
Classification complete. Saving results to scripts/asset-classification-results.json...

Summary:
{ stock: 579, etf: 102, index: 36 }

Attempting to update Supabase...
Updated 100/717 assets...
Updated 200/717 assets...
...
Updated 717/717 assets...
```

---

### Step 3: Verify Results

**Check a sample of classifications:**

```bash
# View a sample of the classification results
head -50 scripts/asset-classification-results.json
```

**Verify specific assets in database:**

```sql
-- Check our key test cases
SELECT ticker, name, asset_type FROM assets 
WHERE ticker IN ('AAPL', 'SPY', '^VIX')
ORDER BY ticker;
```

Expected results:
- AAPL: asset_type = `stock`
- SPY: asset_type = `etf`
- ^VIX: asset_type = `index`

**Check summary counts:**

```sql
SELECT asset_type, COUNT(*) as count 
FROM assets 
WHERE is_active = true AND asset_type IS NOT NULL
GROUP BY asset_type
ORDER BY count DESC;
```

Expected:
- stock: ~579
- etf: ~102
- index: ~36

---

## Schema Changes Summary

### Before
```sql
CREATE TABLE IF NOT EXISTS assets (
  ticker text PRIMARY KEY,
  name text NOT NULL,
  sector text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```

### After
```sql
CREATE TABLE IF NOT EXISTS assets (
  ticker text PRIMARY KEY,
  name text NOT NULL,
  sector text,
  is_active boolean DEFAULT true,
  asset_type TEXT,  -- NEW COLUMN
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);  -- NEW INDEX
```

---

## Files Involved

- **Migration:**
  - `supabase/migrations/add_asset_type_column.sql` - SQL migration
  
- **Scripts:**
  - `scripts/classify-assets.ts` - Fetches and classifies assets from Yahoo Finance
  - `scripts/apply-migration.ts` - Helper to check if column exists

- **Results:**
  - `scripts/asset-classification-results.json` - Classification results (created after Step 2)

---

## Troubleshooting

### Column Still Doesn't Exist After Step 1

**Problem:** The migration ran but SELECT still shows error.

**Solution:**
1. Refresh the page in Supabase dashboard
2. Try the verification query again:
   ```sql
   SELECT asset_type FROM assets LIMIT 1;
   ```

### Script Fails with "column does not exist"

**Problem:** Classification script says column doesn't exist.

**Solution:**
1. Go back to Step 1 and verify the column was created
2. Run this in Supabase dashboard to confirm:
   ```sql
   \d assets
   ```
   Should show `asset_type` in the output

### Yahoo Finance Rate Limiting

**Problem:** Script stops with "Too many requests" error.

**Solution:**
1. Wait 5-10 minutes
2. Re-run the classification script - it's idempotent and will resume where it left off
3. Alternatively, modify the BATCH_SIZE in `scripts/classify-assets.ts` to be smaller (10 instead of 20)

### Some Assets Get "ERROR" Type

**Problem:** Some tickers show `asset_type = 'stock'` with `yahoo_type = 'ERROR'`.

**Solution:**
1. These are tickers that don't exist on Yahoo Finance (delisted, invalid, etc.)
2. The script defaults to 'stock' for error cases
3. Check the `asset-classification-results.json` file for which ones failed
4. These can be manually investigated or left as-is

---

## Next Steps After Completion

Once the asset type column is populated:

1. **Use it in the application:**
   - Filter assets by type in the frontend
   - Sort or group by asset type
   - Display asset type in UI components

2. **Update queries to leverage it:**
   - Find all ETFs: `SELECT * FROM assets WHERE asset_type = 'etf'`
   - Find all indexes: `SELECT * FROM assets WHERE asset_type = 'index'`
   - Find all stocks: `SELECT * FROM assets WHERE asset_type = 'stock'`

3. **Create views or functions:**
   ```sql
   CREATE VIEW active_etfs AS
   SELECT * FROM assets 
   WHERE is_active = true AND asset_type = 'etf';
   ```

---

## Summary

| Step | Action | Time | Status |
|------|--------|------|--------|
| 1 | Add column via Supabase Dashboard | 2 min | ⏳ Waiting for manual action |
| 2 | Run classification script | 20-30 min | ⏳ Will run after Step 1 |
| 3 | Verify results | 2 min | ⏳ Will verify after Step 2 |

**Total time:** ~25-35 minutes

---

## Ready?

1. Open https://app.supabase.com/project/gdzbgeoxvhwooudjkxao/sql
2. Run the SQL migration from Step 1
3. Come back and run the classification script from Step 2
