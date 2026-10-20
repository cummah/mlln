import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request, { params }: { params: { id: string } }) {
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
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (watchlistError || !watchlist) {
      return Response.json({ error: 'Watchlist not found' }, { status: 404 });
    }

    // Add asset to watchlist
    const { data, error } = await supabase
      .from('watchlist_assets')
      .insert([{
        watchlist_id: params.id,
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

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
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
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (watchlistError || !watchlist) {
      return Response.json({ error: 'Watchlist not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('watchlist_assets')
      .delete()
      .eq('watchlist_id', params.id)
      .eq('ticker', ticker.toUpperCase());

    if (error) throw error;
    return Response.json({ success: true });
  } catch (err) {
    console.error('Failed to remove asset:', err);
    return Response.json({ error: 'Failed to remove asset' }, { status: 500 });
  }
}
