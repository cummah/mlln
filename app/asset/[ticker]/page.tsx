import { Metadata } from 'next';
import Link from 'next/link';
import { ChartWithControls } from '@/components/ticker/ChartWithControls';

// Force dynamic rendering to always get fresh data
export const dynamic = 'force-dynamic';
import { AssetHeader } from '@/components/ticker/AssetHeader';
import { BacktestSettings } from '@/components/ticker/BacktestSettings';
import { CustomBacktestTiles } from '@/components/ticker/CustomBacktestTiles';
import { AlphaBanner } from '@/components/ticker/AlphaBanner';
import { StructuredData } from '@/components/ticker/StructuredData';
import { BacktestNarrative } from '@/components/ticker/BacktestNarrative';
import { KeyFindings } from '@/components/ticker/KeyFindings';
import { FAQSection } from '@/components/ticker/FAQSection';
import { RelatedAssets } from '@/components/ticker/RelatedAssets';
import { SectorLink } from '@/components/ticker/SectorLink';
import { fetchOHLC } from '@/lib/supabase';
import { getBacktestSummary, getMacroBacktestSummary } from '@/lib/backtest-summary';
import { getBacktestSignals } from '@/lib/backtest-signals';
import { sectorToSlug } from '@/lib/sectors';
import { SignalDataSection } from '@/components/ticker/SignalDataSection';
import { AssetScoresSection } from '@/components/asset-scores/AssetScoresSection';
import type { AssetData, Signal, CurrentSignal } from '@/types';

interface PageProps {
  params: {
    ticker: string;
  };
}


