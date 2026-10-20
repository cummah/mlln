import { createClient } from '@/lib/supabase/server';

const REVOLUT_API_URL = process.env.REVOLUT_API_URL || 'https://merchant.revolut.com/api';
const REVOLUT_API_KEY = process.env.REVOLUT_API_KEY || '';

/**
 * Background cron job to process pending payments
 * Handles the "closed tab" scenario where users complete payment but don't return
 * Run every hour via Vercel cron
 *
 * Curl example:
 * curl -X POST https://your-domain.com/api/payment/process-pending \
 *   -H "Content-Type: application/json"
 */
async function processPayments() {
  try {
    if (!REVOLUT_API_KEY) {
      console.error('REVOLUT_API_KEY not configured');
      return { success: false, error: 'Payment service not configured' };
    }

    const supabase = await createClient();
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: pendingPayments, error: fetchError } = await supabase
      .from('pending_payments')
      .select('id, user_id, order_id, tier, checked_at')
      .eq('status', 'pending')
      .lt('created_at', fifteenMinutesAgo)
      .or(`checked_at.is.null,checked_at.lt.${new Date(Date.now() - 5 * 60 * 1000).toISOString()}`)
      .limit(50);

    if (fetchError) {
      console.error('Failed to fetch pending payments:', fetchError);
      return { success: false, error: 'Database error' };
    }

    let processed = 0;
    let upgraded = 0;
    let failed = 0;

    for (const payment of pendingPayments || []) {
      try {
        const orderResponse = await fetch(`${REVOLUT_API_URL}/orders/${payment.order_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${REVOLUT_API_KEY}`,
            'Content-Type': 'application/json',
            'Revolut-Api-Version': '2024-08-20',
          },
        });

        if (!orderResponse.ok) {
          console.error(`Failed to check order ${payment.order_id}:`, await orderResponse.text());
          await supabase
            .from('pending_payments')
            .update({ checked_at: new Date().toISOString() })
            .eq('id', payment.id);
          continue;
        }

        const orderData = await orderResponse.json();
        const orderStatus = orderData.state || orderData.status;

        await supabase
          .from('pending_payments')
          .update({ checked_at: new Date().toISOString() })
          .eq('id', payment.id);

        if (orderStatus === 'COMPLETED' || orderStatus === 'SETTLED') {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              tier: payment.tier,
              billing_provider: 'revolut',
              billing_customer_id: payment.order_id,
              current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', payment.user_id);

          if (updateError) {
            console.error(`Failed to upgrade user ${payment.user_id}:`, updateError);
            failed++;
          } else {
            await supabase
              .from('pending_payments')
              .update({
                status: 'completed',
                processed_at: new Date().toISOString()
              })
              .eq('id', payment.id);
            upgraded++;
          }
        } else if (orderStatus === 'FAILED' || orderStatus === 'EXPIRED' || orderStatus === 'CANCELLED') {
          await supabase
            .from('pending_payments')
            .update({ status: 'failed' })
            .eq('id', payment.id);
          failed++;
        }

        processed++;
      } catch (err) {
        console.error(`Error processing payment ${payment.order_id}:`, err);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { success: true, processed, upgraded, failed };
  } catch (err) {
    console.error('Background payment processing error:', err);
    return { success: false, error: 'Internal error' };
  }
}

export async function GET() {
  const result = await processPayments();
  return Response.json(result);
}

export async function POST() {
  const result = await processPayments();
  return Response.json(result);
}
