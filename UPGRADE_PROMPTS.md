# Upgrade Prompts System

## Overview

Upgrade prompts are modal dialogs that appear when users hit tier or quota limits, guiding them toward paid plans with clear benefit comparisons.

## Components

### UpgradePrompt (`components/upgrade/UpgradePrompt.tsx`)
Modal component that displays:
- **Current situation** — why they're seeing this (tier-locked or quota exceeded)
- **Tier comparison** — pricing and benefits side-by-side
- **CTA buttons** — direct checkout links for each tier
- **FAQ** — billing info and guarantees

**Props:**
```typescript
interface UpgradePromptProps {
  currentTier: number;           // 0-3
  requiredTier: number;          // Minimum tier needed
  feature: string;               // "Custom Watchlists", "Asset Swaps", etc.
  reason: 'tier_locked' | 'quota_exceeded';
  tierBenefits?: Record<number, string[]>; // Custom benefits list
  onClose?: () => void;
}
```

### useUpgradePrompt Hook (`hooks/useUpgradePrompt.ts`)
State management for upgrade prompts:

```typescript
const { isOpen, props, show, close, showTierLocked, showQuotaExceeded, handleError } = useUpgradePrompt();

// Show by reason
showTierLocked(0, 1, 'Custom Watchlists');
showQuotaExceeded(1, 'Asset Swaps', 'You've hit your monthly limit');

// Parse API error and show appropriate prompt
handleError(error, currentTier);
```

## Integration

### In Components
1. Import hook and component:
```tsx
import { useUpgradeFromError } from '@/hooks/useUpgradePrompt';
import UpgradePrompt from '@/components/upgrade/UpgradePrompt';

export default function MyComponent() {
  const { isOpen, props, close, handleError } = useUpgradeFromError();
  
  const handleError = async () => {
    const res = await fetch('/api/...', { method: 'POST' });
    if (res.status === 403) {
      handleError(await res.json(), userTier);
    }
  };

  return (
    <>
      {/* Your component JSX */}
      {isOpen && props && <UpgradePrompt {...props} onClose={close} />}
    </>
  );
}
```

2. Show on specific errors:
```tsx
const handleCreateWatchlist = async () => {
  const res = await fetch('/api/user/watchlists', { method: 'POST', ... });
  
  if (res.status === 403) {
    // Error 403 = tier locked or quota exceeded
    // handleError() automatically detects which one
    handleError(error, tier);
  }
};
```

## When Prompts Appear

| Action | Condition | Reason |
|--------|-----------|--------|
| Create watchlist | Tier 0 | `tier_locked` |
| Create watchlist | Tier 1-3 at limit | `quota_exceeded` |
| Add asset | Monthly swap limit hit | `quota_exceeded` |
| Create portfolio | Tier 0 | `tier_locked` |
| Delete asset | Monthly swap limit hit | `quota_exceeded` |

## Customization

### Custom Tier Benefits
Pass your own benefits to show different tier features:

```tsx
const myBenefits = {
  1: ['Advanced Analytics', 'API Access', 'Webhooks'],
  2: ['Everything in Tier 1', 'Custom Alerts'],
  3: ['Everything in Tier 2', '24/7 Support'],
};

<UpgradePrompt {...props} tierBenefits={myBenefits} onClose={close} />
```

### Custom Pricing
Update `TIER_PRICES` in `UpgradePrompt.tsx` to reflect your checkout system.

## Behavior

### For Tier 0 Users
- Shows tiers 1 and 2 side-by-side
- Highlights the required tier
- Pricing and features clear

### For Tier 1/2 Users Hitting Quota
- Shows current tier + next tier
- "Upgrade to Tier X" heading
- Feature highlighting shows what's unlocked

### On Upgrade Click
- Directs to `/api/checkout/revolut` with tier
- Revolut checkout modal opens
- User redirected back after payment

## Test Checklist

- [ ] Tier 0 user tries to create watchlist → shows tier comparison
- [ ] Tier 1 user at watchlist limit tries to create another → shows upgrade modal
- [ ] Tier 1 user at swap limit tries to add asset → shows upgrade modal
- [ ] Click "Choose" button → redirects to checkout
- [ ] Close button (×) closes modal without action
- [ ] Click outside modal → closes modal
- [ ] Tier 2+ users don't see prompts for watchlist creation (higher limits)
- [ ] Monthly swap reset allows swaps again next month

## Error Message Parsing

The `handleError()` function in the hook detects:
- `"paid subscription"` → `tier_locked` — free user on paid feature
- `"limit reached"` → `quota_exceeded` — tier user hit monthly quota

This auto-detection means you don't need to manually specify the reason in most cases.

## Related Files
- `components/upgrade/UpgradePrompt.tsx` — modal component
- `hooks/useUpgradePrompt.ts` — state + auto-detection
- `components/account/WatchlistManagement.tsx` — example integration
- `lib/quotas.ts` — quota checking (works with prompts)
- `QUOTA_SYSTEM.md` — quota limits reference
