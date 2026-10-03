import { Metadata } from 'next';
import { getSupabaseClient, fetchAllPages } from '@/lib/supabase';
import { MonthlyContent } from './MonthlyContent';
import { generateMockMonthlySignals } from '@/lib/mock-monthly-signals';

export const metadata: Metadata = {
  title: 'Monthly Signals — All Assets | mlln.ai',
  description: 'View monthly buy signals across all assets with performance metrics and current returns.',
};

export const revalidate = 3600; // ISR: Revalidate every hour

interface SignalRow {
  ticker: string;
  name: string;
  sector: string;
  signalDate: string | null;
  signalMult: number | null;
  invested: number | null;
  // Buy-and-hold (default): marked-to-market against the latest price, ignoring any
  // sell signal — this platform is for DCA/long-term accumulation, not selling.
  performance: number | null;
  currentValue: number | null;
  // Sell-aware (opt-in): reports the realized return for signals that hit a sell signal.
  exitAdjustedPerformance: number | null;
  exitAdjustedValue: number | null;
  dcaSuitabilityScore: number | null;
  fundamentalQualityScore: number | null;
  finalConvictionScore: number | null;
  macroRegimeState: string | null;
  factorRegimeScore: number | null;
  factorRegimeLabel: string | null;
  volTimingScore: number | null;
  volTimingLabel: string | null;
  meanReversionScore: number | null;
  meanReversionLabel: string | null;
  tags: string[] | null;
  exitDate: string | null;
  exitReturn: number | null;
  exitScore: number | null;
  exitDateNextOpen: string | null;
  exitReturnNextOpen: number | null;
  exitOpen: boolean;
  // Ticker-level (not per-signal): how much better/worse this model's dynamic DCA did
  // vs a naive flat-dollar DCA into the same asset over the same 5-year window.
  tickerAlpha5y: number | null;
  // Dashboard: cohort period for monthly grouping
  cohortPeriod: string;
}

const BASE_AMOUNT = 433;
// Per-ticker, not global: a global cap gets exhausted by breadth (many tickers, same
// recent period) rather than depth, leaving no signal old enough to have resolved to a
// sell yet. Monthly signals span up to 5 years of history (the backtest window), so 50
// per ticker is generous headroom — most tickers won't have that many non-skipped months.
// Enforced by scripts/compute-monthly-signal-enrichment.ts, not here.
// Reduced from 50 to 20 to avoid enrichment table fetch timeouts.
const PER_TICKER_SIGNAL_LIMIT = 20;

async function getAllAssets() {
  try {
    const data = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('assets')
        .select('id, ticker, name, sector')
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

async function getAllBacktestSummaries(tickers: string[]): Promise<Map<string, { dcaScore: number | null; alpha5y: number | null }>> {
  try {
    const data = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('backtest_summary')
        .select('ticker, dca_suitability_score, monthly_alpha_5y')
        .in('ticker', tickers)
        .range(from, to)
    );

    const scoreMap = new Map<string, { dcaScore: number | null; alpha5y: number | null }>();
    data?.forEach((row: any) => {
      scoreMap.set(row.ticker, {
        dcaScore: row.dca_suitability_score ?? null,
        alpha5y: row.monthly_alpha_5y ?? null,
      });
    });

    // Fill in missing tickers with nulls
    tickers.forEach(ticker => {
      if (!scoreMap.has(ticker)) {
        scoreMap.set(ticker, { dcaScore: null, alpha5y: null });
      }
    });

    return scoreMap;
  } catch (err) {
    console.error('Error fetching backtest summaries:', err);
    return new Map();
  }
}

function findScoreAtDate(
  history: Map<number, Array<{ snapshot_date: string; fundamental_quality_score: number | null; final_conviction_score: number | null; dca_suitability_score: number | null; macro_regime_state: string | null }>>,
  assetId: number,
  signalDate: string
): { fundamental_quality_score: number | null; final_conviction_score: number | null; dca_suitability_score: number | null; macro_regime_state: string | null } | null {
  const rows = history.get(assetId) ?? [];
  const match = rows.find(r => r.snapshot_date <= signalDate);
  return match || null;
}

async function getAllAssetScoresHistory(): Promise<Map<number, Array<{ snapshot_date: string; fundamental_quality_score: number | null; final_conviction_score: number | null; dca_suitability_score: number | null; macro_regime_state: string | null }>>> {
  try {
    // Bounded to cover PER_TICKER_SIGNAL_LIMIT monthly signals (up to 5 years back) plus
    // buffer — fetching the whole unbounded history table scales with total history, not need.
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 61);
    const data = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('asset_scores_history')
        .select('asset_id, snapshot_date, fundamental_quality_score, final_conviction_score, dca_suitability_score, macro_regime_state')
        .gte('snapshot_date', cutoff.toISOString().split('T')[0])
        .order('snapshot_date', { ascending: false })
        .range(from, to)
    );

    const scoreMap = new Map<number, Array<{ snapshot_date: string; fundamental_quality_score: number | null; final_conviction_score: number | null; dca_suitability_score: number | null; macro_regime_state: string | null }>>();
    data?.forEach((row: any) => {
      if (!scoreMap.has(row.asset_id)) {
        scoreMap.set(row.asset_id, []);
      }
      scoreMap.get(row.asset_id)!.push({
        snapshot_date: row.snapshot_date,
        fundamental_quality_score: row.fundamental_quality_score || null,
        final_conviction_score: row.final_conviction_score || null,
        dca_suitability_score: row.dca_suitability_score || null,
        macro_regime_state: row.macro_regime_state || null,
      });
    });

    return scoreMap;
  } catch (err) {
    console.error('Error fetching asset scores history:', err);
    return new Map();
  }
}

