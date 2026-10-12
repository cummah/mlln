import { MetadataRoute } from 'next'
import { getSupabaseClient, fetchAllPages } from '@/lib/supabase'
import { getAllSectors, sectorToSlug } from '@/lib/sectors'

const SITE = 'https://mlln.ai'

// Rebuilt once a day, and straight after the nightly job through the revalidate route
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = getSupabaseClient()

  // Pages change when the nightly job loads a new day, so that day is the honest "last modified" date
  const { data: latest, error: latestError } = await supabase.from('latest_prices').select('price_date').eq('ticker', 'SPY').limit(1)
  if (latestError) throw new Error(`sitemap: ${latestError.message}`)
  const day = (latest as { price_date: string }[] | null)?.[0]?.price_date
  const lastModified = day ? new Date(`${day}T00:00:00Z`) : undefined

  const tickers = await fetchAllPages<{ ticker: string }>((from, to) =>
    supabase.from('assets').select('ticker').eq('is_active', true).order('ticker').range(from, to))
  const sectors = await getAllSectors()

  const page = (path: string, priority: number, changeFrequency: 'daily' | 'weekly'): MetadataRoute.Sitemap[number] =>
    ({ url: `${SITE}${path}`, lastModified, changeFrequency, priority })

  return [
    page('', 1.0, 'daily'),
    page('/asset/daily', 0.9, 'daily'),
    page('/asset/weekly', 0.9, 'daily'),
    page('/asset/monthly', 0.9, 'daily'),
    page('/rank', 0.9, 'daily'),
    page('/sectors', 0.8, 'daily'),
    ...sectors.map(s => page(`/sectors/${sectorToSlug(s)}`, 0.7, 'daily')),
    ...tickers.map(t => page(`/asset/${t.ticker.toLowerCase()}`, t.ticker === 'SPY' ? 1.0 : 0.8, 'daily')),
  ]
}
