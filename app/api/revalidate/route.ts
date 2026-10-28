import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { getRateLimiter, checkRateLimit } from '@/lib/rate-limit'

const revalidateLimiter = getRateLimiter(60000, 10);

// Called by the nightly job after it has written the day's signals. Pages are cached between
// calls, so a visitor never triggers database work, and the new day appears right after the job.
export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request as any, revalidateLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  const secret = process.env.REVALIDATE_SECRET
  if (!secret || request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }
  revalidatePath('/asset', 'layout')
  revalidatePath('/rank', 'page')
  revalidatePath('/portfolio', 'page')
  revalidatePath('/watchlist', 'page')
  revalidatePath('/sectors', 'layout')
  revalidatePath('/sitemap.xml', 'page')
  return NextResponse.json({ revalidated: true, at: new Date().toISOString() })
}