async function getAllAssetTags(): Promise<Map<string, string[] | null>> {
  try {
    const data = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('assets')
        .select('ticker, tags')
        .eq('is_active', true)
        .range(from, to)
    );

    const tagsMap = new Map<string, string[] | null>();
    data?.forEach((row: any) => {
      tagsMap.set(row.ticker, row.tags || null);
    });

    return tagsMap;
  } catch (err) {
    console.error('Error fetching asset tags:', err);
    return new Map();
  }
}

async function getCurrentAssetScores(): Promise<Map<number, { fundamental_quality_score: number | null; final_conviction_score: number | null; macro_regime_state: string | null }>> {
  try {
    // Factor regime / vol timing / mean reversion scores now come from enrichment signals,
    // not from asset_scores (which no longer stores them).
    const data = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('asset_scores')
        .select('asset_id, fundamental_quality_score, final_conviction_score, macro_regime_state')
        .range(from, to)
    );

    const scoreMap = new Map();
    data?.forEach((row: any) => {
      scoreMap.set(row.asset_id, {
        fundamental_quality_score: row.fundamental_quality_score || null,
        final_conviction_score: row.final_conviction_score || null,
        macro_regime_state: row.macro_regime_state || null,
      });
    });

    return scoreMap;
  } catch (err) {
    console.error('Error fetching current asset scores:', err);
    return new Map();
  }
}

async function getAllEnrichment(): Promise<Map<string, any[]>> {
  try {
    // Precomputed by scripts/compute-monthly-signal-enrichment.ts — buy-hold performance
    // and exit fields are already matched per signal. No live OHLC (previously a 5-year,
    // 1825-day fetch per ticker) or backtest_signals blob reads here at all.
    const data = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('monthly_signal_enrichment')
        .select('ticker, signals')
        .range(from, to)
    );

    const enrichmentMap = new Map<string, any[]>();
    data?.forEach((row: any) => enrichmentMap.set(row.ticker.toUpperCase(), row.signals || []));
    return enrichmentMap;
  } catch (err) {
    console.error('Error fetching monthly signal enrichment:', err);
    return new Map();
  }
}

