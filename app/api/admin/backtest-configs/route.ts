import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import { loadMany, loadAllBars } from '@/lib/pipeline/bars';
import { attachVix, evaluateAt, isEvaluationBar } from '@/lib/engine/evaluate';
import { FREQ_CONFIG, type EngineConfig, type Bar } from '@/lib/engine/config';

interface ConfigVariant {
  rsiLevel1: number;
  rsiLevel2: number;
  rsiLevel3: number;
  rsiLevel4: number;
  buyPercent1: number;
  buyPercent2: number;
  buyPercent3: number;
  buyPercent4: number;
}

interface Period {
  date: string;
  mult: number;
  entry: number;
}

interface WinResult {
  stdReturn: number | null;
  enhReturn: number | null;
  alpha: number | null;
  stdInvested: number;
  enhInvested: number;
  stdValue: number;
  enhValue: number;
}

const BASE_AMOUNT: Record<'weekly' | 'monthly', number> = { weekly: 100, monthly: 433 };
const WINS = ['1y', '3y', '5y'];

function buildConfig(variant: ConfigVariant, freq: 'weekly' | 'monthly'): EngineConfig {
  const base = FREQ_CONFIG[freq];
  return {
    ...base,
    rsiLevel1: variant.rsiLevel1,
    rsiLevel2: variant.rsiLevel2,
    rsiLevel3: variant.rsiLevel3,
    rsiLevel4: variant.rsiLevel4,
    buyPercent1: variant.buyPercent1,
    buyPercent2: variant.buyPercent2,
    buyPercent3: variant.buyPercent3,
    buyPercent4: variant.buyPercent4,
  };
}

function simulate(bars: Bar[], freq: 'weekly' | 'monthly', cfg: EngineConfig): Period[] {
  const slip = cfg.slippagePct / 100;
  const out: Period[] = [];
  for (let i = 0; i < bars.length - 1; i++) {
    if (!isEvaluationBar(bars, i, freq)) continue;
    const c = evaluateAt(bars, i, cfg);
    if (!c) continue;
    out.push({ date: c.date, mult: c.finalMult, entry: bars[i + 1].open * (1 + slip) });
  }
  return out;
}

function windowStart(last: string, w: string): string {
  const d = new Date(last + 'T12:00:00Z');
  if (w === '1m') d.setUTCMonth(d.getUTCMonth() - 1);
  else if (w === '3m') d.setUTCMonth(d.getUTCMonth() - 3);
  else d.setUTCFullYear(d.getUTCFullYear() - (w === '1y' ? 1 : w === '3y' ? 3 : 5));
  return d.toISOString().slice(0, 10);
}

function aggregate(periods: Period[], base: number, lastClose: number, start: string, toleranceDays: number = 30): WinResult | null {
  if (periods.length === 0) return null;
  const tol = new Date(new Date(start + 'T12:00:00Z').getTime() + toleranceDays * 86400000).toISOString().slice(0, 10);
  if (periods[0].date > tol) return null;
  const inWin = periods.filter(p => p.date >= start);
  if (inWin.length === 0) return null;

  let stdInv = 0, stdSh = 0, enhInv = 0, enhSh = 0, enhN = 0;
  for (const p of inWin) {
    stdInv += base;
    stdSh += base / p.entry;
    if (p.mult > 0) {
      const amt = base * p.mult;
      enhInv += amt;
      enhSh += amt / p.entry;
      enhN++;
    }
  }

  const stdVal = stdSh * lastClose;
  const enhVal = enhSh * lastClose;
  const stdReturn = stdInv > 0 ? ((stdVal - stdInv) / stdInv) * 100 : null;
  const enhReturn = enhInv > 0 ? ((enhVal - enhInv) / enhInv) * 100 : null;
  const alpha = stdReturn !== null && enhReturn !== null ? enhReturn - stdReturn : null;

  return {
    stdReturn,
    enhReturn,
    alpha,
    stdInvested: stdInv,
    enhInvested: enhInv,
    stdValue: stdVal,
    enhValue: enhVal,
  };
}

function getBacktestMetrics(bars: Bar[], freq: 'weekly' | 'monthly', cfg: EngineConfig) {
  const periods = simulate(bars, freq, cfg);
  if (periods.length === 0) return null;

  const lastClose = bars[bars.length - 1].close;
  const results: Record<string, WinResult | null> = {};

  for (const win of WINS) {
    const start = windowStart(bars[bars.length - 1].date, win);
    results[win] = aggregate(periods, BASE_AMOUNT[freq], lastClose, start);
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { configs, testMode } = body;

    if (!configs || typeof configs !== 'object') {
      return NextResponse.json({ error: 'Invalid configs' }, { status: 400 });
    }

    const db = getSupabaseClient();

    // Get ETF list
    let query = db.from('assets').select('ticker, name').eq('asset_type', 'etf').eq('is_active', true);

    if (testMode === 'sample') {
      query = query.limit(5);
    } else {
      query = query.limit(60);
    }

    const { data: etfsData, error: etfError } = await query;
    if (etfError) throw etfError;
    const etfs = etfsData as Array<{ ticker: string; name: string }>;
    if (!etfs || etfs.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Load price data for all ETFs
    const tickers = etfs.map(e => e.ticker);
    const bars = await loadMany(tickers, loadAllBars, 8);

    // Load and attach VIX
    const vix = await loadAllBars('^VIX');
    const vixByDate = new Map(vix.map(b => [b.date, b.close]));
    bars.forEach(b => attachVix(b, vixByDate));

    // Compute results for each ETF and config variant
    const results = [];
    for (const etf of etfs) {
      const etfBars = bars.get(etf.ticker);
      if (!etfBars || etfBars.length === 0) continue;

      const variants: Record<string, any> = {};

      for (const [variantName, variantConfig] of Object.entries(configs)) {
        const config = variantConfig as ConfigVariant;

        // Compute for both weekly and monthly
        const weeklyMetrics = getBacktestMetrics(etfBars, 'weekly', buildConfig(config, 'weekly'));
        const monthlyMetrics = getBacktestMetrics(etfBars, 'monthly', buildConfig(config, 'monthly'));

        if (weeklyMetrics && monthlyMetrics) {
          variants[variantName] = {
            return1y: weeklyMetrics['1y']?.enhReturn ?? 0,
            return3y: weeklyMetrics['3y']?.enhReturn ?? 0,
            return5y: weeklyMetrics['5y']?.enhReturn ?? 0,
            invested1y: weeklyMetrics['1y']?.enhInvested ?? 0,
            invested3y: weeklyMetrics['3y']?.enhInvested ?? 0,
            invested5y: weeklyMetrics['5y']?.enhInvested ?? 0,
            value1y: weeklyMetrics['1y']?.enhValue ?? 0,
            value3y: weeklyMetrics['3y']?.enhValue ?? 0,
            value5y: weeklyMetrics['5y']?.enhValue ?? 0,
            alpha1y: weeklyMetrics['1y']?.alpha ?? 0,
            alpha3y: weeklyMetrics['3y']?.alpha ?? 0,
            alpha5y: weeklyMetrics['5y']?.alpha ?? 0,
          };
        }
      }

      if (Object.keys(variants).length > 0) {
        results.push({
          ticker: etf.ticker,
          name: etf.name,
          variants,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Backtest error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backtest failed' },
      { status: 500 }
    );
  }
}
