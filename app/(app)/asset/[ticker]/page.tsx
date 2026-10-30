import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChartWithControls } from '@/components/ticker/ChartWithControls';
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
import { SignalDataSection } from '@/components/ticker/SignalDataSection';
import { EnhancedDCACTA } from '@/components/ticker/EnhancedDCACTA';
import { sectorToSlug } from '@/lib/sectors';
import { getTickerPageData } from '@/lib/ticker/data';
import { getEntitlement } from '@/lib/entitlements';

// Built once per day. The nightly job asks the site to refresh when it finishes (/api/revalidate).
export const revalidate = 86400;
// The database client asks for uncached reads, which would make Next render this page on every visit and cancel the
// daily cache above. Forcing static rendering keeps it to one build per day, refreshed by /api/revalidate.
export const dynamic = 'force-static';

interface PageProps {
  params: Promise<{
    ticker: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const ticker = (await params).ticker.toUpperCase();
  const domain = process.env.NEXT_PUBLIC_DOMAIN || 'mlln.ai';
  const data = await getTickerPageData(ticker).catch(() => null);
  const s = data?.summary;

  // Numbers in the title only appear when a real five year result exists
  if (!data || !s || !s.available.weekly['5y']) {
    return {
      title: `${ticker} Dollar Cost Averaging Backtest | mlln.ai`,
      description: `Dollar cost averaging backtest for ${ticker}: standard against enhanced DCA, with the buy signal chart.`,
      alternates: { canonical: `https://mlln.ai/asset/${ticker.toLowerCase()}` },
    };
  }

  const enhReturn = Math.round(s.enhReturn5y);
  const alpha = Math.round(s.alpha5y);
  const alphaSigned = `${alpha >= 0 ? '+' : ''}${alpha}%`;
  const comparisonVerb = alpha >= 0 ? 'more than' : 'less than';
  const beatOrTrailed = alpha >= 0 ? 'beat' : 'trailed';
  const enhValue = Math.round(s.enhValue5y);
  const enhInvested = Math.round(s.enhInvested5y);

  return {
    title: `${ticker} Dollar Cost Averaging Backtest — ${enhReturn}% in 5 Years | mlln.ai`,
    description:
      `Dollar cost averaging $100/week into ${ticker} (${s.name}) returned ${enhReturn}% ` +
      `over 5 years with Enhanced DCA — ${Math.abs(alpha)}% ${comparisonVerb} standard DCA. ` +
      `See the full backtest, buy signal chart, and 1Y/3Y/5Y results.`,
    keywords: [
      `dca ${ticker.toLowerCase()}`,
      `dollar cost averaging ${ticker.toLowerCase()}`,
      `${ticker.toLowerCase()} dca backtest`,
      `${ticker.toLowerCase()} dca ${enhReturn} percent`,
      `${s.name.toLowerCase()} dca results`,
      `${s.name.toLowerCase()} dca 5 years`,
      `${ticker.toLowerCase()} dca calculator`,
      `${ticker.toLowerCase()} dca weekly`,
    ],
    openGraph: {
      title: `${ticker} DCA: +${enhReturn}% over 5 years (${alphaSigned} vs standard)`,
      description:
        `$100/week into ${ticker} → $${enhValue.toLocaleString()} in 5 years. ` +
        `Enhanced DCA deployed $${enhInvested.toLocaleString()} and ${beatOrTrailed} ` +
        `standard DCA by ${Math.abs(alpha)}%.`,
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
      description: `Enhanced DCA ${beatOrTrailed} standard by ${Math.abs(alpha)}%. See the full breakdown.`,
      images: [`https://${domain}/api/og/${ticker}`],
    },
    alternates: {
      canonical: `https://mlln.ai/asset/${ticker.toLowerCase()}`,
    },
  };
}

export default async function TickerPage({ params }: PageProps) {
  const ticker = (await params).ticker.toUpperCase();

  // Throws if the data cannot be read, so a database outage is never cached as a page of wrong numbers
  const data = await getTickerPageData(ticker);
  if (!data) notFound();

  const { asset, summary, spyReturn5y, ohlc, weeklySignals, monthlySignals, current, major, universeCount, priceDate } = data;

  // The long form sections quote five year results for both frequencies, so they need both to exist
  const has5y = !!summary && summary.available.weekly['5y'] && summary.available.monthly['5y'];

  // Get user tier for the CTA
  const entitlement = await getEntitlement();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Structured Data for AI/Search engines */}
      {summary && has5y && <StructuredData ticker={ticker} data={summary} spyReturn5y={spyReturn5y} />}

      {/* Main Content */}
      <div className="rs-page" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto' }}>

        {/* Sector Breadcrumb */}
        {asset.sector && (
          <nav style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Link href="/sectors" style={{ color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }} className="hover:text-[var(--text)]">
              Assets
            </Link>
            <span>›</span>
            <Link
              href={`/sectors/${sectorToSlug(asset.sector)}`}
              style={{ color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }}
              className="hover:text-[var(--text)]"
            >
              {asset.sector}
            </Link>
            <span>›</span>
            <span style={{ color: 'var(--text)' }}>{ticker}</span>
          </nav>
        )}

