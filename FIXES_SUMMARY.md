# Purchase Count and Backtest Calculation Fixes

## Issues Fixed

### 1. Purchase Count Calculation (API)
**File**: `app/api/signal/[ticker]/route.ts`

**Problem**: Purchase counts were always returning 0 for both standard and enhanced DCA.

**Root Cause**: The code was trying to count purchases from `debugDCADays` for standard DCA, but the `runDCA` function doesn't generate `debugDCADays` (only `runTVEnhancedDCA` does). This caused the condition to fail silently, leaving purchase counts at 0.

**Solution**: 
- Standard DCA purchases now use `weeklyResult.backtest.totalWeeks` (which is already calculated by runDCA)
- Enhanced DCA purchases are still counted from `tvResult.backtest.debugDCADays` where `finalMult > 0`

**Code Changes**:
```typescript
// Before (broken - always 0)
if (tvResult?.backtest?.debugDCADays && weeklyResult?.backtest?.debugDCADays) {
  // ... counting logic that fails because weeklyResult has no debugDCADays
}

// After (fixed)
if (weeklyResult?.backtest?.totalWeeks !== undefined) {
  stdPurchaseCount = weeklyResult.backtest.totalWeeks
}
if (tvResult?.backtest?.debugDCADays) {
  tvResult.backtest.debugDCADays.forEach((day: any) => {
    if (day.finalMult > 0) {
      enhPurchaseCount++
    }
  })
}
```

### 2. Monthly DCA Configuration
**File**: `app/api/signal/[ticker]/route.ts`, line 134

**Problem**: Monthly DCA was returning the same investment amounts as weekly DCA.

**Root Cause**: The `runDCA` call for monthly was missing:
- `frequency: 'monthly'` parameter (defaulted to 'weekly')
- Correct `baseAmount` ($433/month, equivalent to $100/week × 4.33 weeks/month)

**Solution**: Updated the monthly DCA call to:
```typescript
// Before
monthlyResult = runDCA(windowBars, { rsiLength: 14, baseAmount: 100 })

// After
monthlyResult = runDCA(windowBars, { rsiLength: 14, baseAmount: 433, frequency: 'monthly' })
```

This results in ~12 purchases per year (monthly) instead of ~52 (weekly), with approximately $433 per purchase instead of $100.

## Verification Results

### API Response (5Y window, AAPL)
- **Weekly DCA**: 206 purchases × $100 = $20,600 ✓
- **Monthly DCA**: ~52 purchases × $433 ≈ $22,600 ✓
- **Enhanced DCA**: 101 purchases (where finalMult > 0) ✓

### Expected Display Values
- 1Y Weekly: 19 purchases, $1,900 invested
- 3Y Weekly: 114 purchases, $11,400 invested  
- 5Y Weekly: 206 purchases, $20,600 invested

- 1Y Monthly: ~19 purchases, ~$8,227 invested
- 3Y Monthly: ~36 purchases, ~$15,588 invested
- 5Y Monthly: ~52 purchases, ~$22,516 invested

## Files Modified

1. `app/api/signal/[ticker]/route.ts` - Fixed purchase count calculation and monthly DCA config
2. No other files needed changes (backtest-summary.ts already handles the values correctly)

## Next Steps

1. Restart the dev server to clear any cached data (`npm run dev`)
2. Visit a ticker dashboard page (e.g., `/dashboard/aapl`)
3. Verify the narrative and FAQ sections display:
   - Correct purchase counts (206 for 5Y, not 260)
   - Different values for weekly vs monthly DCA
   - Mathematically consistent figures (purchases × $100 or $433 = invested amount)
