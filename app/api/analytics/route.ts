import { createClient } from '@/lib/supabase/server';
import { getSupabaseClient } from '@/lib/supabase';
import { getConsentFromCookie } from '@/lib/consent';
import { checkRateLimit, authRateLimiters } from '@/lib/rate-limit';

const ALLOWED_EVENTS = new Set([
  'signup',
  'activation',
  'upgrade',
  'downgrade',
  'churn',
]);

export async function POST(request: Request) {
  const rateLimitResponse = checkRateLimit(request, authRateLimiters.support);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { event, properties, userId } = body;

    if (!event || typeof event !== 'string') {
      return new Response(JSON.stringify({ error: 'event is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!ALLOWED_EVENTS.has(event)) {
      return new Response(JSON.stringify({ error: 'Unknown event' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient();
    let authUserId: string | undefined;

    if (!userId) {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        authUserId = data.user.id;
      }
    } else {
      authUserId = userId;
    }

    const cookieHeader = request.headers.get('cookie');
    const hasConsent = getConsentFromCookie(cookieHeader);

    if (authUserId || hasConsent) {
      const serviceClient = getSupabaseClient();
      const { error } = await serviceClient.from('analytics_events').insert({
        user_id: authUserId || null,
        event,
        properties: properties || {},
      });

      if (error) {
        console.error('[analytics] Failed to insert event:', error);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 204,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[analytics] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