        {/* Header */}
        <AssetHeader
          asset={asset}
          score={summary?.dca_suitability_score}
          updatedAt={summary?.updated_at}
        />

        {/* Sector Card Link */}
        {asset.sector && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>Sector:</span>
            <SectorLink sector={asset.sector} />
          </div>
        )}

        {!summary && (
          <div style={{ fontSize: '13px', color: 'var(--text-2)', padding: '12px 16px', background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '10px' }}>
            {ticker} does not have enough price history for a backtest yet. The chart and live signal below still update every evening.
          </div>
        )}

        {/* Key Findings */}
        {summary && has5y && <KeyFindings ticker={ticker} name={summary.name} data={summary} />}

        {/* Signal Data Section */}
        <SignalDataSection
          ticker={ticker}
          weeklyMajor={major.weekly}
          monthlyMajor={major.monthly}
          currentWeekly={current.weekly}
          currentMonthly={current.monthly}
          universeCount={universeCount}
          dcaSuitabilityScore={summary?.dca_suitability_score ?? null}
          tier={entitlement.tier}
        />

        {/* Custom Backtest Tiles */}
        {summary && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-3)', marginBottom: '2px' }}>
              {summary.name || ticker} DCA Calculator
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>
              Weekly and Monthly DCA Calculator
            </div>

            {/* Settings Bar - Above Tiles */}
            <BacktestSettings />

            <CustomBacktestTiles backtestSummary={summary} />
          </div>
        )}

        {/* Alpha Advantage */}
        {summary && <AlphaBanner backtestSummary={summary} dcaSuitabilityScore={summary.dca_suitability_score} />}

        {/* Backtest Narrative */}
        {summary && has5y && <BacktestNarrative ticker={ticker} name={summary.name} data={summary} sector={asset.sector} spyReturn5y={spyReturn5y} />}

        {/* Chart Section */}
        <div>
          <div style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
                Buying the dips for {summary?.name || asset.name}
              </h2>
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--surface2)', border: '1px solid var(--border)', cursor: 'help' }} title="This chart shows when the model buys. Larger arrows indicate larger purchases near market dips.">
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)' }}>i</span>
              </div>
            </div>
          </div>
          <ChartWithControls
            ticker={ticker}
            ohlc={ohlc}
            weeklySignals={weeklySignals}
            monthlySignals={monthlySignals}
          />
        </div>

        {/* Enhanced DCA CTA - Show if high quality + eDCA wins, OR if low quality asset */}
        {summary && has5y && (
          <EnhancedDCACTA
            ticker={ticker}
            name={summary.name}
            monthlyAlpha5y={summary.monthlyAlpha5y}
            dca_suitability_score={summary.dca_suitability_score}
            tier={entitlement.tier}
          />
        )}

        {/* FAQ Section */}
        {summary && has5y && <FAQSection ticker={ticker} name={summary.name} data={summary} sector={asset.sector} spyReturn5y={spyReturn5y} />}

        {/* How Enhanced DCA Works - Full Width */}
        <div className="rs-pad" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '14px', padding: '24px 28px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: '16px' }}>
            How Enhanced DCA works
          </div>

          <div className="rs-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28d97e" strokeWidth="2.5">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Multiple signals, one smarter decision</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  The buy multiplier is built from several inputs on the signal date: momentum (RSI), distance from the long term average, how far price has fallen from its yearly high, trend direction, and market fear (VIX). Each one scales the buy, so a week with a steep drawdown and elevated fear can produce a much larger buy.
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
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Only what was known at the time</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  Every historical signal is computed from the prices available on its own date and nothing later, so the backtest cannot benefit from hindsight. Buys fill at the next day&apos;s open.
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
                  Standard DCA buys the same amount every period. Enhanced DCA buys more when the model sees a dip and skips periods when it does not, so capital is concentrated at lower prices. The result can be a lower or higher total spend than standard DCA, and both are shown above.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Disclaimer — YMYL requirement */}
        <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: '1.6', padding: '12px 16px', background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '10px', boxShadow: 'var(--shadow-xs)' }}>
          <strong style={{ color: 'var(--text-2)' }}>Risk Disclosure:</strong>{' '}
          Past backtest performance does not guarantee future results. Dollar cost averaging into {summary?.name || asset.name} ({ticker})
          involves investment risk, including potential loss of principal. {ticker} is {asset.sector ? `a ${asset.sector}` : 'an'} {asset.assetType || 'stock'}
          {' '}whose price can fall as well as rise.
          This analysis is for informational purposes only and does not constitute financial advice.
          Always consult a qualified financial advisor before investing.
        </div>

        {/* Related Assets - Internal Linking for Domain Authority */}
        <RelatedAssets currentTicker={ticker} sector={asset.sector} />

        {/* Freshness */}
        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-3)', paddingTop: '32px', paddingBottom: '32px', borderTop: '1px solid var(--border)' }}>
          Prices as of {priceDate ? new Date(priceDate + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'n/a'} close
          {summary?.updated_at && <> · Backtest rebuilt {new Date(summary.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</>}
        </div>
      </div>
    </div>
  );
}
