import { Metadata } from 'next';
import { getSupabaseClient, fetchAllPages } from '@/lib/supabase';
import { getBacktestSignals } from '@/lib/backtest-signals';
import { getBacktestSummary } from '@/lib/backtest-summary';
import { fetchOHLC } from '@/lib/supabase';
import { WeeklyContent } from './WeeklyContent';

export const metadata: Metadata = {
  title: 'Weekly Signals — All Assets | mlln.ai',
  description: 'View weekly buy signals across all assets with performance metrics and current returns.',
};

export const revalidate = 3600; // ISR: Revalidate every hour

interface SignalRow {
  ticker: string;
  name: string;
  sector: string;
  signalDate: string | null;
  signalMult: number | null;
  invested: number | null;
  performance: number | null;
  currentValue: number | null;
  dcaSuitabilityScore: number | null;
  exitDate: string | null;
  exitReturn: number | null;
  exitScore: number | null;
  exitOpen: boolean;
}

const BASE_AMOUNT = 100;

function getLatestSignal(signals: any[]): any | null {
  if (!signals) return null;
  const validSignals = signals.filter(s => !s.skipped);
  if (validSignals.length === 0) return null;
  return validSignals[validSignals.length - 1];
}

function getPriceAtDate(ohlcData: any[], dateStr: string): number | null {
  if (!ohlcData) return null;
  const found = ohlcData.find(d => d.time === dateStr);
  return found?.close || null;
}

async function getSignalDataForAsset(ticker: string, dcaSuitabilityScore: number | null): Promise<SignalRow> {
  try {
    const [signalData, ohlcData] = await Promise.all([
      getBacktestSignals(ticker, 'weekly'),
      fetchOHLC(ticker, 1825),
    ]);

    const latestSignal = getLatestSignal(signalData?.signals || []);
    const latestPrice = ohlcData && ohlcData.length > 0 ? ohlcData[ohlcData.length - 1].close : null;

    if (!latestSignal || !latestPrice) {
      return {
        ticker,
        name: '',
        sector: '',
        signalDate: null,
        signalMult: null,
        invested: null,
        performance: null,
        currentValue: null,
        dcaSuitabilityScore,
        exitDate: null,
        exitReturn: null,
        exitScore: null,
        exitOpen: true,
      };
    }

    const priceAtSignal = getPriceAtDate(ohlcData, latestSignal.date);
    if (!priceAtSignal) {
      return {
        ticker,
        name: '',
        sector: '',
        signalDate: latestSignal.date,
        signalMult: latestSignal.mult,
        invested: BASE_AMOUNT * latestSignal.mult,
        performance: null,
        currentValue: null,
        dcaSuitabilityScore,
        exitDate: null,
        exitReturn: null,
        exitScore: null,
        exitOpen: true,
      };
    }

    const invested = BASE_AMOUNT * latestSignal.mult;
    const currentValue = invested * (latestPrice / priceAtSignal);
    const performance = ((currentValue - invested) / invested) * 100;

    return {
      ticker,
      name: '',
      sector: '',
      signalDate: latestSignal.date,
      signalMult: latestSignal.mult,
      invested,
      performance,
      currentValue,
      dcaSuitabilityScore,
      exitDate: null,
      exitReturn: null,
      exitScore: null,
      exitOpen: true,
    };
  } catch (err) {
    console.error(`Error fetching signal data for ${ticker}:`, err);
    return {
      ticker,
      name: '',
      sector: '',
      signalDate: null,
      signalMult: null,
      invested: null,
      performance: null,
      currentValue: null,
      dcaSuitabilityScore,
      exitDate: null,
      exitReturn: null,
      exitScore: null,
      exitOpen: true,
    };
  }
}

async function getAllAssets() {
  try {
    const data = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('assets')
        .select('ticker, name, sector')
        .eq('is_active', true)
        .order('ticker')
        .range(from, to)
    );

    return (data as any[]) || [];
  } catch (err) {
    console.error('Error fetching assets:', err);
    return [];
  }
}

async function getAllBacktestSummaries(tickers: string[]): Promise<Map<string, number | null>> {
  try {
    const data = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('backtest_summary')
        .select('ticker, dca_suitability_score')
        .in('ticker', tickers)
        .range(from, to)
    );

    const scoreMap = new Map<string, number | null>();
    data?.forEach((row: any) => {
      scoreMap.set(row.ticker, row.dca_suitability_score || null);
    });

    // Fill in missing tickers with null
    tickers.forEach(ticker => {
      if (!scoreMap.has(ticker)) {
        scoreMap.set(ticker, null);
      }
    });

    return scoreMap;
  } catch (err) {
    console.error('Error fetching backtest summaries:', err);
    return new Map();
  }
}

export default async function WeeklySignalsPage() {
  const assets = await getAllAssets();

  // Batch fetch all backtest summaries first (much faster than one per asset)
  const backtestScores = await getAllBacktestSummaries(assets.map(a => a.ticker.toUpperCase()));

  // Fetch signal data for all assets in parallel
  const signalDataPromises = assets.map(async (asset) => {
    const dcaScore = backtestScores.get(asset.ticker.toUpperCase());
    const signalRow = await getSignalDataForAsset(asset.ticker, dcaScore || null);
    return {
      ...signalRow,
      name: asset.name,
      sector: asset.sector,
    };
  });

  const signalDataRows = await Promise.all(signalDataPromises);

  // Log missing scores for debugging
  const missingScores = signalDataRows.filter(r => r.dcaSuitabilityScore === null).map(r => r.ticker);
  if (missingScores.length > 0) {
    console.warn(`Missing DCA suitability scores for: ${missingScores.join(', ')}`);
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', marginLeft: 'auto', marginRight: 'auto' }}>
      {/* Header */}
      <nav style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        <a href="/sectors" style={{ color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }} className="hover:text-[var(--text)]">
          Assets
        </a>
        <span>›</span>
        <span style={{ color: 'var(--text)' }}>Weekly Signals</span>
      </nav>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)', margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>
          Weekly Buy Signals
        </h1>
      </div>

      <WeeklyContent data={signalDataRows} />
    </div>
  );
}
