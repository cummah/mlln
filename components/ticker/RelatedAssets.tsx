import { getSupabaseClient } from '@/lib/supabase'
import { RelatedAssetCard } from './RelatedAssetCard'

interface RelatedAsset {
  ticker: string
  name: string
}

interface RelatedAssetsProps {
  currentTicker: string
  sector?: string
}

export async function RelatedAssets({ currentTicker, sector }: RelatedAssetsProps) {
  try {
    // Fetch related assets from Supabase, preferring same-sector assets
    let query = getSupabaseClient()
      .from('assets')
      .select('ticker, name, sector')
      .neq('ticker', currentTicker.toUpperCase())
      .eq('is_active', true)

    // Filter by sector if provided
    if (sector) {
      query = query.eq('sector', sector)
    }

    const { data: assetsData } = await query.limit(4)

    const assets = assetsData as RelatedAsset[] | null

    if (!assets || assets.length === 0) {
      return null
    }

    return (
      <section style={{ width: '100%' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-3)', marginBottom: '2px' }}>
          Explore other assets
        </div>
        <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>
          Similar DCA backtests
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
          {assets.map((asset) => (
            <RelatedAssetCard key={asset.ticker} ticker={asset.ticker} name={asset.name} />
          ))}
        </div>
      </section>
    )
  } catch (err) {
    console.error('Error fetching related assets:', err)
    return null
  }
}
