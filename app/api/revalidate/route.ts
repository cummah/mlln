import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

// Called by the nightly job after it has written the day's signals. Pages are cached between
// calls, so a visitor never triggers database work, and the new day appears right after the job.
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret || request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }
  revalidatePath('/asset', 'layout')
  revalidatePath('/rank')
  revalidatePath('/sectors', 'layout')
  revalidateTag('sectors')
  return NextResponse.json({ revalidated: true, at: new Date().toISOString() })
}