export default async function MonthlySignalsPage() {
  let assets = await getAllAssets();

  // Fallback to mock data if Supabase is unavailable
  if (!assets || assets.length === 0) {
    console.warn('Supabase unavailable, using mock data for demonstration');
    const mockSignals = generateMockMonthlySignals();
    return (
      <div className="min-h-screen bg-[var(--bg)]" style={{ padding: '14px 18px 24px', maxWidth: '1600px', marginLeft: 'auto', marginRight: 'auto' }}>
        <nav style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <a href="/sectors" style={{ color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }} className="hover:text-[var(--text)]">
            Assets
          </a>
          <span>›</span>
          <span style={{ color: 'var(--text)' }}>Monthly Signals</span>
        </nav>
        <div style={{ marginBottom: '12px' }}>
          <h1 style={{ fontSize: '19px', fontWeight: '700', color: 'var(--text)', margin: '0 0 6px 0', letterSpacing: '-0.2px' }}>
            Monthly Buy Signals
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', padding: '12px', background: 'var(--surface)', borderRadius: '8px', marginBottom: '16px' }}>
            ⚠️ Using demo data (Supabase connection unavailable). Refresh when your database is ready.
          </div>
        </div>
        <MonthlyContent data={mockSignals as SignalRow[]} />
      </div>
    );
  }

  // Batch fetch all scores, tags, and precomputed signal enrichment in parallel — no
  // per-ticker network round trips left on this page at all.
  const [backtestScores, scoresHistory, currentScores, assetTags, enrichmentMap] = await Promise.all([
    getAllBacktestSummaries(assets.map(a => a.ticker.toUpperCase())),
    getAllAssetScoresHistory(),
    getCurrentAssetScores(),
    getAllAssetTags(),
    getAllEnrichment(),
  ]);

  const allSignalRows: SignalRow[] = [];

  for (const asset of assets) {
    const tickerUpper = asset.ticker.toUpperCase();
    const summary = backtestScores.get(tickerUpper);
    const tags = assetTags.get(asset.ticker) ?? null;
    const signals = enrichmentMap.get(tickerUpper) || [];

    for (const sig of signals) {
      const invested = BASE_AMOUNT * sig.finalMult;
      const performance = sig.performance ?? null;

      // Buy-and-hold (default): always marked-to-market against the latest price,
      // regardless of whether a sell signal fired — this platform is for DCA/long-term
      // accumulation, so holding through is the baseline, not selling.
      const currentValue = performance !== null ? invested * (1 + performance / 100) : invested;

      let fundamentalQualityScore: number | null = null;
      let finalConvictionScore: number | null = null;
      let macroRegimeState: string | null = null;

      const historicalScores = findScoreAtDate(scoresHistory, asset.id, sig.date);
      if (historicalScores) {
        fundamentalQualityScore = historicalScores.fundamental_quality_score;
        finalConvictionScore = historicalScores.final_conviction_score;
        macroRegimeState = historicalScores.macro_regime_state;
      } else {
        // Fall back to current scores if no historical data
        const current = currentScores.get(asset.id);
        if (current) {
          fundamentalQualityScore = current.fundamental_quality_score;
          finalConvictionScore = current.final_conviction_score;
          macroRegimeState = current.macro_regime_state;
        }
      }

      // Factor regime / vol timing / mean reversion scores are now per-signal from enrichment.
      const factorRegimeScore = sig.factorRegimeScore ?? null;
      const volTimingScore = sig.volTimingScore ?? null;
      const meanReversionScore = sig.meanReversionScore ?? null;

      // Labels are generated from the scores
      const factorRegimeLabel = factorRegimeScore !== null
        ? `${factorRegimeScore >= 0 ? '+' : ''}${(factorRegimeScore * 100).toFixed(1)}%`
        : null;
      const volTimingLabel = volTimingScore !== null
        ? (volTimingScore > 0
          ? `Calm dip, +${(volTimingScore * 100).toFixed(1)}%`
          : volTimingScore < 0
            ? `Elevated dip, ${(volTimingScore * 100).toFixed(1)}%`
            : 'No dip')
        : null;
      const meanReversionLabel = meanReversionScore !== null
        ? `${meanReversionScore >= 0 ? '+' : ''}${(meanReversionScore * 100).toFixed(1)}%`
        : null;

      // Sell-aware (opt-in): reports the realized return for signals that already exited.
      const exitOpen = sig.exitOpen ?? true;
      const exitAdjustedValue = exitOpen
        ? currentValue
        : (sig.exitReturn != null ? invested * (1 + sig.exitReturn / 100) : invested);
      const exitAdjustedPerformance = exitOpen ? performance : (sig.exitReturn ?? null);

      // Cohort period for dashboard stats
      const cohortPeriod = new Date(sig.date).toISOString().slice(0, 7); // YYYY-MM

      allSignalRows.push({
        ticker: asset.ticker,
        name: asset.name,
        sector: asset.sector,
        signalDate: sig.date,
        signalMult: sig.finalMult,
        invested,
        performance,
        currentValue,
        exitAdjustedPerformance,
        exitAdjustedValue,
        dcaSuitabilityScore: summary?.dcaScore ?? null,
        fundamentalQualityScore,
        finalConvictionScore,
        macroRegimeState,
        factorRegimeScore,
        factorRegimeLabel,
        volTimingScore,
        volTimingLabel,
        meanReversionScore,
        meanReversionLabel,
        tags,
        tickerAlpha5y: summary?.alpha5y ?? null,
        exitDate: sig.exitDate ?? null,
        exitReturn: sig.exitReturn ?? null,
        exitScore: sig.exitScore ?? null,
        exitDateNextOpen: sig.exitDateNextOpen ?? null,
        exitReturnNextOpen: sig.exitReturnNextOpen ?? null,
        exitOpen,
        cohortPeriod, // Added for dashboard
      });
    }
  }

  // Sort by date descending; each ticker already capped to PER_TICKER_SIGNAL_LIMIT in the
  // enrichment script, so no further slicing is needed here.
  const signalDataRows = [...allSignalRows]
    .sort((a, b) => new Date(b.signalDate as string).getTime() - new Date(a.signalDate as string).getTime());

  // Log missing scores for debugging
  const missingScores = signalDataRows.filter(r => r.dcaSuitabilityScore === null).map(r => r.ticker);
  if (missingScores.length > 0) {
    console.warn(`Missing DCA suitability scores for: ${missingScores.join(', ')}`);
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]" style={{ padding: '14px 18px 24px', maxWidth: '1600px', marginLeft: 'auto', marginRight: 'auto' }}>
      {/* Header */}
      <nav style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        <a href="/sectors" style={{ color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }} className="hover:text-[var(--text)]">
          Assets
        </a>
        <span>›</span>
        <span style={{ color: 'var(--text)' }}>Monthly Signals</span>
      </nav>

      <div style={{ marginBottom: '12px' }}>
        <h1 style={{ fontSize: '19px', fontWeight: '700', color: 'var(--text)', margin: '0 0 6px 0', letterSpacing: '-0.2px' }}>
          Monthly Buy Signals
        </h1>
      </div>

      <MonthlyContent data={signalDataRows} />
    </div>
  );
}
