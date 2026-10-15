import { NextResponse } from 'next/server'
import { getEntitlement } from '@/lib/entitlements'
import type { Entitlement } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const entitlement = await getEntitlement()

    // Convert Set to array for JSON serialization
    const response: Omit<Entitlement, 'assets'> & { assets: string[] } = {
      tier: entitlement.tier,
      assets: Array.from(entitlement.assets),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[user/entitlement] Error:', err)
    return NextResponse.json({ tier: 0, assets: [] }, { status: 500 })
  }
}
