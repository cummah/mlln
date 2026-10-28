import { createClient } from '@/lib/supabase/server';
import { getRateLimiter, checkRateLimit } from '@/lib/rate-limit';

const REVOLUT_API_URL = process.env.REVOLUT_API_URL || 'https://merchant.revolut.com/api';
const REVOLUT_API_KEY = process.env.REVOLUT_API_KEY || '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mlln.ai';

const checkoutLimiter = getRateLimiter(60000, 5);

const TIER_PRICES: Record<number, { amount: number; currency: string; name: string }> = {
  1: { amount: 14400, currency: 'GBP', name: 'Essential' },    // £144/year = 14400 pence
  2: { amount: 34800, currency: 'GBP', name: 'Premium' },      // £348/year = 34800 pence
  3: { amount: 58800, currency: 'GBP', name: 'Pro' },          // £588/year = 58800 pence
};

const TIER_METADATA: Record<number, { id: string; name: string }> = {
  1: { id: 'tier_1', name: 'Essential' },
  2: { id: 'tier_2', name: 'Premium' },
  3: { id: 'tier_3', name: 'Pro' },
};

export async function POST(req: Request) {
  const rateLimitResponse = checkRateLimit(req, checkoutLimiter);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { tier } = await req.json();

    if (!tier || ![1, 2, 3].includes(tier)) {
      return Response.json({ error: 'Invalid tier' }, { status: 400 });
    }

    if (!REVOLUT_API_KEY) {
      console.error('REVOLUT_API_KEY not configured');
      return Response.json({ error: 'Payment not configured' }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tierData = TIER_PRICES[tier];
    const tierMeta = TIER_METADATA[tier];

    // Create order with Revolut API
    const orderResponse = await fetch(`${REVOLUT_API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REVOLUT_API_KEY}`,
        'Content-Type': 'application/json',
        'Revolut-Api-Version': '2024-08-20',
      },
      body: JSON.stringify({
        amount: tierData.amount,
        currency: tierData.currency,
        description: `mlln.ai ${tierData.name} Plan - Annual Subscription`,
        redirect_url: `${SITE_URL}/payment-success`,
        subscription_data: {
          type: 'RECURRING',
        },
        metadata: {
          user_id: user.id,
          tier_id: tierMeta.id,
          tier_name: tierData.name,
          email: user.email,
        },
      }),
    });

    if (!orderResponse.ok) {
      const error = await orderResponse.text();
      console.error('Revolut order creation failed:', {
        status: orderResponse.status,
        statusText: orderResponse.statusText,
        body: error,
        apiUrl: REVOLUT_API_URL,
        hasApiKey: !!REVOLUT_API_KEY
      });
      return Response.json({ error: 'Failed to create checkout order', details: error }, { status: 500 });
    }

    const orderData = await orderResponse.json();
    const orderId = orderData.id;
    const checkoutUrl = orderData.checkout_url;

    if (!orderId || !checkoutUrl) {
      console.error('Invalid order response from Revolut:', orderData);
      return Response.json({ error: 'Invalid checkout response' }, { status: 500 });
    }

    // Save pending payment to database for fail-safe tracking
    const { error: pendingError } = await supabase
      .from('pending_payments')
      .insert([{
        user_id: user.id,
        order_id: orderId,
        tier,
        status: 'pending',
      }]);

    if (pendingError) {
      console.error('Failed to save pending payment:', pendingError);
      // Log but continue - user can still complete checkout
    }

    return Response.json({
      checkoutUrl,
      orderId,
      message: `Redirecting to ${tierData.name} checkout`,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
