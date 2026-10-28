import { createClient } from '@/lib/supabase/server';

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
    return Response.json(data);
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

    const { error } = await supabase
      .from('watchlist_assets')
      .delete()
      .eq('watchlist_id', id)
      .eq('ticker', ticker.toUpperCase());

    if (error) throw error;
    return Response.json({ success: true });
  } catch (err) {
    console.error('Failed to remove asset:', err);
    return Response.json({ error: 'Failed to remove asset' }, { status: 500 });
  }
}