export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const ticker = params.ticker.toUpperCase();
  const domain = process.env.NEXT_PUBLIC_DOMAIN || 'mlln.ai';

  const backtestData = await getMacroBacktestSummary(ticker);

  if (!backtestData) {
    return {
      title: `${ticker} — Macro-Sector DCA Backtest | mlln.ai`,
      description: `See how Macro-Sector DCA outperformed standard DCA on ${ticker}.`,
    };
  }

  const enhReturn = Math.round(backtestData.enhReturn5y);
  const alpha = Math.round(backtestData.alpha5y);
  const alphaSigned = `${alpha >= 0 ? '+' : ''}${alpha}%`;
  const comparisonVerb = alpha >= 0 ? 'more than' : 'less than';
  const beatOrTrailed = alpha >= 0 ? 'beat' : 'trailed';
  const enhValue = Math.round(backtestData.enhValue5y);
  const enhInvested = Math.round(backtestData.enhInvested5y);

  return {
    title: `${ticker} Dollar Cost Averaging Backtest — ${enhReturn}% in 5 Years | mlln.ai`,
    description:
      `Dollar cost averaging $100/week into ${ticker} (${backtestData.name}) returned ${enhReturn}% ` +
      `over 5 years with Macro-Sector DCA — ${Math.abs(alpha)}% ${comparisonVerb} standard DCA. ` +
      `See the full backtest, buy signal chart, and 1Y/3Y/5Y results.`,
    keywords: [
      `dca ${ticker.toLowerCase()}`,
      `dollar cost averaging ${ticker.toLowerCase()}`,
      `${ticker.toLowerCase()} dca backtest`,
      `${ticker.toLowerCase()} dca ${enhReturn} percent`,
      `${backtestData.name.toLowerCase()} dca results`,
      `${backtestData.name.toLowerCase()} dca 5 years`,
      `${ticker.toLowerCase()} dca calculator`,
      `${ticker.toLowerCase()} dca weekly`,
    ],
    openGraph: {
      title: `${ticker} DCA: +${enhReturn}% over 5 years (${alphaSigned} vs standard)`,
      description:
        `$100/week into ${ticker} → $${enhValue.toLocaleString()} in 5 years. ` +
        `Macro-Sector DCA deployed only $${enhInvested.toLocaleString()} and ${beatOrTrailed} ` +
        `standard DCA by ${Math.abs(alpha)}%.`,
      type: 'website',
      images: [
        {
          url: `https://${domain}/api/og/${ticker}`,
          width: 1200,
          height: 630,
          alt: `${ticker} DCA backtest results — Macro-Sector vs Standard`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${ticker} DCA Backtest: +${enhReturn}% in 5 years`,
      description: `Macro-Sector DCA ${beatOrTrailed} standard by ${Math.abs(alpha)}%. See the full breakdown.`,
      images: [`https://${domain}/api/og/${ticker}`],
    },
    alternates: {
      canonical: `https://mlln.ai/asset/${ticker.toLowerCase()}`,
    },
  };
}

async function fetchAssetData(ticker: string): Promise<AssetData | null> {
  try {
    const host = process.env.VERCEL_URL || `localhost:${process.env.PORT || 3000}`;
    const protocol = process.env.VERCEL_URL ? 'https' : 'http';
    const url = `${protocol}://${host}/api/asset/${ticker}/metrics`;

    const res = await fetch(url, {
      next: { revalidate: 0 }, // No cache, always fresh
    });
    if (!res.ok) {
      console.error(`API error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    return {
      ticker: data.ticker,
      name: data.name,
      sector: data.sector,
      assetType: data.assetType || 'stock',
      price: data.price || 0,
      change1d: data.change1d || 0,
      changePercent1d: data.changePercent1d || 0,

      // Macro metrics
      macroRegime: data.macroRegime,
      convictionScore: data.convictionScore,
      dcaScore: data.dcaScore,
      sectorModifier: data.sectorModifier,
      fundamentalScore: data.fundamentalScore,
      stalenessPenalty: data.stalenessPenalty,

      // Signals
      weeklySignal: data.weeklySignal,
      monthlySignal: data.monthlySignal,
      dailySignal: data.dailySignal,

      // Returns
      returns: data.returns,

      // Macro returns
      macro_return_5y: data.macro_return_5y,
      macro_return_3y: data.macro_return_3y,
      macro_return_1y: data.macro_return_1y,
      macro_invested_5y: data.macro_invested_5y,
      macro_invested_3y: data.macro_invested_3y,
      macro_invested_1y: data.macro_invested_1y,
      macro_buy_count_5y: data.macro_buy_count_5y,
      macro_buy_count_3y: data.macro_buy_count_3y,
      macro_buy_count_1y: data.macro_buy_count_1y,
      alpha_vs_standard_5y: data.alpha_vs_standard_5y,

      // Timestamps
      updatedAt: data.updatedAt,
      computedAt: data.computedAt,
    };
  } catch (err) {
    console.error('Error fetching asset data:', err);
    return null;
  }
}

async function fetchSignalData(ticker: string, frequency: 'weekly' | 'monthly' = 'weekly'): Promise<{ signals: Signal[]; currentSignal: CurrentSignal }> {
  try {
    // 1. Try to load from cached backtest_signals table (instant load)
    const cachedSignals = await getBacktestSignals(ticker, frequency);
    if (cachedSignals) {
      return cachedSignals;
    }

    // 2. Fallback: compute on-the-fly from API
    console.warn(`Signals not cached for ${ticker} (${frequency}), computing from API...`);
    const host = process.env.VERCEL_URL || `localhost:${process.env.PORT || 3000}`;
    const protocol = process.env.VERCEL_URL ? 'https' : 'http';

    const url = `${protocol}://${host}/api/signal/${ticker}?window=5y`;
    const res = await fetch(url, {
      next: { revalidate: 0 }, // No cache, always fresh
    });

    if (!res.ok) {
      throw new Error(`Signal API returned ${res.status}`);
    }

    const data5y = await res.json();
    const baseAmount = frequency === 'weekly' ? 100 : 433;
    const signals: Signal[] = (data5y?.tv?.backtest?.debugDCADays || []).map((d: any) => ({
      date: d.date,
      mult: d.finalMult || 0,
      skipped: d.finalMult === 0,
      buyAmount: baseAmount * (d.finalMult || 0),
    }));

    const currentSignal: CurrentSignal = data5y?.tv?.signal || {
      amount: 0,
      strength: 'neutral',
      mult: 1,
      reasoning: '',
    };

    return {
      signals,
      currentSignal,
    };
  } catch (err) {
    console.error('Error fetching signal data:', err);
    return { signals: [], currentSignal: { amount: 0, strength: 'neutral', mult: 1, reasoning: '' } };
  }
}

async function fetchSpyBenchmarkReturn5y(ticker: string): Promise<number | null> {
  // Avoid an unnecessary self-lookup when the page itself is for SPY
  if (ticker === 'SPY') return null;
  const macro = await getMacroBacktestSummary('SPY');
  if (macro) return macro.stdReturn5y;
  const std = await getBacktestSummary('SPY');
  return std ? std.stdReturn5y : null;
}

export default async function DashboardTickerPage({ params }: PageProps) {
  const ticker = params.ticker.toUpperCase();

  const [assetData, ohlcData, signalData, monthlySignalData, backtestData, enhancedData, spyReturn5y] = await Promise.all([
    fetchAssetData(ticker),
    fetchOHLC(ticker, 1825),
    fetchSignalData(ticker, 'weekly'),
    fetchSignalData(ticker, 'monthly'),
    getMacroBacktestSummary(ticker),
    getBacktestSummary(ticker),
    fetchSpyBenchmarkReturn5y(ticker),
  ]);

  if (!assetData) {
    return (
      <div className="min-h-screen bg-[var(--bg)] p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-2xl font-medium text-[var(--text)]">
              Ticker not found
            </h1>
            <p className="text-[var(--text-2)] mt-2">
              Please check the ticker symbol and try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Structured Data for AI/Search engines — the "Enhanced DCA"/RSI-signal copy in this
          component describes the signal-enhanced model, so it must read enhancedData, not the
          macro-regime summary (which has different purchase counts/returns behind the same label) */}
      {(enhancedData || backtestData) && <StructuredData ticker={ticker} data={(enhancedData ?? backtestData) as any} spyReturn5y={spyReturn5y} />}

      {/* Main Content */}
      <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto' }}>

        {/* Sector Breadcrumb */}
        {assetData?.sector && (
          <nav style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Link href="/sectors" style={{ color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }} className="hover:text-[var(--text)]">
              Assets
            </Link>
            <span>›</span>
            <Link
              href={`/sectors/${sectorToSlug(assetData.sector)}`}
              style={{ color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }}
              className="hover:text-[var(--text)]"
            >
              {assetData.sector}
            </Link>
            <span>›</span>
            <span style={{ color: 'var(--text)' }}>{ticker}</span>
          </nav>
        )}

        {/* Header - DCA Suitability score: prefer the macro backtest summary, fall back to the
            signal-enhanced summary since the macro table's score join misses some tickers */}
        <AssetHeader
          asset={assetData}
          score={backtestData?.dca_suitability_score ?? enhancedData?.dca_suitability_score}
          updatedAt={backtestData?.updated_at ?? enhancedData?.updated_at}
        />

        {/* Sector Card Link */}
        {assetData?.sector && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>Sector:</span>
            <SectorLink sector={assetData.sector} />
          </div>
        )}

        {/* Key Findings - describes "Enhanced DCA" results, so it must use enhancedData */}
        {(enhancedData || backtestData) && (
          <KeyFindings ticker={ticker} name={(enhancedData ?? backtestData)!.name} data={(enhancedData ?? backtestData) as any} />
        )}

        {/* Signal Data Section - Pro Members Signals */}
        <SignalDataSection weeklySignals={signalData.signals} monthlySignals={monthlySignalData.signals} ohlcData={ohlcData} ticker={ticker} />

        {/* Custom Backtest Tiles - Based on user selection */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-3)', marginBottom: '2px' }}>
            {backtestData?.name || ticker} DCA Calculator
          </div>
          <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>
            Weekly and Monthly DCA Calculator
          </div>

          {/* Settings Bar - Above Tiles */}
          <BacktestSettings showModelToggle />

          {/* Tiles - Model toggle switches between signal-enhanced and macro-scaled data */}
          <CustomBacktestTiles isUserAuthenticated={false} ticker={ticker} backtestSummary={enhancedData as any} macroSummary={backtestData as any} />
        </div>

        {/* Alpha Advantage - Alpha Banner */}
        {(enhancedData || backtestData) && (
          <AlphaBanner
            backtestSummary={(enhancedData ?? backtestData) as any}
            macroSummary={backtestData as any}
          />
        )}

        {/* Backtest Narrative - describes signal-enhanced/RSI mechanics, so it must use enhancedData */}
        {(enhancedData || backtestData) && (
          <BacktestNarrative ticker={ticker} name={(enhancedData ?? backtestData)!.name} data={(enhancedData ?? backtestData) as any} sector={assetData?.sector} spyReturn5y={spyReturn5y} />
        )}

        {/* Chart Section */}
        <div>
          <div style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
                Buying the dips for {backtestData?.name || assetData.name}
              </h2>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'help' }} title="This chart shows when to buy at favorable prices. Larger arrows indicate larger purchases near market dips. Our model intelligently times entries to maximize returns.">
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)' }}>i</span>
              </div>
            </div>
          </div>
          <ChartWithControls
            ticker={ticker}
            initialOhlc={ohlcData}
            initialSignals={signalData.signals}
          />
        </div>

        {/* Institutional Scoring Section (app/asset only) - Moved after chart */}
        <AssetScoresSection ticker={ticker} />

        {/* FAQ Section - describes signal-enhanced/RSI mechanics, so it must use enhancedData */}
        {(enhancedData || backtestData) && (
          <FAQSection ticker={ticker} name={(enhancedData ?? backtestData)!.name} data={(enhancedData ?? backtestData) as any} sector={assetData?.sector} spyReturn5y={spyReturn5y} />
        )}

        {/* How Enhanced DCA Works - Full Width */}
        <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '14px', padding: '24px 28px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: '16px' }}>
            How Enhanced DCA works
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28d97e" strokeWidth="2.5">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Multiple signals, one smarter decision</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  The buy multiplier is derived from several concurrent inputs — momentum, trend context, how far price has fallen from its peak (drawdown), and market-wide fear/greed. Each factor adjusts the signal independently, so a week with moderate trend but a steep drawdown and elevated volatility can still produce a significantly scaled-up buy.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c4a7" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>The bigger picture always comes first</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  Before any per-asset signal is applied, a separate macro-level score determines whether conditions are broadly suitable for deployment at all. Strong individual signals in an unfavourable macro environment are attenuated — the strategy distinguishes between an asset being cheap and the environment being right to buy.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(240,161,40,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f0a128" strokeWidth="2.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Same budget, working harder</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  The fixed budget is shaped by two levers: the per-asset composite score (concentrating capital toward high-conviction entries) and the macro deployment multiplier (contracting or expanding overall deployment). The result is a budget that flexes in response to the full picture while never requiring you to contribute more than planned.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Disclaimer — YMYL requirement */}
        {backtestData && (
          <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.6', padding: '12px 16px', background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '10px', boxShadow: 'var(--shadow-xs)' }}>
            <strong style={{ color: 'var(--text-2)' }}>Risk Disclosure:</strong>{' '}
            Past backtest performance does not guarantee future results. Dollar cost averaging into {backtestData.name} ({ticker})
            involves investment risk, including potential loss of principal. {ticker} is a high-volatility {assetData?.sector} {assetData?.assetType || 'stock'}.
            This analysis is for informational purposes only and does not constitute financial advice.
            Always consult a qualified financial advisor before investing.
          </div>
        )}

        {/* Related Assets - Internal Linking for Domain Authority */}
        <RelatedAssets currentTicker={ticker} sector={assetData?.sector} />

        {/* Last Updated - Content Freshness Signal */}
        {backtestData && (
          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-3)', paddingTop: '32px', paddingBottom: '32px', borderTop: '1px solid var(--border)' }}>
            Backtest data updated weekly · Data last updated: {new Date(backtestData.updated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        )}
      </div>
    </div>
  );
}
