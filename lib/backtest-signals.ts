import { getSupabaseClient } from './supabase'
import type { Signal, CurrentSignal } from '@/types'

export interface BacktestSignals {
  ticker: string
  signals_5y: any[] | null
  current_signal_5y: any | null
  updated_at: string
}

export async function getBacktestSignals(
  ticker: string,
  frequency: 'weekly' | 'monthly' | 'daily' = 'weekly'
): Promise<{
  signals: Signal[]
  currentSignal: CurrentSignal
} | null> {
  try {
    // For daily frequency, query the daily_signals table; for weekly/monthly, query backtest_signals
    if (frequency === 'daily') {
      const { data: dataRaw, error } = await getSupabaseClient()
        .from('daily_signals')
        .select('signals_1y, current_signal')
        .eq('ticker', ticker.toUpperCase())
        .single()

      if (error || !dataRaw) {
        console.warn(`No cached daily signals for ${ticker}`)
        return null
      }

      const signalsData = (dataRaw as any).signals_1y || []
      const currentSignalData = (dataRaw as any).current_signal

      // Transform debugDCADays to Signal format
      const signals: Signal[] = signalsData.map((d: any) => ({
        date: d.date,
        mult: d.finalMult || 0,
        skipped: d.finalMult === 0,
        buyAmount: 100 * (d.finalMult || 0),
        exitDate: d.exitDate ?? null,
        exitReturn: d.exitReturn ?? null,
        exitScore: d.exitScore ?? null,
        exitOpen: d.exitOpen ?? true,
      }))

      const currentSignal: CurrentSignal = currentSignalData || {
        amount: 0,
        strength: 'neutral',
        mult: 1,
        reasoning: '',
      }

      return {
        signals,
        currentSignal,
      }
    }

    // Weekly/Monthly path
    const { data: dataRaw, error } = await getSupabaseClient()
      .from('backtest_signals')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .single()

    const data = dataRaw as any

    if (error || !data) {
      console.warn(`No cached signals for ${ticker} (${frequency})`)
      return null
    }

    // Extract correct columns based on frequency
    let signalsData: any[] = []
    let currentSignalData: any = null

    if (frequency === 'weekly') {
      signalsData = data.signals_5y_weekly || []
      currentSignalData = data.current_signal_5y_weekly
    } else {
      signalsData = data.signals_5y_monthly || []
      currentSignalData = data.current_signal_5y_monthly
    }

    // Transform debugDCADays to Signal format
    const signals: Signal[] = signalsData.map((d: any) => ({
      date: d.date,
      mult: d.finalMult || 0,
      skipped: d.finalMult === 0,
      buyAmount: (frequency === 'weekly' ? 100 : 433) * (d.finalMult || 0),
      exitDate: d.exitDate ?? null,
      exitReturn: d.exitReturn ?? null,
      exitScore: d.exitScore ?? null,
      exitOpen: d.exitOpen ?? true,
    }))

    const currentSignal: CurrentSignal = currentSignalData || {
      amount: 0,
      strength: 'neutral',
      mult: 1,
      reasoning: '',
    }

    return {
      signals,
      currentSignal,
    }
  } catch (err) {
    console.error('Error fetching cached signals:', err)
    return null
  }
}
