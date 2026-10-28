import { createClient } from '@/lib/supabase/server';

let revalidateTag: ((tag: string) => void) | null = null;
try {
  const nextCache = require('next/cache');
  revalidateTag = nextCache.revalidateTag;
} catch (e) {
  // revalidateTag may not be available in all contexts
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('user_watchlists')
      .select('*, watchlist_assets(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    if (!data) {
      return Response.json({ error: 'Watchlist not found' }, { status: 404 });
    }

    return Response.json(data);
  } catch (err) {
    console.error('Failed to fetch watchlist:', err);
    return Response.json({ error: 'Failed to fetch watchlist' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, inception_date } = await req.json();

    // Check user tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.tier === 0) {
      return Response.json({ error: 'Custom watchlists require a paid subscription' }, { status: 403 });
    }

    // Validate name if provided
    if (name !== undefined && (!name || typeof name !== 'string')) {
      return Response.json({ error: 'Name must be a non-empty string' }, { status: 400 });
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

    const updateData: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) {
      updateData.name = name;
    }
    if (inception_date) {
      updateData.inception_date = inception_date;
    }

    const { data, error } = await supabase
      .from('user_watchlists')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      if (error.message?.includes('unique')) {
        return Response.json({ error: 'A watchlist with this name already exists' }, { status: 409 });
      }
      throw error;
    }

    if (revalidateTag) {
      revalidateTag(id);
      revalidateTag('user-watchlist');
    }

    return Response.json(data);
  } catch (err) {
    console.error('Failed to update watchlist:', err);
    return Response.json({ error: 'Failed to update watchlist' }, { status: 500 });
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
    const { error } = await supabase
      .from('user_watchlists')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    if (revalidateTag) {
      revalidateTag(id);
      revalidateTag('user-watchlist');
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Failed to delete watchlist:', err);
    return Response.json({ error: 'Failed to delete watchlist' }, { status: 500 });
  }
}
