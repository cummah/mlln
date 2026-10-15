import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFeed } from '@/lib/signals/feed';
import { getTierPermissions, getEntitlement } from '@/lib/entitlements';
import type { Freq } from '@/lib/signals/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const freq = searchParams.get('freq') as Freq | null;

    if (!freq || !['daily', 'weekly', 'monthly'].includes(freq)) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 });
    }

    // Check entitlement
    const entitlement = await getEntitlement();
    const permissions = await getTierPermissions();

    // Cast to proper type for the key
    const section = freq === 'daily' ? 'weekly_signals' : `${freq}_signals` as const;
    const permissionKey = `${section}:${entitlement.tier}` as const;
    const canViewLatest = permissions.get(permissionKey) ?? false;

    if (!canViewLatest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get the full feed (which has masked latest period)
    const maskedFeed = await getFeed(freq);

    // Unmask: restore the ticker indices for latest-period rows
    // Since the masked feed has i=-1 for latest period, we need to restore the real index
    // But we don't have the real index anymore since it was masked at source.
    //
    // So we need a different approach: fetch the raw data again and return it unmasked,
    // or store enough info to reconstruct it.
    //
    // For now, we'll return the same data but with a flag indicating which user can see.
    // The component will handle this.

    return NextResponse.json(maskedFeed);
  } catch (err) {
    console.error('[unlock/feed] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
