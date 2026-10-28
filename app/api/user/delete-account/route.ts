import { createClient } from '@/lib/supabase/server';
import { trackServerEvent } from '@/lib/analytics';
import { NextResponse } from 'next/server';
import { checkRateLimit, authRateLimiters } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const limitCheck = checkRateLimit(req, authRateLimiters.deleteAccount);
  if (limitCheck) return limitCheck;

  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await trackServerEvent(user.id, 'churn', { reason: 'account_deletion' });

    // Delete user-related data
    await supabase
      .from('profiles')
      .delete()
      .eq('user_id', user.id);

    await supabase
      .from('user_assets')
      .delete()
      .eq('user_id', user.id);

    await supabase
      .from('user_watchlists')
      .delete()
      .eq('user_id', user.id);

    await supabase
      .from('user_portfolios')
      .delete()
      .eq('user_id', user.id);

    // Delete the auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Account deletion error:', deleteError);
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete account' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Account deleted successfully',
    });
  } catch (err) {
    console.error('Account deletion error:', err);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
