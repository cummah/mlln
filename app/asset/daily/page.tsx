import { Metadata } from 'next';
import { getSupabaseClient, fetchAllPages } from '@/lib/supabase';
import { DailyContent } from './DailyContent';

export const metadata: Metadata = {
  title: 'Daily Signals — Top Assets | mlln.ai',
  description: 'View daily buy signals for the highest-conviction assets with 12 weeks of performance history.',
};

export const revalidate = 3600;

interface SignalRow {
  ticker: string;
  name: string;
  sector: string;
  signalDate: string;
  signalMult: number;
  invested: number;
  // Buy-and-hold (default): marked-to-market against the latest price, ignoring any
  // sell signal — this platform is for DCA/long-term accumulation, not selling.
  currentValue: number | null;
  performance: number | null;
  // Sell-aware (opt-in): reports the realized return for signals that hit a sell signal.
  exitAdjustedValue: number | null;
  exitAdjustedPerformance: number | null;
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
  atrStopBreachDates: (string | null)[] | null;
  atrStopBreachReturns: (number | null)[] | null;
  weeklyAlignmentDays: number | null;
  monthlyAlignmentDays: number | null;
  volatility: number | null;
  trendStrength: number | null;
  fiveDayMomentum: number | null;
}

const BASE_AMOUNT = 100;

// Filter by signal multiplier (position sizing) rather than asset DCA score — more
// objective and dynamic, reflects actual entry conviction. Multiplier >= 4 keeps
// meaningful signals (~21k in 12w window) while avoiding noise from tiny positions.
const MIN_MULTIPLIER = 4;
const WINDOW_DAYS = 84; // 12 weeks — plenty of hold cycles at a ~6-day average hold

