# Tile Data Fixes Summary

## Issues Fixed

The assets and sector pages were showing incorrect data in the 3-tile performance cards (1Y, 3Y, 5Y). The primary issues were:

1. **Incorrect purchase counts**: 5Y showed 206 purchases on standard when it should be ~260-261 weeks
2. **Incorrect invested amounts**: Related to the wrong purchase counts
3. **Misaligned enhanced vs standard data**: Enhanced column was estimated from standard DCA instead of using actual enhanced DCA results
4. **Date ranges not aligned**: Enhanced and standard DCA were using different date range logic

## Root Causes

1. **totalWeeks calculation bug**: `runDCA` was counting only the periods where DCA executed (where indicators were valid), not the total number of possible periods in the date range
2. **Missing enhanced DCA data**: BacktestTiles component was estimating enhanced purchases from invested amount instead of using actual counts from the TV Enhanced DCA backtest
3. **Data structure mismatch**: Dashboard wasn't passing TV Enhanced DCA data to BacktestTiles

## Changes Made

### 1. Fixed `lib/dcaEngine.ts`

#### Added `calculateTotalPeriods()` function
- Calculates the actual number of periods (weeks/months) in a date range
- For weekly frequency: counts weeks between start and end dates
- For monthly frequency: counts months between start and end dates

#### Fixed `runDCA()` function
- **Two-pass approach**: 
  - First pass: Find all Mondays in the data range to establish `dateRangeStart` and `dateRangeEnd`
  - Second pass: Execute DCA and accumulate investments/returns
- **Correct totalWeeks**: Now calculated as the number of periods between start and end dates, not just executed purchases
- Now correctly returns ~52 weeks for 1Y, ~156 weeks for 3Y, and ~260-261 weeks for 5Y

#### Fixed `runTVEnhancedDCA()` function
- **Added first pass**: Similar to runDCA, finds all possible DCA periods before executing
- **Corrected std purchases count**: Now returns the total number of periods in the date range instead of periods where indicators were valid
- **Correct date range**: Established before the main execution loop, ensuring both std and enh use the same date range

### 2. Updated `components/ticker/BacktestTiles.tsx`

- **Changed data source for enhanced metrics**: Now uses actual TV Enhanced DCA data (`tvData`) instead of estimating
- **Uses actual purchase counts**: Gets `enhBuys` and `enhSkipped` from TV Enhanced DCA's purchase counts instead of estimating from invested amount
- **Gets correct alpha**: Uses alpha from TV Enhanced DCA result
- **Properly structured data access**: 
  ```typescript
  const tvData = windowData.tv;
  const enhStats = tvData?.enh || {};
  const tvPurchases = tvData?.purchases || {};
  const enhBuys = tvPurchases.enh !== undefined ? tvPurchases.enh : 0;
  const enhSkipped = tvPurchases.skipped !== undefined ? tvPurchases.skipped : 0;
  ```

### 3. Updated `app/dashboard/[ticker]/page.tsx`

- **Added TV data to backtestResults structure**: Now passes TV Enhanced DCA backtest data for all windows (1Y, 3Y, 5Y)
- ```typescript
  backtestResults: {
    '1y': {
      weekly: windowResults['1y']?.weekly?.backtest,
      monthly: windowResults['1y']?.monthly?.backtest,
      tv: windowResults['1y']?.tv?.backtest,  // Added
    },
    // ... same for 3y and 5y
  }
  ```

## Expected Results After Fix

### 5Y Window (with weekly frequency, $100 base amount)
- **Standard DCA**: 
  - Purchases: ~260-261 weeks (was: 206)
  - Invested: ~$26,000 (was: ~$20,600)
- **Enhanced DCA**: 
  - Purchases: Real count from TV Enhanced DCA (was: incorrectly estimated as 408)
  - Skipped: Correct count from TV Enhanced DCA
  - Invested: Actual amount from TV backtest
- **Date Range**: Properly aligned between standard and enhanced

### 3Y Window
- **Standard DCA**: 
  - Purchases: ~156 weeks
  - Invested: ~$15,600
- **Enhanced DCA**: Uses actual TV Enhanced DCA data

### 1Y Window
- **Standard DCA**: 
  - Purchases: ~52 weeks
  - Invested: ~$5,200
- **Enhanced DCA**: Uses actual TV Enhanced DCA data

## Data Flow

```
Signal API (/api/signal/[ticker])
├── Runs runDCA (weekly/monthly)
│   └── Returns: totalWeeks (now correct), invested amounts
├── Runs runTVEnhancedDCA
│   └── Returns: purchases counts (std=total periods, enh=enhanced purchases, skipped)
└── Returns both results

Dashboard Page
├── Fetches all windows (1Y, 3Y, 5Y)
├── Builds backtestResults with both weekly/monthly AND tv data
└── Passes to BacktestTiles component

BacktestTiles Component
├── Gets real data from backtestResults
├── Uses standard DCA data for "Standard" column
├── Uses TV Enhanced DCA data for "Enhanced" column
└── Correctly displays: purchases, invested, value, return, alpha
```

## Testing

All TypeScript compilation passes for modified files. The changes maintain backward compatibility with the existing data structures while fixing the calculation logic.
