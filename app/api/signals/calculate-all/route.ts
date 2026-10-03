import { getSupabaseClient, fetchAllPages } from '@/lib/supabase'
import { calculateAndStoreSignals } from '@/lib/signals'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    console.log('[1] Fetching all active assets...')
    const supabase = getSupabaseClient()
    const assets = await fetchAllPages((from, to) =>
      supabase.from('assets').select('ticker').eq('is_active', true).range(from, to)
    )

    const tickers = assets.map((a: any) => a.ticker)
    console.log(`[2] Found ${tickers.length} active assets`)

    const results = {
      success: 0,
      failed: 0,
      errors: [] as { ticker: string; error: string }[],
    }

    console.log(`[3] Starting signal calculations...`)
    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i]
      try {
        console.log(`[${i + 1}/${tickers.length}] Calculating ${ticker}...`)
        await calculateAndStoreSignals(ticker)
        results.success++
      } catch (err) {
        results.failed++
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        results.errors.push({ ticker, error: errorMsg })
        console.error(`Failed to calculate ${ticker}:`, errorMsg)
      }
    }

    console.log(`[✓] Completed: ${results.success} success, ${results.failed} failed`)

    return NextResponse.json(results, { status: 200 })
  } catch (err) {
    console.error('Error calculating all signals:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
