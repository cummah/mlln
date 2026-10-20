import { createClient } from '@/lib/supabase/server';

const REVOLUT_API_URL = process.env.REVOLUT_API_URL || 'https://revolut.com';
const REVOLUT_API_KEY = process.env.REVOLUT_API_KEY || '';

export async function POST(req: Request) {
  try {
    const { order_id } = await req.json();

    if (!order_id) {
      return Response.json({ error: 'Order ID is required' }, { status: 400 });
    }

    if (!REVOLUT_API_KEY) {
      console.error('REVOLUT_API_KEY not configured');
      return Response.json({ error: 'Payment verification not available' }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Revolut order status
    const orderResponse = await fetch(`${REVOLUT_API_URL}/1.0/orders/${order_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${REVOLUT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!orderResponse.ok) {
      const error = await orderResponse.text();
      console.error('Revolut order check failed:', error);
      return Response.json(
        { status: 'error', message: 'Could not verify payment status' },
        { status: 400 }
      );
    }

    const orderData = await orderResponse.json();
    const orderStatus = orderData.state || orderData.status; // Revolut might use either field

    // Update pending_payments record with checked_at
    await supabase
      .from('pending_payments')
      .update({ checked_at: new Date().toISOString() })
      .eq('order_id', order_id);

    // If payment is still pending, tell frontend to keep checking
    if (orderStatus === 'PENDING') {
      return Response.json({
        status: 'pending',
        message: 'Payment is being processed',
      });
    }

    // If payment failed or expired, mark as failed
    if (orderStatus === 'FAILED' || orderStatus === 'EXPIRED' || orderStatus === 'CANCELLED') {
      await supabase
        .from('pending_payments')
        .update({ status: 'failed' })
        .eq('order_id', order_id);

      return Response.json(
        {
          status: 'error',
          message: `Payment ${orderStatus.toLowerCase()}. Please try again.`,
        },
        { status: 400 }
      );
    }

    // If payment is completed, upgrade the user
    if (orderStatus === 'COMPLETED' || orderStatus === 'SETTLED') {
      // Get the pending payment record to find the tier
      const { data: pendingPayment } = await supabase
        .from('pending_payments')
        .select('tier')
        .eq('order_id', order_id)
        .eq('user_id', user.id)
        .single();

      if (!pendingPayment) {
        console.error('Pending payment not found for order:', order_id);
        return Response.json(
          { status: 'error', message: 'Payment record not found' },
          { status: 404 }
        );
      }

      const tier = pendingPayment.tier;

      // Update user tier
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          tier,
          billing_provider: 'revolut',
          billing_customer_id: order_id,
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Failed to update user tier:', updateError);
        return Response.json(
          { status: 'error', message: 'Failed to upgrade account' },
          { status: 500 }
        );
      }

      // Mark pending payment as completed
      await supabase
        .from('pending_payments')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('order_id', order_id);

      return Response.json({
        status: 'completed',
        tier,
        message: 'Payment verified and account upgraded!',
      });
    }

    // Unknown status
    return Response.json(
      {
        status: 'error',
        message: `Unknown payment status: ${orderStatus}`,
      },
      { status: 400 }
    );
  } catch (err) {
    console.error('Payment verification error:', err);
    return Response.json(
      { status: 'error', message: 'An error occurred during verification' },
      { status: 500 }
    );
  }
}