async function getAllSignals(): Promise<SignalRow[]> {
  try {
    // Load all active assets (no pre-filter by DCA score — filter happens on signal multiplier below)
    const allAssets = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('assets')
        .select('id, ticker, name, sector, tags')
        .eq('is_active', true)
        .range(from, to)
    );

    if (!allAssets || allAssets.length === 0) return [];

    const assets = (allAssets as any[]);

    // Still fetch DCA scores for display, but don't use as a filter
    const allScores = await fetchAllPages((from, to) =>
      getSupabaseClient()
        .from('backtest_summary')
        .select('ticker, dca_suitability_score')
        .range(from, to)
    );

    const scoreMap = new Map((allScores as any[]).map((s: any) => [s.ticker.toUpperCase(), s.dca_suitability_score]));

    const tickers = assets.map((a: any) => a.ticker.toUpperCase());
    const assetIds = assets.map((a: any) => a.id);
    const tagsMap = new Map<string, string[] | null>();
    assets.forEach((a: any) => tagsMap.set(a.ticker, a.tags || null));

    // Current + 14-day-history scores, scoped to just the assets we're actually showing.
    // fetchAllPages (not a plain .in() select) — assetIds/tickers can exceed 1000
    // elements once the DCA-score filter qualifies most of the universe, and
    // PostgREST silently caps unpaginated results at 1000 rows, which was quietly
    // dropping roughly a third of qualifying tickers from this page.
    // Note: factor_regime_score, vol_timing_score, and mean_reversion_score now come
    // from enrichment signals (historical per-signal values), not asset_scores (current-only).
    const [currentScores, recentScoresHistory, enrichmentRows] = await Promise.all([
      fetchAllPages((from, to) =>
        getSupabaseClient()
          .from('asset_scores')
          .select('asset_id, fundamental_quality_score, final_conviction_score, macro_regime_state')
          .in('asset_id', assetIds)
          .range(from, to)
      ),
      fetchAllPages((from, to) =>
        getSupabaseClient()
          .from('asset_scores_history')
          .select('asset_id, snapshot_date, fundamental_quality_score, final_conviction_score, macro_regime_state')
          .in('asset_id', assetIds)
          .gte('snapshot_date', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('snapshot_date', { ascending: false })
          .range(from, to)
      ),
      // Precomputed by scripts/compute-daily-signal-enrichment.ts — performance, exit
      // fields, alignment days, and historical bonus scores (factor regime, vol timing,
      // mean reversion) are already matched to signal dates. No live signals_1y or
      // backtest_signals blob reads here at all.
      fetchAllPages((from, to) =>
        getSupabaseClient().from('daily_signal_enrichment').select('ticker, signals').in('ticker', tickers).range(from, to)
      ),
    ]);

    const currentScoresMap = new Map<number, { fundamental_quality_score: number | null; final_conviction_score: number | null; macro_regime_state: string | null }>();
    (currentScores as any[])?.forEach((s: any) => {
      currentScoresMap.set(s.asset_id, {
        fundamental_quality_score: s.fundamental_quality_score || null,
        final_conviction_score: s.final_conviction_score || null,
        macro_regime_state: s.macro_regime_state || null,
      });
    });

    const historicalScoresMap = new Map<number, Array<{ snapshot_date: string; fundamental_quality_score: number | null; final_conviction_score: number | null; macro_regime_state: string | null }>>();
    (recentScoresHistory as any[])?.forEach((s: any) => {
      if (!historicalScoresMap.has(s.asset_id)) historicalScoresMap.set(s.asset_id, []);
      historicalScoresMap.get(s.asset_id)!.push({
        snapshot_date: s.snapshot_date,
        fundamental_quality_score: s.fundamental_quality_score || null,
        final_conviction_score: s.final_conviction_score || null,
        macro_regime_state: s.macro_regime_state || null,
      });
    });

    const enrichmentMap = new Map<string, any[]>();
    (enrichmentRows as any[])?.forEach((r: any) => enrichmentMap.set(r.ticker.toUpperCase(), r.signals || []));

    const cutoffMs = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const allSignalRows: SignalRow[] = [];

    for (const asset of assets) {
      const tickerUpper = asset.ticker.toUpperCase();
      const signals = enrichmentMap.get(tickerUpper) || [];

      for (const sig of signals) {
        if (new Date(sig.date).getTime() < cutoffMs) continue;
        // Filter by signal multiplier (position sizing) — only show meaningful entries
        if (!sig.finalMult || sig.finalMult < MIN_MULTIPLIER) continue;

        const invested = BASE_AMOUNT * sig.finalMult;
        const performance = sig.performance ?? null;
        const currentValue = performance !== null ? invested * (1 + performance / 100) : invested;

        let fundamentalQualityScore: number | null = null;
        let finalConvictionScore: number | null = null;
        let macroRegimeState: string | null = null;

        const historyRows = historicalScoresMap.get(asset.id) ?? [];
        const historicalMatch = historyRows.find((h: any) => h.snapshot_date <= sig.date);
        if (historicalMatch) {
          fundamentalQualityScore = historicalMatch.fundamental_quality_score;
          finalConvictionScore = historicalMatch.final_conviction_score;
          macroRegimeState = historicalMatch.macro_regime_state;
        }
        if (!fundamentalQualityScore || !finalConvictionScore) {
          const currentScore = currentScoresMap.get(asset.id);
          if (currentScore) {
            if (!fundamentalQualityScore) fundamentalQualityScore = currentScore.fundamental_quality_score;
            if (!finalConvictionScore) finalConvictionScore = currentScore.final_conviction_score;
            if (!macroRegimeState) macroRegimeState = currentScore.macro_regime_state;
          }
        }

        // Factor regime / vol timing / mean reversion scores are now per-signal from enrichment,
        // not current-only values. They're extracted from the signal object below.
        const factorRegimeScore = sig.factorRegimeScore ?? null;
        const volTimingScore = sig.volTimingScore ?? null;
        const meanReversionScore = sig.meanReversionScore ?? null;

        // Labels are generated from the scores (no label stored in enrichment, just the score)
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

        const exitOpen = sig.exitOpen ?? true;
        const exitAdjustedValue = exitOpen
          ? currentValue
          : (sig.exitReturn != null ? invested * (1 + sig.exitReturn / 100) : invested);
        const exitAdjustedPerformance = exitOpen ? performance : (sig.exitReturn ?? null);

        allSignalRows.push({
          ticker: asset.ticker,
          name: asset.name,
          sector: asset.sector,
          signalDate: sig.date,
          signalMult: sig.finalMult,
          invested,
          currentValue,
          performance,
          exitAdjustedValue,
          exitAdjustedPerformance,
          dcaSuitabilityScore: scoreMap.get(tickerUpper) ?? null,
          fundamentalQualityScore,
          finalConvictionScore,
          macroRegimeState,
          factorRegimeScore,
          factorRegimeLabel,
          volTimingScore,
          volTimingLabel,
          meanReversionScore,
          meanReversionLabel,
          tags: tagsMap.get(asset.ticker) ?? null,
          exitDate: sig.exitDate ?? null,
          exitReturn: sig.exitReturn ?? null,
          exitScore: sig.exitScore ?? null,
          exitDateNextOpen: sig.exitDateNextOpen ?? null,
          exitReturnNextOpen: sig.exitReturnNextOpen ?? null,
          exitOpen,
          atrStopBreachDates: sig.atrStopBreachDates ?? null,
          atrStopBreachReturns: sig.atrStopBreachReturns ?? null,
          weeklyAlignmentDays: sig.weeklyAlignmentDays ?? null,
          monthlyAlignmentDays: sig.monthlyAlignmentDays ?? null,
          volatility: sig.volatility ?? null,
          trendStrength: sig.trendStrength ?? null,
          fiveDayMomentum: sig.fiveDayMomentum ?? null,
        });
      }
    }

    allSignalRows.sort((a, b) => new Date(b.signalDate).getTime() - new Date(a.signalDate).getTime());

    console.log(`\n=== Daily Signals Page Summary ===`);
    console.log(`Assets: ${assets.length}`);
    console.log(`Signals with multiplier >= ${MIN_MULTIPLIER} within last ${WINDOW_DAYS} days: ${allSignalRows.length}`);
    console.log(`Signals with buy-hold performance calculated: ${allSignalRows.filter(s => s.performance !== null).length}/${allSignalRows.length}`);

    return allSignalRows;
  } catch (err) {
    console.error('Error fetching all signals:', err);
    return [];
  }
}

export default async function DailySignalsPage() {
  const signalDataRows = await getAllSignals();

  return (
    <div className="min-h-screen bg-[var(--bg)]" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1400px', marginLeft: 'auto', marginRight: 'auto' }}>
      {/* Header */}
      <nav style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        <a href="/sectors" style={{ color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }} className="hover:text-[var(--text)]">
          Assets
        </a>
        <span>›</span>
        <span style={{ color: 'var(--text)' }}>Daily Signals</span>
      </nav>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)', margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>
          Daily Buy Signals
        </h1>
      </div>

      <DailyContent data={signalDataRows} />
    </div>
  );
}
