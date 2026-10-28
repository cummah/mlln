# Quota & Tier Enforcement System

## What's Implemented

### ✅ Database Layer
- **RLS** on all tables (defense in depth) — `20261028_enable_rls_all_tables.sql`
- **Audit table** for tracking asset swaps — `20261028_add_quota_tracking.sql`
- **Quota reset tracking** — `quota_reset_date` column on profiles

### ✅ Business Logic
- `lib/quotas.ts` — quota enforcement functions:
  - `getQuotaLimits(tier)` — fetch limits from tier_limits table
  - `canCreateWatchlist(userId, tier)` — block tier 0, enforce count limits
  - `canCreatePortfolio(userId, tier)` — block tier 0, enforce count limits
  - `canSwapAsset(userId, tier)` — enforce monthly asset swap limits
  - `getMonthlyAssetSwapCount(userId)` — count swaps this month from audit table

### ✅ API Enforcement
- `/api/user/watchlists` — POST now checks `canCreateWatchlist()`
- `/api/user/portfolios` — POST now checks `canCreatePortfolio()`
- `/api/user/watchlists/[id]/assets` — POST/DELETE now:
  - Check `canSwapAsset()` before allowing
  - Log to `watchlist_assets_audit` on success
  - Return `remaining_swaps_this_month` in response
- `/api/payment/verify` — updates `quota_reset_date` on renewal

### ✅ Tests
- `lib/quotas.test.ts` — unit tests for quota logic
- `__tests__/api/quotas.integration.test.ts` — integration test matrix (specs only)

---

## Running the Migrations

### Step 1: Apply RLS Migration
```sql
-- Copy contents of supabase/migrations/20261028_enable_rls_all_tables.sql
-- Paste into Supabase SQL Editor → New Query
-- Click Run
```

### Step 2: Apply Quota Migration
```sql
-- Copy contents of supabase/migrations/20261028_add_quota_tracking.sql
-- Paste into Supabase SQL Editor → New Query
-- Click Run
```

**Verify:**
```sql
-- Check audit table exists
SELECT * FROM watchlist_assets_audit LIMIT 1;

-- Check quota_reset_date column exists
SELECT quota_reset_date FROM profiles LIMIT 1;
```

---

## How It Works

### Tier Limits (from `tier_limits` table)
| Tier | Name | Max Watchlists | Max Portfolios | Asset Swaps/Month |
|------|------|---|---|---|
| 0 | Free | 0 | 0 | 0 |
| 1 | Essential | 1 | 1 | 5 |
| 2 | Full Access | 3 | 2 | 50 |
| 3 | Pro | 5 | 3 | 100 |

### Quota Reset
- **When**: On successful payment verification (`/api/payment/verify`)
- **What resets**: `quota_reset_date` is set to now, monthly swap counters reset
- **How to query**: Counts from `watchlist_assets_audit` where `created_at >= quota_reset_date`

### Asset Swap Quota
Counts both adds and removes in `watchlist_assets_audit` within the current month:
```sql
SELECT COUNT(*) as swaps_this_month
FROM watchlist_assets_audit
WHERE user_id = $1
  AND created_at >= DATE_TRUNC('month', NOW());
```

---

## Testing the System

### Test Tier 0 (Free User)
```bash
# Try to create watchlist
curl -X POST /api/user/watchlists \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"My List"}'
# Expect: 403 "Custom watchlists require a paid subscription"
```

### Test Quota Limit (Tier 1)
```bash
# Tier 1 user can create 1 watchlist
# Create watchlist #1 → success
# Try to create watchlist #2 → 403 "Watchlist limit reached"
```

### Test Asset Swap Limit
```bash
# Tier 1 user has 5 swaps/month
curl -X POST /api/user/watchlists/[id]/assets \
  -d '{"ticker":"AAPL"}'
# Response includes: "remaining_swaps_this_month": 4

# After 5 swaps:
curl -X POST /api/user/watchlists/[id]/assets \
  -d '{"ticker":"MSFT"}'
# Expect: 403 "Asset swap limit reached"
```

### Test Quota Reset on Renewal
```bash
# Before renewal: user has 0 swaps left
# After payment/verify: quota_reset_date updates
# Next swap succeeds with fresh quota
```

---

## Admin Controls

### Updating Tier Limits
Access `/admin/tier-limits` (tier 4 only) to adjust quotas per tier:
- Max Watchlists
- Max Portfolios  
- Asset Swaps per Month

Changes apply immediately to all users at that tier.

### Monitoring Usage
Admin can view `watchlist_assets_audit` table to see:
- Which users are near their swap limit
- Usage patterns by tier
- When quotas reset

---

## Edge Cases Handled

✅ User upgrades mid-month — remaining quota updates  
✅ User downgrades mid-month — tier 1 limits apply immediately  
✅ Watchlist deleted → can create new one (freed up quota)  
✅ Asset swap fails → not logged to audit table  
✅ Payment success → quota_reset_date updates  
✅ Tier 0 users → blocked at API layer + RLS prevents direct DB access  

---

## Next Steps

### Before Launch
- [ ] Apply both migrations to prod Supabase
- [ ] Test each tier in staging
- [ ] Monitor `watchlist_assets_audit` logs
- [ ] Add upgrade prompts UI (separate task)
- [ ] Add cancellation flow (separate task)

### After Launch (Monitoring)
- Watch for users hitting quotas (indicate demand for higher tiers)
- Monitor `quota_reset_date` to catch renewal issues
- Use audit table to debug swap-related support tickets

---

## Related Files
- `lib/quotas.ts` — quota logic
- `lib/quotas.test.ts` — unit tests
- `app/api/user/watchlists/route.ts` — creation quota check
- `app/api/user/portfolios/route.ts` — creation quota check
- `app/api/user/watchlists/[id]/assets/route.ts` — swap quota + audit logging
- `app/api/payment/verify/route.ts` — quota reset on renewal
- `supabase/migrations/20261028_enable_rls_all_tables.sql` — RLS
- `supabase/migrations/20261028_add_quota_tracking.sql` — audit + reset tracking
