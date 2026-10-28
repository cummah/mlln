import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('user_portfolios')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('Failed to fetch portfolios:', err);
    return Response.json({ error: 'Failed to fetch portfolios' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, allocation_json } = await req.json();

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
      return Response.json({ error: 'Custom portfolios require a paid subscription' }, { status: 403 });
    }

    // Check quota
    const { canCreatePortfolio } = await import('@/lib/quotas');
    const quotaCheck = await canCreatePortfolio(user.id, profile.tier);
    if (!quotaCheck.allowed) {
      return Response.json({ error: quotaCheck.reason || 'Portfolio limit reached' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('user_portfolios')
      .insert([{
        user_id: user.id,
        name,
        allocation_json: allocation_json || {}
      }])
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (err: any) {
    console.error('Failed to create portfolio:', err);
    if (err.message?.includes('maximum number of portfolios')) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: 'Failed to create portfolio' }, { status: 500 });
  }
}
