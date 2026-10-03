import { MetadataRoute } from 'next'
import { getSupabaseClient, fetchAllPages } from '@/lib/supabase'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const assets = await fetchAllPages<{ ticker: string; created_at: string | null }>((from, to) =>
      getSupabaseClient()
        .from('assets')
        .select('ticker, created_at')
        .eq('is_active', true)
        .range(from, to)
    )

    const staticPages: MetadataRoute.Sitemap = [
      {
        url: 'https://mlln.ai',
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 1.0,
      },
      {
        url: 'https://mlln.ai/watchlist',
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.9,
      },
      {
        url: 'https://mlln.ai/portfolio',
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.9,
      },
    ]

    if (!assets || assets.length === 0) {
      return staticPages
    }

    const assetPages = assets.map((asset) => ({
      url: `https://mlln.ai/dashboard/${asset.ticker.toLowerCase()}`,
      lastModified: asset.created_at ? new Date(asset.created_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: asset.ticker === 'SPY' ? 1.0 : 0.8,
    }))

    return [...staticPages, ...assetPages]
  } catch (err) {
    console.error('Error generating sitemap:', err)
    return [
      {
        url: 'https://mlln.ai',
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 1.0,
      },
    ]
  }
}
