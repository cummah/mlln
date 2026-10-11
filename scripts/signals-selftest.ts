/**
 * signals-selftest.ts: checks the page calculations against hand-worked numbers. No database.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/signals-selftest.ts
 */
import assert from 'node:assert/strict'
import { applyFilters, cohorts, computeStats, effective, makeSpy } from '../lib/signals/model'
import { DEFAULT_FILTERS, DEFAULT_STRATEGY } from '../lib/signals/config'
import type { SigRow, Strategy, TickerInfo } from '../lib/signals/types'

let passed = 0
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('PASS  ' + name) }
const near = (a: number | null, b: number, eps = 1e-9) => { assert.ok(a !== null && Math.abs(a - b) < eps, `expected ${b}, got ${a}`) }

const row = (o: Partial<SigRow>): SigRow => ({
  i: 0, d: '2026-01-01', m: 1, p: 0, xd: null, xr: null, xn: null, xs: null,
  f: null, v: null, r: null, a: null, wa: null, ma: null, sd: null, sr: null, ...o,
})
const tickers: TickerInfo[] = [
  { ticker: 'AAA', name: 'Alpha Corp', sector: 'Tech', dca: 80, alpha: 1 },
  { ticker: 'BBB', name: 'Beta Inc', sector: 'Energy', dca: null, alpha: null },
]
const sell = (o: Partial<Strategy> = {}): Strategy => ({ ...DEFAULT_STRATEGY, mode: 'sell', ...o })
const noSpy = () => null

test('buy and hold never closes a signal', () => {
  const e = effective(row({ p: 12, xd: '2026-02-01', xr: 5, xs: 4 }), DEFAULT_STRATEGY)
  assert.equal(e.closed, false)
  assert.equal(e.retPct, 12)
})

test('sell mode closes at the exit signal, close or next open', () => {
  const r = row({ p: 12, xd: '2026-02-01', xr: 10, xn: 9, xs: 3 })
  assert.deepEqual(effective(r, sell()), { closed: true, date: '2026-02-01', retPct: 10, reason: 'signal' })
  assert.equal(effective(r, sell({ nextOpen: true })).retPct, 9)
})

test('exit score outside the chosen range leaves the signal open', () => {
  const r = row({ p: 12, xd: '2026-02-01', xr: 10, xs: 3 })
  assert.equal(effective(r, sell({ minExit: 4 })).closed, false)
  assert.equal(effective(r, sell({ maxExit: 2.5 })).closed, false)
})

test('a next open sale that has not opened yet is still open, not guessed', () => {
  const r = row({ p: 7, xd: '2026-02-01', xr: 10, xn: null, xs: 3 })
  const e = effective(r, sell({ nextOpen: true }))
  assert.equal(e.closed, false)
  assert.equal(e.retPct, 7)
})

test('ATR stop wins when it comes first, signal wins when it comes first', () => {
  const stop = { sd: [null, null, '2026-01-20'], sr: [null, null, -5] }
  const early = row({ p: 12, xd: '2026-02-01', xr: 10, xs: 3, ...stop })
  assert.deepEqual(effective(early, sell({ atrIdx: 2 })), { closed: true, date: '2026-01-20', retPct: -5, reason: 'atr' })
  const late = row({ p: 12, xd: '2026-01-10', xr: 10, xs: 3, ...stop })
  assert.equal(effective(late, sell({ atrIdx: 2 })).reason, 'signal')
  assert.equal(effective(early, sell({ atrIdx: 0 })).reason, 'signal') // slot 0 never breached
})

test('SPY benchmark uses the close on or before each date', () => {
  const spy = makeSpy(['2026-01-01', '2026-01-02', '2026-01-05'], [100, 110, 120])
  near(spy('2026-01-02'), (120 / 110 - 1) * 100)
  near(spy('2026-01-03'), (120 / 110 - 1) * 100) // weekend uses Friday
  near(spy('2026-01-05'), 0)
  assert.equal(spy('2025-12-31'), null)
})

test('hold statistics', () => {
  const rows = [row({ d: '2026-01-01', m: 1, p: 20 }), row({ d: '2026-01-05', m: 2, p: 0 }), row({ d: '2026-01-06', m: 1, p: -10 })]
  const s = computeStats(rows, 100, DEFAULT_STRATEGY, noSpy)
  assert.equal(s.count, 3)
  near(s.hold.invested, 400)
  near(s.hold.value, 120 + 200 + 90)
  near(s.hold.returnPct, (410 / 400 - 1) * 100)
  near(s.hold.winRate, (2 / 3) * 100)
  near(s.hold.medianPct, 0)
})

test('signals with no entry price yet are counted as pending, not as zero', () => {
  const rows = [row({ p: 10 }), row({ p: null })]
  const s = computeStats(rows, 100, DEFAULT_STRATEGY, noSpy)
  assert.equal(s.pending, 1)
  assert.equal(s.hold.n, 1)
  near(s.hold.invested, 100)
})

