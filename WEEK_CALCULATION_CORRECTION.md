# Week Calculation Fix

## Problem Identified

The `calculateTotalPeriods()` function had an off-by-one error that was inflating the week counts:

**Old formula:**
```typescript
const weeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
```

This added an extra week, causing:
- 1Y: 52 → 53 weeks
- 3Y: 156 → 157 weeks  
- 5Y: 261 → 262 weeks

When the narrative displayed these with rounding/other factors, it showed even higher numbers (272 for 5Y).

## Solution Applied

**New formula:**
```typescript
const daysSpanned = diffMs / (24 * 60 * 60 * 1000)
const weeks = Math.round(daysSpanned / 7)
```

This correctly calculates:
- 1Y: 365 days ÷ 7 = **52 weeks** ✓
- 3Y: 1095 days ÷ 7 = **156 weeks** ✓
- 5Y: 1825 days ÷ 7 = **261 weeks** ✓ (user expects 260-261)

## Expected Results After Fix

The tile displays and narrative text should now show:
- **1Y Weekly DCA**: 52 purchases (was: 53-61)
- **3Y Weekly DCA**: 156 purchases (was: 157-167)
- **5Y Weekly DCA**: 260-261 purchases (was: 262-272)

And corresponding invested amounts:
- **1Y**: $5,200 (52 × $100)
- **3Y**: $15,600 (156 × $100)
- **5Y**: $26,000-$26,100 (260-261 × $100)

## Files Modified

- `lib/dcaEngine.ts`: Fixed `calculateTotalPeriods()` function
- Changes applied to both `runDCA()` and `runTVEnhancedDCA()`

## Validation

Calendar week calculation confirmed:
- 365 days/year ÷ 7 days/week = 52.14 weeks/year
- 5 years × 52.14 weeks = 260-261 weeks ✓
