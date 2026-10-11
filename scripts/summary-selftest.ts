/**
 * summary-selftest.ts: checks the summary and score calculations against hand-worked numbers. No database.
 * Run: npx ts-node --project tsconfig.scripts.json scripts/summary-selftest.ts
 */
import assert from 'node:assert/strict'
import { aggregate, windowStart, type Period } from '../lib/pipeline/summary'
import { computeScores, type ScoreRow } from '../lib/pipeline/dcaScore'

let n = 0
const test = (name: string, fn: () => void) => { fn(); n++; console.log('PASS  ' + name) }
const near = (a: number | null, b: number, eps = 1e-6) => assert.ok(a !== null && Math.abs(a - b) < eps, `expected ${b}, got ${a}`)

const P: Period[] = [
  { date: '2026-01-05', mult: 2, entry: 10 },
  { date: '2026-01-12', mult: 0, entry: 20 }, // enhanced skips this one
  { date: '2026-01-19', mult: 1, entry: 25 },
]

test('standard and enhanced results, worked by hand', () => {
  const r = aggregate(P, 100, 30, '2026-01-01', 10)!
  // standard: 300 invested, shares 10 + 5 + 4 = 19, value 570, return 90 percent
  near(r.stdInvested, 300); near(r.stdShares, 19); near(r.stdValue, 570); near(r.stdReturn, 90)
  // enhanced: invested 200 + 100, shares 20 + 4 = 24, value 720, return 140 percent
  near(r.enhInvested, 300); near(r.enhShares, 24); near(r.enhValue, 720); near(r.enhReturn, 140)
  near(r.alpha, 50)
  assert.equal(r.stdPurchases, 3); assert.equal(r.enhPurchases, 2); assert.equal(r.skipped, 1)
  near(r.stdAvgEntry, 300 / 19, 0.01); near(r.enhAvgEntry, 12.5)
})

test('only periods inside the window count', () => {
  const r = aggregate(P, 100, 30, '2026-01-15', 10)!
  assert.equal(r.stdPurchases, 1) // only the 19 January period
  near(r.stdInvested, 100)
})

test('a window the history does not reach is null, never a shortened result', () => {
  assert.equal(aggregate(P, 100, 30, '2025-06-01', 10), null) // history starts in January
  assert.ok(aggregate(P, 100, 30, '2026-01-01', 10) !== null)
  assert.equal(aggregate([], 100, 30, '2026-01-01', 10), null)
})

test('window start dates', () => {
  assert.equal(windowStart('2026-10-09', '1m'), '2026-09-09')
  assert.equal(windowStart('2026-10-09', '3m'), '2026-07-09')
  assert.equal(windowStart('2026-10-09', '1y'), '2025-10-09')
  assert.equal(windowStart('2026-10-09', '5y'), '2021-10-09')
})

const row = (o: Partial<ScoreRow>): ScoreRow => ({
  ticker: 'X', alpha_1m: null, alpha_3m: null, alpha_1y: null, alpha_3y: null, alpha_5y: null,
  monthly_alpha_1y: null, monthly_alpha_3y: null, monthly_alpha_5y: null,
  enh_return_1y: null, enh_return_3y: null, enh_return_5y: null,
  enh_avg_entry_5y: null, std_avg_entry_5y: null, enh_value_5y: null, enh_invested_5y: null, std_value_5y: null, std_invested_5y: null, ...o,
})
const strong = (t: string, k: number): ScoreRow => row({
  ticker: t, alpha_1m: 2, alpha_3m: 3, alpha_1y: 5 * k, alpha_3y: 8 * k, alpha_5y: 12 * k,
  monthly_alpha_1y: 4, monthly_alpha_3y: 6, monthly_alpha_5y: 9,
  enh_return_1y: 10 * k, enh_return_3y: 30 * k, enh_return_5y: 60 * k,
  enh_avg_entry_5y: 90, std_avg_entry_5y: 100, enh_value_5y: 1500, enh_invested_5y: 1000, std_value_5y: 1300, std_invested_5y: 1000,
})
const weak = (t: string): ScoreRow => row({
  ticker: t, alpha_1m: -2, alpha_3m: -3, alpha_1y: -5, alpha_3y: -8, alpha_5y: -12,
  monthly_alpha_1y: -4, monthly_alpha_3y: -6, monthly_alpha_5y: -9,
  enh_return_1y: -10, enh_return_3y: -30, enh_return_5y: -60,
  enh_avg_entry_5y: 110, std_avg_entry_5y: 100, enh_value_5y: 400, enh_invested_5y: 1000, std_value_5y: 500, std_invested_5y: 1000,
})

test('a consistently better strategy scores higher than a consistently worse one', () => {
  const s = computeScores([strong('A', 1), strong('B', 2), weak('C')])
  assert.ok(s.get('B')! > s.get('A')!, 'larger alpha ranks higher')
  assert.ok(s.get('A')! > s.get('C')!)
  assert.ok(s.get('C')! <= 25, 'a 60 percent loss caps the score at 25')
})

test('scores stay within 1 to 100 and a ticker with no data still gets a score', () => {
  const s = computeScores([strong('A', 1), row({ ticker: 'E' }), weak('C')])
  for (const v of Array.from(s.values())) assert.ok(v >= 1 && v <= 100)
  assert.equal(s.get('E'), 1)
})

test('loss severity ceiling', () => {
  const mild = { ...strong('M', 1), enh_return_5y: -5 }
  const heavy = { ...strong('H', 1), enh_return_5y: -35 }
  const s = computeScores([mild, heavy, strong('A', 1)])
  assert.ok(s.get('M')! <= 70)
  assert.ok(s.get('H')! <= 40)
})

console.log(`\nALL ${n} CHECKS PASSED`)
