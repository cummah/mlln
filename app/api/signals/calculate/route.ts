import { calculateAndStoreSignals, getSignal, getSignalHistory } from '@/lib/signals'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { ticker } = await request.json()

    if (!ticker) {
      return NextResponse.json({ error: 'ticker required' }, { status: 400 })
    }

    console.log(`[1] Starting signal calculation for ${ticker}...`)

    console.log(`[2] Fetching price data...`)
    await calculateAndStoreSignals(ticker)
    console.log(`[3] Signal calculation complete`)

    console.log(`[4] Fetching current signal...`)
    const signal = await getSignal(ticker)
    console.log(`[5] Fetching history...`)
    const weeklyHistory = await getSignalHistory(ticker, 'weekly')
    const monthlyHistory = await getSignalHistory(ticker, 'monthly')
    console.log(`[6] All data fetched, returning response`)

    return NextResponse.json(
      {
        success: true,
        ticker,
        currentSignal: signal,
        weeklyHistory: weeklyHistory.length,
        monthlyHistory: monthlyHistory.length,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('Error calculating signals:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
