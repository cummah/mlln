import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('user_watchlists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('Failed to fetch watchlists:', err);
    return Response.json({ error: 'Failed to fetch watchlists' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name } = await req.json();

    if (!name || typeof name !== 'string') {
      return Response.json({ error: 'Name is required' }, { status: 400 });
    }

    // Check user tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.tier === 0) {
      return Response.json({ error: 'Custom watchlists require a paid subscription' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('user_watchlists')
      .insert([{ user_id: user.id, name }])
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (err: any) {
    console.error('Failed to create watchlist:', err);
    if (err.message?.includes('maximum number of watchlists')) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: 'Failed to create watchlist' }, { status: 500 });
  }
}
