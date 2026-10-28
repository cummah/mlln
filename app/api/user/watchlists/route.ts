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
    const { name, inception_date } = await req.json();

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

    // Check quota
    const { canCreateWatchlist } = await import('@/lib/quotas');
    const quotaCheck = await canCreateWatchlist(user.id, profile.tier);
    if (!quotaCheck.allowed) {
      return Response.json({ error: quotaCheck.reason || 'Watchlist limit reached' }, { status: 403 });
    }

    // Validate inception_date if provided
    if (inception_date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(inception_date)) {
        return Response.json({ error: 'inception_date must be in YYYY-MM-DD format' }, { status: 400 });
      }
      const date = new Date(inception_date + 'T00:00:00Z');
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (date > today) {
        return Response.json({ error: 'inception_date cannot be in the future' }, { status: 400 });
      }
      const sixYearsAgo = new Date(today);
      sixYearsAgo.setUTCFullYear(sixYearsAgo.getUTCFullYear() - 6);
      if (date < sixYearsAgo) {
        return Response.json({ error: 'inception_date cannot be earlier than 6 years ago' }, { status: 400 });
      }
    }

    const insertData: any = { user_id: user.id, name };
    if (inception_date) {
      insertData.inception_date = inception_date;
    }

    const { data, error } = await supabase
      .from('user_watchlists')
      .insert([insertData])
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
