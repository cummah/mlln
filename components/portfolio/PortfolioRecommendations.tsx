'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BacktestSummary } from '@/lib/backtest-summary';
import { Panel, T, MONO } from './ui';

interface RecommendationProps {
  allocations: Array<{ ticker: string; pct: number }>;
  analytics: {
    sectorComposition: Record<string, { allocation: number; tickers: string[] }>;
    assetMetrics: Array<{ ticker: string; return: number }>;
    tickers: string[];
  } | null;
  summaries: Record<string, BacktestSummary>;
  assetOptions: Array<{ ticker: string; name: string }>;
}

interface SectorGap {
  sector: string;
  currentAllocation: number;
  suggestions: Array<{
    ticker: string;
    name: string;
    enhReturn5y: number;
    sector: string;
  }>;
}

const MAJOR_SECTORS = [
  'Technology',
  'Healthcare',
  'Financials',
  'Industrials',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Energy',
  'Materials',
  'Utilities',
  'Real Estate',
  'Communication Services',
];

const SECTOR_PRIORITIES: Record<string, number> = {
  'Healthcare': 1,
  'Financials': 2,
  'Industrials': 3,
  'Utilities': 4,
  'Energy': 5,
  'Materials': 6,
  'Real Estate': 7,
  'Consumer Defensive': 8,
};

function getMissingPrioritySectors(currentSectors: Set<string>): string[] {
  return MAJOR_SECTORS
    .filter(s => !currentSectors.has(s))
    .filter(s => SECTOR_PRIORITIES[s] !== undefined)
    .sort((a, b) => (SECTOR_PRIORITIES[a] ?? 999) - (SECTOR_PRIORITIES[b] ?? 999))
    .slice(0, 3);
}

export function PortfolioRecommendations({
  allocations,
  analytics,
  summaries,
  assetOptions,
}: RecommendationProps) {
  const [allSummaries, setAllSummaries] = useState<Record<string, BacktestSummary>>(() => summaries);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(new Set<string>());

  // Minimal fetching: only fetch if we have very few summaries and haven't tried yet
  useEffect(() => {
    if (!analytics || fetched.size > 0) return; // Only fetch once per mount

    const representedSectors = new Set(Object.keys(analytics.sectorComposition));
    const missingPrioritySectors = getMissingPrioritySectors(representedSectors);

    if (missingPrioritySectors.length === 0) return;

    // Only fetch a small sample: 5 random assets from the pool
    const candidates = assetOptions
      .filter(opt => !allSummaries[opt.ticker])
      .map(opt => opt.ticker)
      .slice(0, 5);

    if (candidates.length === 0) return;

    setLoading(true);
    fetch(`/api/portfolio/summaries?tickers=${candidates.join(',')}`)
      .then(res => (res.ok ? res.json() : []))
      .then((data: BacktestSummary[]) => {
        setAllSummaries(prev => ({ ...prev, ...Object.fromEntries(data.map(s => [s.ticker, s])) }));
      })
      .catch(() => {
        // Silently fail
      })
      .finally(() => {
        const newFetched = new Set(Array.from(fetched));
        candidates.forEach(t => newFetched.add(t));
        setFetched(newFetched);
        setLoading(false);
      });
  }, [analytics]);

  const recommendations = useMemo(() => {
    if (!analytics) return [];

    // Use analytics data to find underrepresented sectors
    const representedSectors = new Set(Object.keys(analytics.sectorComposition));

    // Always show recommendations for missing priority sectors
    // (Healthcare, Financials, Industrials, Utilities, Energy, Materials, Real Estate, etc)
    const missingPrioritySectors = getMissingPrioritySectors(representedSectors);

    if (missingPrioritySectors.length === 0) return [];

    const gaps: SectorGap[] = [];

    for (const sector of missingPrioritySectors.slice(0, 3)) {
      const sectorAssets = assetOptions
        .filter(opt => allSummaries[opt.ticker]?.sector === sector)
        .map(opt => ({
          ticker: opt.ticker,
          name: opt.name,
          enhReturn5y: allSummaries[opt.ticker]?.enhReturn5y ?? 0,
          sector,
        }))
        .filter(a => a.enhReturn5y > 0)
        .sort((a, b) => b.enhReturn5y - a.enhReturn5y)
        .slice(0, 3);

      if (sectorAssets.length > 0) {
        gaps.push({
          sector,
          currentAllocation: analytics.sectorComposition[sector]?.allocation ?? 0,
          suggestions: sectorAssets,
        });
      }
    }

    return gaps;
  }, [allocations, analytics, allSummaries, assetOptions]);

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <Panel
      title="Suggested Additions"
      hint="Top-performing assets from sectors currently underrepresented in your portfolio. Based on 5-year enhanced return."
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        {recommendations.map(gap => (
          <div key={gap.sector} style={{ background: 'var(--surface2)', borderRadius: '6px', padding: '12px' }}>
            <div style={{ fontSize: T.label, fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
              {gap.sector}
            </div>
            <div style={{ display: 'grid', gap: '6px' }}>
              {gap.suggestions.map(asset => (
                <div
                  key={asset.ticker}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    background: 'var(--surface)',
                    borderRadius: '4px',
                    fontSize: T.body,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{asset.ticker}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>{asset.name}</div>
                  </div>
                  <div style={{ fontFamily: MONO, fontWeight: 600, color: 'var(--green)', textAlign: 'right' }}>
                    {asset.enhReturn5y.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: T.label, color: 'var(--text-2)', marginTop: '12px', lineHeight: 1.5 }}>
        These sectors are currently absent from your portfolio. Adding one asset from each underrepresented sector
        can improve diversification and reduce overall portfolio volatility through sector rotation and correlation benefits.
      </p>
    </Panel>
  );
}
