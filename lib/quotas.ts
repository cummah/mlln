import { createClient as createServerClient } from '@/lib/supabase/server';

export interface QuotaLimits {
  max_watchlists: number;
  max_portfolios: number;
  asset_swap_limit_per_month: number;
}

/**
 * Fetch quota limits for a user's tier
 */
export async function getQuotaLimits(tier: number): Promise<QuotaLimits> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('tier_limits')
      .select('max_watchlists, max_portfolios, asset_swap_limit_per_month')
      .eq('tier', tier)
      .single();

    if (error || !data) {
      // Safe defaults: free tier has minimal limits
      if (tier === 0) {
        return {
          max_watchlists: 0,
          max_portfolios: 0,
          asset_swap_limit_per_month: 0,
        };
      }
      // Tier 1-3 get generous defaults if not configured
      return {
        max_watchlists: tier === 1 ? 1 : 5,
        max_portfolios: tier === 1 ? 1 : 3,
        asset_swap_limit_per_month: tier === 1 ? 5 : 100,
      };
    }

    return data;
  } catch (err) {
    console.error('[getQuotaLimits] Error:', err);
    return {
      max_watchlists: 0,
      max_portfolios: 0,
      asset_swap_limit_per_month: 0,
    };
  }
}

/**
 * Check if user can create a new watchlist
 */
export async function canCreateWatchlist(userId: string, userTier: number): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const supabase = await createServerClient();

    // Get quota limits
    const limits = await getQuotaLimits(userTier);

    // Free tier (tier 0) cannot create watchlists
    if (userTier === 0) {
      return { allowed: false, reason: 'Custom watchlists require a paid subscription' };
    }

    // Check current count
    const { count, error: countError } = await supabase
      .from('user_watchlists')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) throw countError;

    if (count !== null && count >= limits.max_watchlists) {
      return {
        allowed: false,
        reason: `Watchlist limit reached (${limits.max_watchlists} max for tier ${userTier})`,
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error('[canCreateWatchlist] Error:', err);
    return { allowed: false, reason: 'Failed to check quota' };
  }
}

/**
 * Check if user can create a new portfolio
 */
export async function canCreatePortfolio(userId: string, userTier: number): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const supabase = await createServerClient();

    // Get quota limits
    const limits = await getQuotaLimits(userTier);

    // Free tier (tier 0) cannot create portfolios
    if (userTier === 0) {
      return { allowed: false, reason: 'Custom portfolios require a paid subscription' };
    }

    // Check current count
    const { count, error: countError } = await supabase
      .from('user_portfolios')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) throw countError;

    if (count !== null && count >= limits.max_portfolios) {
      return {
        allowed: false,
        reason: `Portfolio limit reached (${limits.max_portfolios} max for tier ${userTier})`,
      };
    }

    return { allowed: true };
  } catch (err) {
    console.error('[canCreatePortfolio] Error:', err);
    return { allowed: false, reason: 'Failed to check quota' };
  }
}

/**
 * Get current month's asset swaps for a user
 */
export async function getMonthlyAssetSwapCount(userId: string): Promise<number> {
  try {
    const supabase = await createServerClient();

    const now = new Date();
    const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const monthStartISO = monthStart.toISOString();

    // Count adds and removes in watchlist_assets this month
    const { count: addCount, error: addError } = await supabase
      .from('watchlist_assets_audit')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', 'add')
      .gte('created_at', monthStartISO);

    if (addError) throw addError;

    const { count: removeCount, error: removeError } = await supabase
      .from('watchlist_assets_audit')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', 'remove')
      .gte('created_at', monthStartISO);

    if (removeError) throw removeError;

    return (addCount || 0) + (removeCount || 0);
  } catch (err) {
    console.error('[getMonthlyAssetSwapCount] Error:', err);
    // Return high number so we don't accidentally allow swaps on error
    return 999;
  }
}

/**
 * Check if user can perform another asset swap this month
 */
export async function canSwapAsset(userId: string, userTier: number): Promise<{ allowed: boolean; remaining?: number; reason?: string }> {
  try {
    const limits = await getQuotaLimits(userTier);

    // Unlimited swaps (0 means unlimited)
    if (limits.asset_swap_limit_per_month === 0) {
      return { allowed: true, remaining: 999 };
    }

    const used = await getMonthlyAssetSwapCount(userId);
    const remaining = limits.asset_swap_limit_per_month - used;

    if (remaining <= 0) {
      return {
        allowed: false,
        reason: `Asset swap limit reached (${limits.asset_swap_limit_per_month} per month)`,
      };
    }

    return { allowed: true, remaining };
  } catch (err) {
    console.error('[canSwapAsset] Error:', err);
    return { allowed: false, reason: 'Failed to check quota' };
  }
}
