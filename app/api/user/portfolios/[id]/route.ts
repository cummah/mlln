import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('user_portfolios')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    if (!data) {
      return Response.json({ error: 'Portfolio not found' }, { status: 404 });
    }

    return Response.json(data);
  } catch (err) {
    console.error('Failed to fetch portfolio:', err);
    return Response.json({ error: 'Failed to fetch portfolio' }, { status: 500 });
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
    const { name, allocation_json } = await req.json();

    const { data, error } = await supabase
      .from('user_portfolios')
      .update({
        name,
        allocation_json,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('Failed to update portfolio:', err);
    return Response.json({ error: 'Failed to update portfolio' }, { status: 500 });
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
      .from('user_portfolios')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return Response.json({ success: true });
  } catch (err) {
    console.error('Failed to delete portfolio:', err);
    return Response.json({ error: 'Failed to delete portfolio' }, { status: 500 });
  }
}
