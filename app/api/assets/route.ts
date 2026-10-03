import { getSupabaseClient, fetchAllPages } from '@/lib/supabase';

export async function GET() {
  try {
    const data = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('assets')
        .select('ticker, name')
        .eq('is_active', true)
        .order('ticker')
        .range(from, to)
    );

    return Response.json(data);
  } catch (err) {
    console.error('Error in assets API:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
