import { createClient as createServerClient } from '@/lib/supabase/server';
import type { Entitlement, GatingSection, UserTier } from '@/types';

/**
 * Check if current user is an admin (tier 4).
 * Returns false if not authenticated.
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('tier')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return false;
    }

    return data.tier === 4;
  } catch (err) {
    console.error('[isAdmin] Error:', err);
    return false;
  }
}

/**
 * Get the current user's entitlement (tier + allowed assets).
 * Returns tier 0 (no access) if not authenticated.
 */
export async function getEntitlement(): Promise<Entitlement> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { tier: 0, assets: new Set() };
    }

    // Fetch user's profile and allowed assets
    const [profileRes, assetsRes] = await Promise.all([
      supabase.from('profiles').select('tier').eq('user_id', user.id).single(),
      supabase.from('user_assets').select('ticker').eq('user_id', user.id),
    ]);

    const tier = (profileRes.data?.tier || 0) as UserTier;
    const assets = new Set((assetsRes.data || []).map(row => row.ticker));

    return { tier, assets };
  } catch (err) {
    console.error('[getEntitlement] Error:', err);
    return { tier: 0, assets: new Set() };
  }
}

/**
 * Check if an entitlement can see the latest signal for a specific ticker and section.
 * - Tier 0: never
 * - Tier 1: only if ticker is in their allowed assets
 * - Tier 2/3: always (unless tier_permissions blocks it)
 */
export function canSeeLatestSignal(
  entitlement: Entitlement,
  ticker: string,
  section: GatingSection,
  tierPermissions: Map<`${GatingSection}:${UserTier}`, boolean>
): boolean {
  const permissionKey = `${section}:${entitlement.tier}` as const;
  const hasPermission = tierPermissions.get(permissionKey) ?? false;

  if (!hasPermission) {
    return false;
  }

  // Tier 1 only sees signals for their 20 assets
  if (entitlement.tier === 1) {
    return entitlement.assets.has(ticker);
  }

  return true;
}

/**
 * Fetch and build a map of tier permissions from the database.
 * Key format: "section:tier" -> boolean
 */
export async function getTierPermissions(): Promise<Map<`${GatingSection}:${UserTier}`, boolean>> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from('tier_permissions').select('section, tier, can_view_latest_signal');

    if (error) throw error;

    const map = new Map<string, boolean>();
    (data || []).forEach(row => {
      const key = `${row.section}:${row.tier}`;
      map.set(key, row.can_view_latest_signal);
    });

    return map as Map<`${GatingSection}:${UserTier}`, boolean>;
  } catch (err) {
    console.error('[getTierPermissions] Error:', err);
    // Safe default: block everything for tier 0/1, allow for tier 2/3
    const map = new Map<`${GatingSection}:${UserTier}`, boolean>();
    map.set('asset_page:0', false);
    map.set('asset_page:1', false);
    map.set('asset_page:2', true);
    map.set('asset_page:3', true);
    return map;
  }
}
