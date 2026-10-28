import { getSupabaseClient } from '@/lib/supabase'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')
    const limit = Math.min(Number(searchParams.get('limit')) || 10, 50)

    if (!q || q.length < 1) {
      return Response.json({ tickers: [] })
    }

    const query = q.toUpperCase()
    const { data, error } = await getSupabaseClient()
      .from('assets')
      .select('ticker')
      .eq('is_active', true)
      .or(`ticker.ilike.${query}%,name.ilike.${query}%`)
      .limit(limit)
      .order('ticker')

    if (error) throw error

    return Response.json({
      tickers: ((data as any[]) || []).map(a => a.ticker),
    })
  } catch (err) {
    console.error('Failed to search assets:', err)
    return Response.json({ tickers: [] })
  }
}
