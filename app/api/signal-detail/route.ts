import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

// The indicator values behind one signal, fetched when a row is opened instead of sent with every row.
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const ticker = p.get('ticker')?.toUpperCase()
  const freq = p.get('freq')
  const date = p.get('date')
  if (!ticker || !date || !['daily', 'weekly', 'monthly'].includes(freq ?? '')) {
    return NextResponse.json({ error: 'ticker, freq and date are required' }, { status: 400 })
  }
  const { data, error } = await getSupabaseClient().from('signal_feed').select('*')
    .eq('ticker', ticker).eq('freq', freq!).eq('signal_date', date).limit(1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'signal not found' }, { status: 404 })
  return NextResponse.json(data[0], { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
}
