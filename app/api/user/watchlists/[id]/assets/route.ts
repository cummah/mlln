import { createClient } from '@/lib/supabase/server';
import { canSwapAsset } from '@/lib/quotas';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { ticker, position } = await req.json();

    if (!ticker) {
      return Response.json({ error: 'Ticker is required' }, { status: 400 });
    }

    // Verify watchlist belongs to user
    const { data: watchlist, error: watchlistError } = await supabase
      .from('user_watchlists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (watchlistError || !watchlist) {
      return Response.json({ error: 'Watchlist not found' }, { status: 404 });
    }

    // Get user tier for quota checking
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: 'Profile not found' }, { status: 500 });
    }

    // Check asset swap quota
    const quotaCheck = await canSwapAsset(user.id, profile.tier);
    if (!quotaCheck.allowed) {
      return Response.json({ error: quotaCheck.reason || 'Asset swap limit reached' }, { status: 403 });
    }

    // Validate ticker exists and is active
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .select('ticker')
      .eq('ticker', ticker.toUpperCase())
      .eq('is_active', true)
      .single();

    if (assetError || !asset) {
      return Response.json({ error: 'Ticker not found or is inactive' }, { status: 400 });
    }

    // Check asset count (20 asset cap)
    const { count, error: countError } = await supabase
      .from('watchlist_assets')
      .select('*', { count: 'exact' })
      .eq('watchlist_id', id);

    if (countError) throw countError;
    if (count && count >= 20) {
      return Response.json({ error: 'Watchlist has reached the maximum of 20 assets' }, { status: 400 });
    }

    // Add asset to watchlist
    const { data, error } = await supabase
      .from('watchlist_assets')
      .insert([{
        watchlist_id: id,
        ticker: ticker.toUpperCase(),
        position: position || 0
      }])
      .select()
      .single();

    if (error) throw error;

    // Log to audit table for monthly quota tracking
    const { error: auditError } = await supabase
      .from('watchlist_assets_audit')
      .insert([{
        user_id: user.id,
        watchlist_id: id,
        ticker: ticker.toUpperCase(),
        action: 'add',
      }]);

    if (auditError) {
      console.error('Failed to log audit:', auditError);
    }

    // Return remaining swaps this month
    const remainingSwaps = quotaCheck.remaining || 999;
    return Response.json({
      ...data,
      remaining_swaps_this_month: Math.max(0, remainingSwaps - 1),
    });
  } catch (err) {
    console.error('Failed to add asset:', err);
    return Response.json({ error: 'Failed to add asset' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { ticker } = await req.json();

    if (!ticker) {
      return Response.json({ error: 'Ticker is required' }, { status: 400 });
    }

    // Verify watchlist belongs to user
    const { data: watchlist, error: watchlistError } = await supabase
      .from('user_watchlists')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (watchlistError || !watchlist) {
      return Response.json({ error: 'Watchlist not found' }, { status: 404 });
    }

    // Get user tier for quota checking
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: 'Profile not found' }, { status: 500 });
    }

    // Check asset swap quota (removals also count as swaps)
    const quotaCheck = await canSwapAsset(user.id, profile.tier);
    if (!quotaCheck.allowed) {
      return Response.json({ error: quotaCheck.reason || 'Asset swap limit reached' }, { status: 403 });
    }

    const { error } = await supabase
      .from('watchlist_assets')
      .delete()
      .eq('watchlist_id', id)
      .eq('ticker', ticker.toUpperCase());

    if (error) throw error;

    // Log to audit table for monthly quota tracking
    const { error: auditError } = await supabase
      .from('watchlist_assets_audit')
      .insert([{
        user_id: user.id,
        watchlist_id: id,
        ticker: ticker.toUpperCase(),
        action: 'remove',
      }]);

    if (auditError) {
      console.error('Failed to log audit:', auditError);
    }

    // Return remaining swaps this month
    const remainingSwaps = quotaCheck.remaining || 999;
    return Response.json({
      success: true,
      remaining_swaps_this_month: Math.max(0, remainingSwaps - 1),
    });
  } catch (err) {
    console.error('Failed to remove asset:', err);
    return Response.json({ error: 'Failed to remove asset' }, { status: 500 });
  }
}
