import { createClient } from '@/lib/supabase/server';

const REVOLUT_API_URL = 'https://api.revolut.com/1.0';
const REVOLUT_API_KEY = process.env.REVOLUT_API_KEY || '';

const TIER_URLS: Record<number, string> = {
  1: 'https://checkout.revolut.com/subscription/f92bd163-11be-478a-b099-0f3e9f79f1f6',
  2: 'https://checkout.revolut.com/subscription/f26a5883-3dab-4dce-917f-293d55667f32',
  3: 'https://checkout.revolut.com/subscription/4b2a1e27-98d4-4f4d-98b1-0b6cb9888c4e',
};

const TIER_METADATA: Record<number, { id: string; name: string }> = {
  1: { id: 'tier_1', name: 'Essential' },
  2: { id: 'tier_2', name: 'Premium' },
  3: { id: 'tier_3', name: 'Pro' },
};

export async function POST(req: Request) {
  try {
    const { tier } = await req.json();

    if (!tier || ![1, 2, 3].includes(tier)) {
      return Response.json({ error: 'Invalid tier' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tierMeta = TIER_METADATA[tier];
    const checkoutUrl = TIER_URLS[tier];

    // Create order with Revolut API
    const orderResponse = await fetch(`${REVOLUT_API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REVOLUT_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 100, // Placeholder, actual price is on Revolut's checkout
        currency: 'GBP',
        metadata: {
          tier_id: tierMeta.id,
          user_id: user.id,
        },
      }),
    });

    if (!orderResponse.ok) {
      const error = await orderResponse.text();
      console.error('Revolut API error:', error);
      return Response.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Return the pre-configured checkout URL with user context
    // User ID will be in the webhook metadata
    return Response.json({
      checkoutUrl,
      message: `Redirecting to ${tierMeta.name} checkout`
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
