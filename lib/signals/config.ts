// One place for page settings. Change a window or a floor here, nowhere else.

import type { Filters, Freq, Strategy } from './types'

export const ATR_MULTIPLIERS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]

export interface FreqSettings {
  title: string
  unit: string // what one period is called
  baseAmount: number // dollars per base signal, the same baselines as the backtests
  windowDays: number // how far back signals are loaded
  minMult: number // multiplier floor applied on the server
  rowCap: number
  datePresets: { label: string; days: number | null }[]
  hasAtrStops: boolean
  hasAlignment: boolean
  yearFilter: boolean
}

export const FREQ_SETTINGS: Record<Freq, FreqSettings> = {
  daily: {
    title: 'Daily Buy Signals',
    unit: 'day',
    baseAmount: 100,
    windowDays: 84,
    minMult: 4,
    rowCap: 60000,
    datePresets: [{ label: '1D', days: 1 }, { label: '1W', days: 7 }, { label: '4W', days: 28 }, { label: 'All', days: null }],
    hasAtrStops: true,
    hasAlignment: true,
    yearFilter: false,
  },
  weekly: {
    title: 'Weekly Buy Signals',
    unit: 'week',
    baseAmount: 100,
    windowDays: 365,
    minMult: 0,
    rowCap: 60000,
    datePresets: [{ label: '4W', days: 28 }, { label: '13W', days: 91 }, { label: '26W', days: 182 }, { label: 'All', days: null }],
    hasAtrStops: false,
    hasAlignment: false,
    yearFilter: false,
  },
  monthly: {
    title: 'Monthly Buy Signals',
    unit: 'month',
    baseAmount: 433,
    windowDays: 365 * 5,
    minMult: 0,
    rowCap: 60000,
    datePresets: [{ label: '3M', days: 91 }, { label: '6M', days: 182 }, { label: '1Y', days: 365 }, { label: 'All', days: null }],
    hasAtrStops: false,
    hasAlignment: false,
    yearFilter: true,
  },
}

// Full ranges of the sliders. A slider at its full range does not filter, so rows with no value stay visible.
export const RANGES = {
  mult: [0, 6] as [number, number],
  dca: [0, 100] as [number, number],
  factor: [-40, 40] as [number, number],
  vol: [-30, 30] as [number, number],
  mr: [-30, 30] as [number, number],
  atr: [0, 12] as [number, number],
  exit: [0, 9] as [number, number],
}

export const DEFAULT_FILTERS: Filters = {
  search: '',
  sectors: [],
  dateFrom: null,
  year: null,
  mult: RANGES.mult,
  dca: RANGES.dca,
  factor: RANGES.factor,
  vol: RANGES.vol,
  mr: RANGES.mr,
  atr: RANGES.atr,
  status: 'all',
  returns: 'all',
  weeklyAligned: false,
  monthlyAligned: false,
}

export const DEFAULT_STRATEGY: Strategy = {
  mode: 'hold',
  minExit: 2,
  maxExit: RANGES.exit[1],
  nextOpen: false,
  atrIdx: null,
  fee: 0,
}
