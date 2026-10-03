# S&P 500 Ticker Synchronization

This documents the S&P 500 ticker sync and backfill process for the MLLN AI application.

## Overview

The system now supports:
1. **Fetching current S&P 500 constituents** from external sources
2. **Comparing against existing database** to identify missing tickers
3. **Upserting new tickers** with proper sector designation
4. **Backfilling price data** for only newly added tickers (avoids redundant API calls)

## Scripts

### 1. sync-sp500.ts
Synchronizes S&P 500 constituents with the Supabase assets table.

**What it does:**
- Fetches all existing tickers from the assets table
- Compares against the S&P 500 list
- Upserts new tickers with `sector='S&P 500'` and `is_active=true`
- Automatically runs the backfill script for newly added tickers only

**Usage:**
```bash
npm run sync:sp500
# or
npx ts-node --project tsconfig.scripts.json scripts/sync-sp500.ts
```

**Output Example:**
```
==========================================
    S&P 500 Ticker Synchronization
==========================================

Fetching existing tickers from Supabase...
Found 602 existing tickers

New S&P 500 tickers to add: 5
Tickers: NEWT, TECH, MORE, TICK, HERE

Upserting new tickers...
✓ Successfully added 5 new tickers

Running price backfill for new tickers...
Executing: npx ts-node backfill-prices.ts --tickers=NEWT,TECH,MORE,TICK,HERE

... [backfill output] ...

==========================================
         SYNC COMPLETED
==========================================
New tickers added:     5
Total S&P 500 tickers: 500
Database total:        607
==========================================
```

### 2. backfill-prices.ts (Enhanced)
Now supports filtering by specific tickers via the `--tickers` flag.

**New Feature: --tickers Flag**
Process only specific tickers instead of all active tickers.

**Usage:**
```bash
# Backfill all active tickers (original behavior)
npm run backfill:prices

# Backfill specific tickers only
npx ts-node --project tsconfig.scripts.json scripts/backfill-prices.ts --tickers=AAPL,MSFT,GOOGL
```

**Example Output:**
```
Using specific tickers: AAPL, MSFT, GOOGL

Found 3 active tickers

Progress: 3/3 - GOOGL: 1332 bars upserted

==========================================
         BACKFILL PRICES SUMMARY
==========================================
Total tickers processed:   3/3
Total rows upserted:       3996
Total tickers skipped:     0 (index tickers)
Total tickers failed:      0

Time taken:                1.69s
==========================================
```

## Workflow

### Complete S&P 500 Sync + Backfill
1. Update the S&P 500 list in `sync-sp500.ts` (manually or from an external source)
2. Run the sync script:
   ```bash
   npm run sync:sp500
   ```
3. The script will:
   - ✓ Query existing tickers
   - ✓ Identify missing ones
   - ✓ Add them to the database
   - ✓ Automatically backfill historical prices for new tickers only

### Manual Backfill
To backfill specific tickers without the sync process:
```bash
npx ts-node --project tsconfig.scripts.json scripts/backfill-prices.ts --tickers=TICK1,TICK2,TICK3
```

## Important Notes

### Sector Field
- **New S&P 500 tickers**: Added with `sector='S&P 500'` (generic designation)
- **Existing tickers**: Keep their original sector values from the seed-assets.ts (e.g., 'Information Technology')
- You can update sectors separately if needed using a dedicated migration script

### Rate Limiting
- The backfill script uses 150ms delays between Yahoo Finance API requests
- For 500 tickers, expect ~75 seconds total execution time
- Parallel processing is not recommended due to API rate limits

### Data Source
Currently, the S&P 500 list is manually curated from:
- `scripts/seed-assets.ts` - contains comprehensive S&P 500 data as of 2024

To fetch the latest live list from slickcharts.com:
1. Visit https://www.slickcharts.com/sp500
2. Extract the ticker symbols
3. Update the `sp500Assets` array in `sync-sp500.ts`
4. Run `npm run sync:sp500`

## Database Statistics

Current status (2026-04-23):
- **Existing tickers**: 602
- **S&P 500 constituents**: 500
- **Coverage**: ~83% of S&P 500 in database

## Troubleshooting

### "Error fetching assets"
- Check Supabase credentials in `.env.local`
- Verify database connection

### "No data returned from Yahoo Finance"
- Ticker may not exist on Yahoo Finance
- May be a private company or index
- Check the `failedTickers` list in output

### Script hangs during backfill
- Network connectivity issue
- API rate limiting (Yahoo Finance temporarily blocking)
- Wait a few minutes and retry

## Related Commands

```bash
# Seed all assets (comprehensive setup)
npm run seed:assets

# Backfill prices for all active tickers
npm run backfill:prices

# Sync S&P 500 and backfill new tickers only
npm run sync:sp500
```
