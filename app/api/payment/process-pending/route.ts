import { createClient } from '@/lib/supabase/server';

const REVOLUT_API_URL = process.env.REVOLUT_API_URL || 'https://revolut.com';
const REVOLUT_API_KEY = process.env.REVOLUT_API_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

/**
 * Background cron job to process pending payments
 * Handles the "closed tab" scenario where users complete payment but don't return
 * Run every 5-10 minutes
 *
 * Curl example:
 * curl -X POST https://your-domain.com/api/payment/process-pending \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function POST(req: Request) {
  try {
    // Verify cron authorization
    const authHeader = req.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!REVOLUT_API_KEY) {
      console.error('REVOLUT_API_KEY not configured');
      return Response.json({ error: 'Payment service not configured' }, { status: 500 });
    }

    const supabase = await createClient();

    // Find pending payments older than 15 minutes that haven't been checked recently
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: pendingPayments, error: fetchError } = await supabase
      .from('pending_payments')
      .select('id, user_id, order_id, tier, checked_at')
      .eq('status', 'pending')
      .lt('created_at', fifteenMinutesAgo)
      .or(`checked_at.is.null,checked_at.lt.${new Date(Date.now() - 5 * 60 * 1000).toISOString()}`)
      .limit(50); // Process max 50 at a time to avoid rate limits

    if (fetchError) {
      console.error('Failed to fetch pending payments:', fetchError);
      return Response.json({ error: 'Database error' }, { status: 500 });
    }

    let processed = 0;
    let upgraded = 0;
    let failed = 0;

    // Process each pending payment
    for (const payment of pendingPayments || []) {
      try {
        // Check Revolut order status
        const orderResponse = await fetch(`${REVOLUT_API_URL}/1.0/orders/${payment.order_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${REVOLUT_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (!orderResponse.ok) {
          console.error(`Failed to check order ${payment.order_id}:`, await orderResponse.text());
          // Update checked_at but keep pending
          await supabase
            .from('pending_payments')
            .update({ checked_at: new Date().toISOString() })
            .eq('id', payment.id);
          continue;
        }

        const orderData = await orderResponse.json();
        const orderStatus = orderData.state || orderData.status;

        // Update checked_at
        await supabase
          .from('pending_payments')
          .update({ checked_at: new Date().toISOString() })
          .eq('id', payment.id);

        if (orderStatus === 'COMPLETED' || orderStatus === 'SETTLED') {
          // Upgrade user tier
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
            // Mark as completed
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
          // Mark as failed
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

      // Rate limit: don't hammer Revolut API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return Response.json({
      success: true,
      processed,
      upgraded,
      failed,
      message: `Processed ${processed} pending payments: ${upgraded} upgraded, ${failed} failed`,
    });
  } catch (err) {
    console.error('Background payment processing error:', err);
    return Response.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
