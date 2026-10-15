import { NextRequest, NextResponse } from 'next/server';
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

    // Check entitlement for access to the latest period signals
    const entitlement = await getEntitlement();
    const permissions = await getTierPermissions();

    const sectionMap = {
      daily: 'weekly_signals' as const,
      weekly: 'weekly_signals' as const,
      monthly: 'monthly_signals' as const,
    };
    const section = sectionMap[freq];
    const permissionKey = `${section}:${entitlement.tier}` as const;
    const canViewLatest = permissions.get(permissionKey) ?? false;

    if (!canViewLatest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Return the full unmasked feed. The UI will use latestDate + entitlement
    // to determine what to show to the user.
    const feed = await getFeed(freq);
    return NextResponse.json(feed);
  } catch (err) {
    console.error('[unlock/feed] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