test('sell statistics: minimum capital, ending value and the profit identity', () => {
  // A: buy 100 on Jan 1, sold Jan 10 at +10 percent (proceeds 110). B: buy 200 on Jan 5, still open at 0 percent.
  const A = row({ d: '2026-01-01', m: 1, p: 20, xd: '2026-01-10', xr: 10, xn: 10, xs: 3 })
  const B = row({ d: '2026-01-05', m: 2, p: 0 })
  const s = computeStats([A, B], 100, sell(), noSpy)
  near(s.sell!.minCapital, 300) // balance goes -100, -300, -190
  near(s.sell!.endingValue, 300 + -190 + 200)
  near(s.sell!.returnOnCapital, (10 / 300) * 100)
  near(s.sell!.closedProfit, 10)
  near(s.sell!.openProfit, 0)
  assert.equal(s.sell!.closedCount, 1)
  near(s.sell!.avgHoldDays, 9)
  // identity holds with fees too
  const f = computeStats([A, B], 100, sell({ fee: 5 }), noSpy).sell!
  near(f.endingValue, f.minCapital + f.closedProfit + f.openProfit)
})

test('same-day sale proceeds fund same-day buys', () => {
  const A = row({ d: '2026-01-01', m: 1, p: 0, xd: '2026-01-10', xr: 0, xn: 0, xs: 3 })
  const B = row({ d: '2026-01-10', m: 1, p: 0 })
  const s = computeStats([A, B], 100, sell(), noSpy).sell!
  near(s.minCapital, 100) // not 200
})

test('SPY comparison is like for like: same dollars on the same dates', () => {
  const spy = makeSpy(['2026-01-01', '2026-01-02'], [100, 120]) // SPY is up 20 percent from the first date
  const rows = [row({ d: '2026-01-01', m: 1, p: 30 })]
  const s = computeStats(rows, 100, DEFAULT_STRATEGY, spy)
  near(s.spy.returnPct, 20)
  near(s.spy.deltaPct, 10) // held +30 against SPY +20
  near(s.spy.value, 120)
})

test('sliders at full range keep rows with no value, narrowed sliders drop them', () => {
  const rows = [row({ f: null }), row({ f: 0.1 }), row({ f: -0.3 })]
  assert.equal(applyFilters(rows, tickers, DEFAULT_FILTERS).length, 3)
  assert.equal(applyFilters(rows, tickers, { ...DEFAULT_FILTERS, factor: [0, 40] }).length, 1)
  assert.equal(applyFilters(rows, tickers, { ...DEFAULT_FILTERS, factor: [-40, 20] }).length, 2)
})

test('a narrowed volatility timing slider keeps only actual dips, never no-dip days', () => {
  const rows = [row({ v: 0 }), row({ v: 0.1 }), row({ v: -0.1 }), row({ v: null })]
  assert.equal(applyFilters(rows, tickers, DEFAULT_FILTERS).length, 4)
  const calm = applyFilters(rows, tickers, { ...DEFAULT_FILTERS, vol: [0, 30] })
  assert.deepEqual(calm.map(r => r.v), [0.1]) // the zero (no dip) row is not a calm dip
})

test('search, sector, date, year and alignment filters', () => {
  const rows = [row({ i: 0, d: '2025-03-01' }), row({ i: 1, d: '2026-03-01', wa: 3 })]
  assert.equal(applyFilters(rows, tickers, { ...DEFAULT_FILTERS, search: 'beta' }).length, 1)
  assert.equal(applyFilters(rows, tickers, { ...DEFAULT_FILTERS, sectors: ['Tech'] }).length, 1)
  assert.equal(applyFilters(rows, tickers, { ...DEFAULT_FILTERS, dateFrom: '2026-01-01' }).length, 1)
  assert.equal(applyFilters(rows, tickers, { ...DEFAULT_FILTERS, year: 2025 }).length, 1)
  assert.equal(applyFilters(rows, tickers, { ...DEFAULT_FILTERS, weeklyAligned: true }).length, 1)
})

test('cohorts group by ISO week and keep only the latest periods', () => {
  // 2026-12-28 is in ISO week 53 of 2026, 2027-01-04 is week 1 of 2027: a calendar year boundary
  const rows = [
    row({ d: '2026-12-28', m: 1, p: 10 }), row({ d: '2026-12-29', m: 1, p: 30 }),
    row({ d: '2027-01-04', m: 1, p: -10 }),
  ]
  const c = cohorts(rows, 100, DEFAULT_STRATEGY, 'weekly')
  assert.equal(c.length, 2)
  assert.equal(c[0].signals, 2)
  near(c[0].returnPct, 20)
  near(c[1].returnPct, -10)
  assert.equal(cohorts(rows, 100, DEFAULT_STRATEGY, 'weekly', 1).length, 1)
})

console.log(`\nALL ${passed} CHECKS PASSED`)
