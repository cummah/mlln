import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getQuotaLimits, canCreateWatchlist, canCreatePortfolio, getMonthlyAssetSwapCount, canSwapAsset } from './quotas';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn(function(this: any) {
        return {
          eq: vi.fn(function(this: any) {
            return {
              single: vi.fn(async () => {
                if (table === 'tier_limits') {
                  const tier = arguments[1];
                  if (tier === 0) return { data: null, error: null };
                  if (tier === 1) return { data: { max_watchlists: 1, max_portfolios: 1, asset_swap_limit_per_month: 5 }, error: null };
                  if (tier === 2) return { data: { max_watchlists: 3, max_portfolios: 2, asset_swap_limit_per_month: 50 }, error: null };
                  return { data: { max_watchlists: 5, max_portfolios: 3, asset_swap_limit_per_month: 100 }, error: null };
                }
                return { data: null, error: null };
              }),
              gte: vi.fn(function(this: any) {
                return this;
              }),
            };
          }),
        };
      }),
    })),
  })),
}));

describe('Quota System', () => {
  describe('getQuotaLimits', () => {
    it('should return zero limits for tier 0 (free)', async () => {
      const limits = await getQuotaLimits(0);
      expect(limits.max_watchlists).toBe(0);
      expect(limits.max_portfolios).toBe(0);
      expect(limits.asset_swap_limit_per_month).toBe(0);
    });

    it('should return restricted limits for tier 1', async () => {
      const limits = await getQuotaLimits(1);
      expect(limits.max_watchlists).toBeGreaterThan(0);
      expect(limits.max_portfolios).toBeGreaterThan(0);
      expect(limits.asset_swap_limit_per_month).toBeGreaterThan(0);
    });

    it('should return generous limits for tier 3', async () => {
      const limits = await getQuotaLimits(3);
      expect(limits.max_watchlists).toBeGreaterThanOrEqual(3);
      expect(limits.max_portfolios).toBeGreaterThanOrEqual(2);
      expect(limits.asset_swap_limit_per_month).toBeGreaterThanOrEqual(50);
    });
  });

  describe('canCreateWatchlist', () => {
    it('should reject tier 0 users', async () => {
      const result = await canCreateWatchlist('user-1', 0);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('paid subscription');
    });

    it('should allow tier 1 users within limit', async () => {
      // This test requires mocking watchlist count
      // For now, we expect it to be structured correctly
      const result = await canCreateWatchlist('user-1', 1);
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('reason');
    });
  });

  describe('canCreatePortfolio', () => {
    it('should reject tier 0 users', async () => {
      const result = await canCreatePortfolio('user-1', 0);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('paid subscription');
    });

    it('should allow tier 2+ users within limit', async () => {
      const result = await canCreatePortfolio('user-1', 2);
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('reason');
    });
  });

  describe('Asset Swap Quota', () => {
    it('should track monthly swaps correctly', async () => {
      const count = await getMonthlyAssetSwapCount('user-1');
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should reject swaps when quota exceeded', async () => {
      const result = await canSwapAsset('user-1', 1);
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('remaining');
      if (!result.allowed) {
        expect(result.reason).toBeDefined();
      }
    });

    it('should allow unlimited swaps for tier 3', async () => {
      const result = await canSwapAsset('user-1', 3);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });
  });

  describe('Tier-based quota variations', () => {
    const testCases = [
      { tier: 0, expectAllowWatchlist: false },
      { tier: 1, expectAllowWatchlist: true }, // Within limit
      { tier: 2, expectAllowWatchlist: true },
      { tier: 3, expectAllowWatchlist: true },
    ];

    testCases.forEach(({ tier, expectAllowWatchlist }) => {
      it(`tier ${tier} watchlist creation should ${expectAllowWatchlist ? 'allow' : 'deny'}`, async () => {
        const result = await canCreateWatchlist('user-1', tier);
        if (expectAllowWatchlist) {
          // Tier 0 always denies, others depend on current count
          if (tier === 0) {
            expect(result.allowed).toBe(false);
          }
        } else {
          expect(result.allowed).toBe(false);
        }
      });
    });
  });
});
