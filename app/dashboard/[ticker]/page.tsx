import { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
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
import { getBacktestSummary } from '@/lib/backtest-summary';
import { getBacktestSignals } from '@/lib/backtest-signals';
import { sectorToSlug } from '@/lib/sectors';
import { SignalDataSection } from '@/components/ticker/SignalDataSection';
import type { AssetData, Signal, CurrentSignal } from '@/types';
import type { BacktestData } from '@/lib/signalCalculations';

interface PageProps {
  params: {
    ticker: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const ticker = params.ticker.toUpperCase();
  const domain = process.env.NEXT_PUBLIC_DOMAIN || 'mlln.ai';
  const data = await getBacktestSummary(ticker);

  if (!data) {
    return {
      title: `${ticker} — Enhanced DCA Backtest | mlln.ai`,
      description: `See how Enhanced DCA outperformed standard DCA on ${ticker} with intelligent buying signals.`,
    };
  }

  const enhReturn = Math.round(data.enhReturn5y);
  const alpha = Math.round(data.alpha5y);
  const enhValue = Math.round(data.enhValue5y);
  const enhInvested = Math.round(data.enhInvested5y);

  return {
    title: `${ticker} Dollar Cost Averaging Backtest — ${enhReturn}% in 5 Years | mlln.ai`,
    description:
      `Dollar cost averaging $100/week into ${ticker} (${data.name}) returned ${enhReturn}% ` +
      `over 5 years with Enhanced DCA — ${alpha}% more than standard DCA. ` +
      `See the full backtest, buy signal chart, and 1Y/3Y/5Y results.`,
    keywords: [
      `dca ${ticker.toLowerCase()}`,
      `dollar cost averaging ${ticker.toLowerCase()}`,
      `${ticker.toLowerCase()} dca backtest`,
      `${ticker.toLowerCase()} dca ${enhReturn} percent`,
      `${data.name.toLowerCase()} dca results`,
      `${data.name.toLowerCase()} dca 5 years`,
      `${ticker.toLowerCase()} dca calculator`,
      `${ticker.toLowerCase()} dca weekly`,
    ],
    openGraph: {
      title: `${ticker} DCA: +${enhReturn}% over 5 years (+${alpha}% vs standard)`,
      description:
        `$100/week into ${ticker} → $${enhValue.toLocaleString()} in 5 years. ` +
        `Enhanced DCA deployed only $${enhInvested.toLocaleString()} and beat ` +
        `standard DCA by ${alpha}%.`,
      type: 'website',
      images: [
        {
          url: `https://${domain}/api/og/${ticker}`,
          width: 1200,
          height: 630,
          alt: `${ticker} DCA backtest results — Enhanced vs Standard`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${ticker} DCA Backtest: +${enhReturn}% in 5 years`,
      description: `Enhanced DCA beat standard by ${alpha}%. See the full breakdown.`,
      images: [`https://${domain}/api/og/${ticker}`],
    },
    alternates: {
      canonical: `https://mlln.ai/dashboard/${ticker.toLowerCase()}`,
    },
  };
}

async function fetchAssetData(ticker: string): Promise<AssetData | null> {
  try {
    const host = process.env.VERCEL_URL || `localhost:${process.env.PORT || 3000}`;
    const protocol = process.env.VERCEL_URL ? 'https' : 'http';
    const url = `${protocol}://${host}/api/dashboard/${ticker}`;

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
      price: data.price || 450,
      change1d: data.change1d || 5.2,
      changePercent1d: data.changePercent1d || 1.17,
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

export default async function DashboardTickerPage({ params }: PageProps) {
  const ticker = params.ticker.toUpperCase();

  const [assetData, ohlcData, signalData, monthlySignalData] = await Promise.all([
    fetchAssetData(ticker),
    fetchOHLC(ticker, 1825),
    fetchSignalData(ticker, 'weekly'),
    fetchSignalData(ticker, 'monthly'),
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

  const backtestData = await getBacktestSummary(ticker);

  // Convert backtestData to BacktestData format for components
  const supabaseBacktestData: BacktestData = backtestData ? {
    stdReturn1y: backtestData.stdReturn1y || 0,
    enhReturn1y: backtestData.enhReturn1y || 0,
    stdInvested1y: backtestData.stdInvested1y || 0,
    enhInvested1y: backtestData.enhInvested1y || 0,
    stdPurchases1y: backtestData.stdPurchases1y || 0,
    enhPurchases1y: backtestData.enhPurchases1y || 0,
    stdReturn3y: backtestData.stdReturn3y || 0,
    enhReturn3y: backtestData.enhReturn3y || 0,
    stdInvested3y: backtestData.stdInvested3y || 0,
    enhInvested3y: backtestData.enhInvested3y || 0,
    stdPurchases3y: backtestData.stdPurchases3y || 0,
    enhPurchases3y: backtestData.enhPurchases3y || 0,
    stdReturn5y: backtestData.stdReturn5y || 0,
    enhReturn5y: backtestData.enhReturn5y || 0,
    stdInvested5y: backtestData.stdInvested5y || 0,
    enhInvested5y: backtestData.enhInvested5y || 0,
    stdPurchases5y: backtestData.stdPurchases5y || 0,
    enhPurchases5y: backtestData.enhPurchases5y || 0,
    alpha1y: backtestData.alpha1y || 0,
    alpha3y: backtestData.alpha3y || 0,
    alpha5y: backtestData.alpha5y || 0,
  } : {
    stdReturn1y: 0, enhReturn1y: 0, stdInvested1y: 0, enhInvested1y: 0, stdPurchases1y: 0, enhPurchases1y: 0,
    stdReturn3y: 0, enhReturn3y: 0, stdInvested3y: 0, enhInvested3y: 0, stdPurchases3y: 0, enhPurchases3y: 0,
    stdReturn5y: 0, enhReturn5y: 0, stdInvested5y: 0, enhInvested5y: 0, stdPurchases5y: 0, enhPurchases5y: 0,
    alpha1y: 0, alpha3y: 0, alpha5y: 0,
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Structured Data for AI/Search engines */}
      {backtestData && <StructuredData ticker={ticker} data={backtestData} />}

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

        {/* Header */}
        <AssetHeader asset={assetData} score={backtestData?.dca_suitability_score} updatedAt={backtestData?.updated_at} />

        {/* Sector Card Link */}
        {assetData?.sector && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>Sector:</span>
            <SectorLink sector={assetData.sector} />
          </div>
        )}

        {/* TLDR Summary Block */}
        {backtestData && (
          <section aria-label="TLDR" style={{
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-elevated)',
            borderRadius: '14px',
            padding: '24px 28px',
            boxShadow: 'var(--inset-top), var(--shadow-md)'
          }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0', color: 'var(--text)' }}>
              TLDR
            </h2>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-2)', fontSize: '14px', lineHeight: '1.7', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li>
                {ticker} Enhanced DCA returned {Math.round(backtestData.enhReturn5y)}% over 5 years versus {Math.round(backtestData.stdReturn5y)}% for standard DCA
              </li>
              <li>
                Enhanced DCA deployed ${Math.round(backtestData.enhInvested5y).toLocaleString()} across {Math.round(backtestData.enhPurchases5y)} targeted purchases, versus {Math.round(backtestData.stdPurchases5y)} purchases for standard DCA
              </li>
              <li>
                Average entry price with Enhanced DCA was ${Math.round(backtestData.enhAvgEntry5y)} versus ${Math.round(backtestData.stdAvgEntry5y)} with standard DCA
              </li>
              <li>
                Over the same 5-year period, the S&P 500 returned approximately 65% — {ticker} Enhanced DCA outperformed by {Math.round(backtestData.enhReturn5y - 65)}%
              </li>
            </ul>
          </section>
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
          <BacktestSettings />

          {/* Tiles */}
          <CustomBacktestTiles isUserAuthenticated={false} backtestSummary={backtestData ?? undefined} backtestData={supabaseBacktestData} />
        </div>

        {/* Alpha Advantage - Alpha Banner */}
        {backtestData && <AlphaBanner backtestSummary={backtestData} />}

        {/* Backtest Narrative - SEO Content */}
        {backtestData && (
          <BacktestNarrative ticker={ticker} name={backtestData.name} data={backtestData} />
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

        {/* Key Findings - Server-rendered static content for AI crawlers */}
        {backtestData && (
          <KeyFindings ticker={ticker} name={backtestData.name} data={backtestData} />
        )}

        {/* FAQ Section - SEO Content */}
        {backtestData && (
          <FAQSection ticker={ticker} name={backtestData.name} data={backtestData} />
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
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Buy more at dips</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  When RSI &lt; 40, the algorithm scales up your buy by up to 3× – concentrating capital at oversold prices.
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
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Skip overbought weeks</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  When RSI &gt; 70, buys are reduced or skipped – preserving cash for better opportunities.
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
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Same base budget</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  Returns improve through timing, not more money – same budget, better entries.
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
            involves investment risk, including potential loss of principal. {ticker} is a high-volatility technology stock.
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
