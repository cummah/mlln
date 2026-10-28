import { createClient } from '@/lib/supabase/server';
import { trackServerEvent } from '@/lib/analytics';
import crypto from 'crypto';
import { getRateLimiter, checkRateLimit } from '@/lib/rate-limit';

const REVOLUT_WEBHOOK_SECRET = process.env.REVOLUT_WEBHOOK_SECRET || '';
const webhookLimiter = getRateLimiter(60000, 100);

function verifyRevolutSignature(payload: string, signature: string): boolean {
  const hash = crypto
    .createHmac('sha256', REVOLUT_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return hash === signature;
}

export async function POST(req: Request) {
  const rateLimitResponse = checkRateLimit(req, webhookLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const signature = req.headers.get('revolut-signature');
    const body = await req.text();

    if (!signature || !verifyRevolutSignature(body, signature)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload = JSON.parse(body);

    if (payload.event === 'ORDER_COMPLETED') {
      const { data } = payload;
      const { metadata } = data;

      if (!metadata?.tier_id || !metadata?.user_id) {
        return new Response('Missing metadata', { status: 400 });
      }

      const tierMap: Record<string, number> = {
        tier_1: 1,
        tier_2: 2,
        tier_3: 3,
      };

      const tier = tierMap[metadata.tier_id];
      if (tier === undefined) {
        return new Response('Invalid tier', { status: 400 });
      }

      const supabase = await createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          tier,
          billing_provider: 'revolut',
          billing_customer_id: data.id,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', metadata.user_id);

      if (error) {
        console.error('Failed to update tier:', error);
        return new Response('Failed to update tier', { status: 500 });
      }

      await trackServerEvent(metadata.user_id, 'upgrade', {
        tier,
        orderId: data.id,
        provider: 'revolut',
      });

      return new Response('OK', { status: 200 });
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('Internal error', { status: 500 });
  }
}
