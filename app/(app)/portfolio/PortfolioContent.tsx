'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency } from '@/lib/formatters';
import { aggregatePortfolio, type Frequency } from '@/lib/portfolio-aggregate';
import type { BacktestSummary } from '@/lib/backtest-summary';
import type { Period } from '@/types';
import { SectorCompositionChart } from '@/components/portfolio/SectorCompositionChart';
import { CorrelationHeatmap } from '@/components/portfolio/CorrelationHeatmap';
import { RiskDecompositionChart } from '@/components/portfolio/RiskDecompositionChart';
import { AssetContributionTable } from '@/components/portfolio/AssetContributionTable';
import { PortfolioPerformanceSection } from '@/components/portfolio/PortfolioPerformanceSection';
import { PortfolioRecommendations } from '@/components/portfolio/PortfolioRecommendations';
import { EdgeCTATile } from '@/components/portfolio/EdgeCTATile';
import { Panel, Skeleton, T, MONO, RADIUS, tickerColors } from '@/components/portfolio/ui';
import { createClient } from '@/lib/supabase/browser';
import SavePortfolioModal from '@/components/portfolio/SavePortfolioModal';
import CreateWatchlistModal from '@/components/portfolio/CreateWatchlistModal';

const MAX_ASSETS = 20;
const PERIODS: Period[] = ['1y', '3y', '5y'];
const FREQUENCIES: Frequency[] = ['weekly', 'monthly'];
const ANALYTICS_DEBOUNCE_MS = 400;
const ANALYTICS_PERIOD: Period = '5y';

interface AssetOption {
  ticker: string;
  name: string;
}

interface Allocation {
  ticker: string;
  pct: number;
}

interface AnalyticsData {
  correlationMatrix: number[][];
  portfolioMetrics: { expectedReturn: number; volatility: number; sharpeRatio: number; maxDrawdown: number };
  assetMetrics: Array<{ ticker: string; return: number; volatility: number; sharpeRatio: number; contribution: number }>;
  efficientFrontier: Array<{ volatility: number; return: number; sharpeRatio: number }>;
  sectorComposition: Record<string, { allocation: number; tickers: string[] }>;
  lookbackYears: number;
  missingTickers: string[];
  alignedObservations: number;
  windowStart: string | null;
  windowEnd: string | null;
  tickers: string[];
}

/** Whole-percent split that always sums to exactly 100. */
function equalSplit(tickers: string[]): Allocation[] {
  if (tickers.length === 0) return [];
  const base = Math.floor(100 / tickers.length);
  let remainder = 100 - base * tickers.length;
  return tickers.map((ticker) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { ticker, pct: base + extra };
  });
}

/**
 * Rescale existing weights to 100 while preserving their relative sizes. Adding
 * an asset used to insert it at 0%, which broke the 100% total and unmounted
 * every result on the page.
 */
function rebalanceProportionally(allocations: Allocation[]): Allocation[] {
  if (allocations.length === 0) return [];
  const total = allocations.reduce((sum, a) => sum + a.pct, 0);
  if (total <= 0) return equalSplit(allocations.map((a) => a.ticker));

  const scaled = allocations.map((a) => ({ ticker: a.ticker, exact: (a.pct / total) * 100 }));
  const floored = scaled.map((a) => ({ ticker: a.ticker, pct: Math.floor(a.exact), frac: a.exact - Math.floor(a.exact) }));
  let remainder = 100 - floored.reduce((sum, a) => sum + a.pct, 0);
  // Largest-remainder so the displayed integers still total exactly 100.
  const order = [...floored].sort((a, b) => b.frac - a.frac);
  for (const item of order) {
    if (remainder <= 0) break;
    item.pct += 1;
    remainder -= 1;
  }
  const byTicker = new Map(floored.map((a) => [a.ticker, a.pct]));
  return allocations.map((a) => ({ ticker: a.ticker, pct: byTicker.get(a.ticker) ?? 0 }));
}

function parseUrlState(search: string): { allocations: Allocation[]; amount: number | null } | null {
  const params = new URLSearchParams(search);
  const raw = params.get('a');
  if (!raw) return null;
  const allocations: Allocation[] = [];
  for (const part of raw.split(',')) {
    const [ticker, pct] = part.split(':');
    const cleanTicker = (ticker || '').trim().toUpperCase();
    const parsed = Number(pct);
    if (!cleanTicker || !Number.isFinite(parsed)) continue;
    if (allocations.some((a) => a.ticker === cleanTicker)) continue;
    allocations.push({ ticker: cleanTicker, pct: Math.max(0, Math.min(100, parsed)) });
  }
  if (allocations.length === 0) return null;
  const amount = Number(params.get('amt'));
  return { allocations: allocations.slice(0, MAX_ASSETS), amount: Number.isFinite(amount) && amount > 0 ? amount : null };
}

export function PortfolioContent({
  initialTickers,
  initialSummaries,
}: {
  initialTickers: string[];
  initialSummaries: BacktestSummary[];
}) {
  const supabase = createClient();
  const [allocations, setAllocations] = useState<Allocation[]>(() => equalSplit(initialTickers));
  const [summaries, setSummaries] = useState<Record<string, BacktestSummary>>(() =>
    Object.fromEntries(initialSummaries.map((s) => [s.ticker, s]))
  );
  const [totalAmount, setTotalAmount] = useState(1000);
  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([]);
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingTicker, setPendingTicker] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsAttempt, setAnalyticsAttempt] = useState(0);
  const [restored, setRestored] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userTier, setUserTier] = useState(0);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCreateWatchlistModal, setShowCreateWatchlistModal] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = 'portfolio-asset-options';

  useEffect(() => {
    fetch('/api/assets')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAssetOptions(Array.isArray(data) ? data : []))
      .catch(() => setAssetOptions([]));
  }, []);

  // Restore a shared/bookmarked portfolio. Runs after mount so the page can stay
  // statically rendered; previously nothing survived a refresh at all.
  useEffect(() => {
    const parsed = parseUrlState(window.location.search);
    setRestored(true);
    if (!parsed) return;
    if (parsed.amount) setTotalAmount(parsed.amount);
    setAllocations(parsed.allocations);
    const missing = parsed.allocations.map((a) => a.ticker).filter((t) => !initialSummaries.some((s) => s.ticker === t));
    if (missing.length > 0) {
      fetch(`/api/portfolio/summaries?tickers=${missing.join(',')}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data: BacktestSummary[]) => {
          setSummaries((prev) => ({ ...prev, ...Object.fromEntries(data.map((s) => [s.ticker, s])) }));
          const unresolved = missing.filter((t) => !data.some((s) => s.ticker === t));
          if (unresolved.length > 0) {
            setAllocations((prev) => rebalanceProportionally(prev.filter((a) => !unresolved.includes(a.ticker))));
            setError(`No backtest data for ${unresolved.join(', ')} — removed from the shared portfolio.`);
          }
        })
        .catch(() => setError("Couldn't load every asset from the shared link."));
    }
    // Intentionally mount-only: this is URL restore, not a sync loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTickers = useMemo(() => new Set(allocations.map((a) => a.ticker)), [allocations]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return assetOptions
      .filter((a) => !selectedTickers.has(a.ticker.toUpperCase()) && (a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [query, assetOptions, selectedTickers]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Check if user is authenticated and get tier
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);

      if (user) {
        try {
          const res = await fetch('/api/user/entitlement');
          if (res.ok) {
            const data = await res.json();
            setUserTier(data.tier || 0);
          }
        } catch (err) {
          console.error('Failed to fetch user tier:', err);
        }
      }
    };
    checkAuth();
  }, [supabase]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTicker = useCallback(
    async (rawTicker: string) => {
      const ticker = rawTicker.trim().toUpperCase();
      if (!ticker || selectedTickers.has(ticker) || allocations.length >= MAX_ASSETS) return;
      setError(null);

      if (!summaries[ticker]) {
        setPendingTicker(ticker);
        try {
          const res = await fetch(`/api/portfolio/summaries?tickers=${encodeURIComponent(ticker)}`);
          const data: BacktestSummary[] = res.ok ? await res.json() : [];
          if (data.length === 0) {
            setError(`No backtest data available yet for ${ticker}.`);
            // Close the dropdown and clear the search text even on failure —
            // otherwise the same unresolvable result sits there clickable,
            // and clicking it again just repeats the same fetch and error
            // with no visible change, which reads as the UI being stuck.
            setQuery('');
            setShowResults(false);
            return;
          }
          setSummaries((prev) => ({ ...prev, [ticker]: data[0] }));
        } catch {
          setError(`Couldn't load data for ${ticker}.`);
          setQuery('');
          setShowResults(false);
          return;
        } finally {
          setPendingTicker(null);
        }
      }

      setQuery('');
      setShowResults(false);
      setAllocations((prev) => rebalanceProportionally([...prev, { ticker, pct: 100 / (prev.length + 1) }]));
    },
    [allocations.length, selectedTickers, summaries]
  );

  const removeTicker = useCallback((ticker: string) => {
    setError(null);
    setAllocations((prev) => rebalanceProportionally(prev.filter((a) => a.ticker !== ticker)));
  }, []);

  const setPct = useCallback((ticker: string, pct: number) => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
    setAllocations((prev) => prev.map((a) => (a.ticker === ticker ? { ...a, pct: clamped } : a)));
  }, []);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setShowResults(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (searchResults.length === 0) return;
      setShowResults(true);
      setActiveIndex((prev) => {
        const next = event.key === 'ArrowDown' ? prev + 1 : prev - 1;
        return (next + searchResults.length) % searchResults.length;
      });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const choice = searchResults[activeIndex];
      // Fall back to the raw text so a known ticker can be typed and submitted.
      void addTicker(choice ? choice.ticker : query);
    }
  };

  const totalPct = allocations.reduce((sum, a) => sum + a.pct, 0);
  const isBalanced = Math.abs(totalPct - 100) < 0.5;

  const entries = useMemo(
    () => allocations.filter((a) => summaries[a.ticker]).map((a) => ({ summary: summaries[a.ticker], pct: a.pct })),
    [allocations, summaries]
  );
  const allLoaded = entries.length === allocations.length;
  const ready = isBalanced && allLoaded && entries.length > 0;

  const results = useMemo(() => {
    if (!ready) return null;
    return FREQUENCIES.flatMap((frequency) =>
      PERIODS.map((period) => ({ frequency, ...aggregatePortfolio(entries, totalAmount, frequency, period) }))
    );
  }, [entries, totalAmount, ready]);

  /**
   * Last balanced snapshot. Results used to unmount the moment a weight was
   * edited, collapsing the page to a header; now they stay on screen, dimmed,
   * until the allocation is valid again.
   */
  const [lastGoodResults, setLastGoodResults] = useState<NonNullable<typeof results>>([]);
  useEffect(() => {
    if (results) setLastGoodResults(results);
  }, [results]);
  // Prefer the value computed this render so the server-rendered HTML already
  // contains real numbers; falling back to state only while mid-edit.
  const shownResults = results ?? lastGoodResults;

  // Built together so weights can never be zipped onto the wrong tickers.
  const analyticsQuery = useMemo(() => {
    if (!ready) return null;
    const tickers = entries.map((e) => e.summary.ticker);
    return {
      tickers,
      params: new URLSearchParams({
        tickers: tickers.join(','),
        allocations: entries.map((e) => e.pct).join(','),
        period: ANALYTICS_PERIOD,
        sectors: JSON.stringify(Object.fromEntries(entries.map((e) => [e.summary.ticker, e.summary.sector]))),
      }).toString(),
    };
  }, [entries, ready]);

  useEffect(() => {
    if (!analyticsQuery) {
      // Only discard analytics when there's nothing left to analyse. Clearing on
      // every unbalanced keystroke would swap the panels back to skeletons —
      // the same disappearing-results problem the performance section had.
      if (allocations.length === 0) {
        setAnalytics(null);
        setAnalyticsError(null);
      }
      setAnalyticsLoading(false);
      return;
    }

    const controller = new AbortController();
    // Debounced: the effect re-ran on every keystroke in a weight field, firing
    // a full multi-year price query each time.
    const timer = setTimeout(async () => {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      try {
        const res = await fetch(`/api/portfolio/analytics?${analyticsQuery.params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Analytics request failed (${res.status})`);
        const data = await res.json();
        setAnalytics({ ...data, tickers: analyticsQuery.tickers });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setAnalytics(null);
        setAnalyticsError("Couldn't compute analytics for this portfolio.");
      } finally {
        setAnalyticsLoading(false);
      }
    }, ANALYTICS_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [analyticsQuery, analyticsAttempt, allocations.length]);

  // Shareable URL. Kept out of the Next router to avoid a re-render per keystroke.
  // Gated on the restore pass above: without the gate this effect fires first on
  // mount and overwrites the incoming ?a= params with the default portfolio.
  useEffect(() => {
    if (!restored || allocations.length === 0) return;
    const params = new URLSearchParams({
      a: allocations.map((a) => `${a.ticker}:${a.pct}`).join(','),
      amt: String(totalAmount),
    });
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
  }, [allocations, totalAmount, restored]);

  const colors = useMemo(() => tickerColors(allocations.map((a) => a.ticker)), [allocations]);
  const hasResults = shownResults.length > 0;
  const isEmpty = allocations.length === 0;

  // Calculate best edge row for the CTA tile (same logic as PortfolioPerformanceSection)
  const bestEdgeRow = useMemo(() => {
    if (shownResults.length === 0) return null;
    const PERIOD_LABEL: Record<'1y' | '3y' | '5y', string> = { '1y': '1Y', '3y': '3Y', '5y': '5Y' };
    const PERIOD_ORDER: Record<'1y' | '3y' | '5y', number> = { '5y': 0, '3y': 1, '1y': 2 };

    const rows = shownResults.map((result) => ({
      period: result.period,
      periodLabel: PERIOD_LABEL[result.period],
      cadence: result.frequency,
      cadenceLabel: result.frequency === 'weekly' ? 'Weekly' : 'Monthly',
      dollarGain: result.enhValue - result.stdValue,
      enhInvested: result.enhInvested,
    }));

    rows.sort((a, b) => {
      const byPeriod = PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period];
      if (byPeriod !== 0) return byPeriod;
      return a.cadence === 'weekly' ? -1 : 1;
    });

    return rows.reduce((best, row) => (row.dollarGain > best.dollarGain ? row : best), rows[0]);
  }, [shownResults]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]" style={{ gap: '14px', alignItems: 'start' }}>
      {/* ── Left rail: the editor is always visible now. It used to be collapsed
          behind an "Edit Portfolio" button, so the page's primary control was
          hidden on arrival. ── */}
      {/* top clears the sticky topbar in app/portfolio/layout.tsx. */}
      <div className="lg:sticky" style={{ top: '58px', display: 'grid', gap: '12px', minWidth: 0 }}>
        <Panel title="Contribution">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: T.value, color: 'var(--text-2)' }}>$</span>
            <input
              id="portfolio-amount"
              type="number"
              min={1}
              step={50}
              value={totalAmount}
              onChange={(e) => setTotalAmount(Math.max(1, Number(e.target.value) || 0))}
              aria-label="Monthly contribution in dollars"
              className="mlln-focusable"
              style={{
                width: '100%',
                padding: '7px 9px',
                fontSize: T.value,
                fontWeight: 600,
                borderRadius: RADIUS.sm,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                fontFamily: MONO,
                boxShadow: 'var(--inset-recess)',
              }}
            />
            <span style={{ fontSize: T.label, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>/ month</span>
          </div>
        </Panel>

        <Panel
          title="Allocation"
          hint="Weights are rescaled to 100% automatically when you add or remove an asset. Edit any weight directly to override."
          right={
            <span style={{ fontSize: T.label, fontFamily: MONO, color: isBalanced ? 'var(--text-2)' : 'var(--red)', fontWeight: 600 }}>
              {/* One decimal when it matters: at toFixed(0) a 100.4% total
                  displayed as "100%" and a 100.6% total as "101%". */}
              {Number.isInteger(totalPct) ? totalPct : totalPct.toFixed(1)}%
            </span>
          }
        >
          <div ref={searchRef} style={{ position: 'relative', marginBottom: '10px' }}>
            <label htmlFor="portfolio-asset-search" style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: '4px' }}>
              Add asset ({allocations.length}/{MAX_ASSETS})
            </label>
            <input
              id="portfolio-asset-search"
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={showResults && query.trim().length > 0}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={showResults && searchResults[activeIndex] ? `option-${searchResults[activeIndex].ticker}` : undefined}
              placeholder={allocations.length >= MAX_ASSETS ? 'Portfolio full' : 'Ticker or name…'}
              value={query}
              disabled={allocations.length >= MAX_ASSETS || pendingTicker !== null}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              onKeyDown={handleSearchKeyDown}
              className="mlln-focusable"
              style={{
                width: '100%',
                padding: '7px 9px',
                fontSize: T.body,
                borderRadius: RADIUS.sm,
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--text)',
                boxShadow: 'var(--inset-recess)',
              }}
            />
            {pendingTicker && (
              <div role="status" style={{ marginTop: '5px', fontSize: T.label, color: 'var(--text-2)' }}>
                Loading {pendingTicker}…
              </div>
            )}

            {showResults && query.trim().length > 0 && (
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Matching assets"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  listStyle: 'none',
                  padding: '3px',
                  background: 'var(--surface-elevated)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: RADIUS.sm,
                  boxShadow: 'var(--inset-top), var(--shadow-lg)',
                  zIndex: 30,
                  maxHeight: '240px',
                  overflowY: 'auto',
                }}
              >
                {searchResults.length === 0 ? (
                  <li style={{ padding: '8px 9px', fontSize: T.label, color: 'var(--text-3)' }}>
                    No match for &ldquo;{query.trim()}&rdquo;
                  </li>
                ) : (
                  searchResults.map((option, idx) => (
                    <li key={option.ticker} id={`option-${option.ticker}`} role="option" aria-selected={idx === activeIndex}>
                      <button
                        type="button"
                        onClick={() => void addTicker(option.ticker)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className="mlln-row mlln-focusable"
                        style={{
                          width: '100%',
                          padding: '7px 8px',
                          fontSize: T.body,
                          background: idx === activeIndex ? 'var(--surface2)' : 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: '8px',
                          color: 'var(--text-2)',
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{option.ticker.toUpperCase()}</span>
                        <span style={{ color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.name}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {error && (
            <p
              role="alert"
              style={{
                margin: '0 0 8px',
                fontSize: T.label,
                color: 'var(--red)',
                background: 'var(--red-dim)',
                borderRadius: RADIUS.sm,
                padding: '6px 8px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span>{error}</span>
              {/* Nothing else on the page cleared this once it was set — "Equal
                  split" and "Scale to 100%" are allocation actions, not error
                  actions, so a user reaching for them to "reset" saw no effect. */}
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Dismiss"
                className="mlln-focusable"
                style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: 0, flexShrink: 0 }}
              >
                ×
              </button>
            </p>
          )}

          {isEmpty ? (
            <p style={{ margin: 0, fontSize: T.body, color: 'var(--text-2)', lineHeight: 1.6 }}>
              No assets yet. Search above to add one — or{' '}
              <button
                type="button"
                onClick={() => setAllocations(equalSplit(initialTickers))}
                className="mlln-focusable"
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--teal)', fontWeight: 600, cursor: 'pointer', fontSize: T.body }}
              >
                start from the sample portfolio
              </button>
              .
            </p>
          ) : (
            <>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '5px' }}>
                {allocations.map(({ ticker, pct }) => (
                  <li key={ticker} style={{ minWidth: 0, overflow: 'hidden' }}>
                    <AllocationRow
                      ticker={ticker}
                      name={summaries[ticker]?.name ?? ''}
                      pct={pct}
                      amount={totalAmount * (pct / 100)}
                      color={colors[ticker]}
                      onChange={(next) => setPct(ticker, next)}
                      onRemove={() => removeTicker(ticker)}
                    />
                  </li>
                ))}
              </ul>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAllocations(equalSplit(allocations.map((a) => a.ticker)));
                  }}
                  className="mlln-focusable mlln-pill"
                  style={pillStyle('var(--surface2)', 'var(--text-2)')}
                >
                  Equal split
                </button>
                {!isBalanced && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setAllocations(rebalanceProportionally(allocations));
                    }}
                    className="mlln-focusable mlln-pill"
                    style={pillStyle('var(--teal-dim)', 'var(--teal)')}
                  >
                    Scale to 100%
                  </button>
                )}
              </div>

              {!isBalanced && (
                <p role="status" style={{ margin: '8px 0 0', fontSize: T.label, color: 'var(--text-2)', lineHeight: 1.5 }}>
                  Weights total {totalPct.toFixed(1)}%. Results below still show your last 100% allocation.
                </p>
              )}

              <div style={{ display: 'flex', gap: '6px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)', flexDirection: 'column' }}>
                {isAuthenticated ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowCreateWatchlistModal(true)}
                      className="mlln-focusable mlln-cta"
                      style={{ ...ctaStyle, width: '100%' }}
                    >
                      Create Watchlist
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSaveModal(true)}
                      className="mlln-focusable mlln-cta"
                      style={{ ...ctaStyle, width: '100%' }}
                    >
                      Save Portfolio
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSaveModal(true)}
                    className="mlln-focusable mlln-cta"
                    style={{ ...ctaStyle, width: '100%' }}
                  >
                    Save Portfolio
                  </button>
                )}
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* ── Right column: results ── */}
      <div style={{ display: 'grid', gap: '12px', minWidth: 0 }}>
        {isEmpty ? (
          <Panel>
            <p style={{ margin: 0, fontSize: T.value, color: 'var(--text-2)', lineHeight: 1.7 }}>
              Add at least one asset to compare the signal-based Alpha strategy against standard dollar-cost averaging.
            </p>
          </Panel>
        ) : (
          <>
            {hasResults ? (
              <div style={{ opacity: isBalanced ? 1 : 0.55, transition: 'opacity 0.15s' }}>
                <PortfolioPerformanceSection
                  results={shownResults}
                  portfolioMetrics={analytics?.portfolioMetrics}
                  efficientFrontier={analytics?.efficientFrontier}
                  maxDrawdown={analytics?.portfolioMetrics.maxDrawdown}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '12px' }}>
                {[0, 1, 2, 3].map((i) => (
                  <Panel key={i}>
                    <Skeleton height={54} />
                  </Panel>
                ))}
              </div>
            )}

            {analyticsError && (
              <Panel>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <p role="alert" style={{ margin: 0, fontSize: T.body, color: 'var(--red)' }}>
                    {analyticsError}
                  </p>
                  <button type="button" onClick={() => setAnalyticsAttempt((n) => n + 1)} className="mlln-focusable mlln-pill" style={pillStyle('var(--teal-dim)', 'var(--teal)')}>
                    Retry
                  </button>
                </div>
              </Panel>
            )}

            {analytics && (
              <>
                <div style={{ display: 'grid', gap: '12px', opacity: analyticsLoading ? 0.55 : 1, transition: 'opacity 0.15s' }}>
                  <div className={`grid grid-cols-1 ${userTier >= 1 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`} style={{ gap: '12px' }}>
                    <SectorCompositionChart data={analytics.sectorComposition} />
                    <RiskDecompositionChart
                      assetMetrics={analytics.assetMetrics}
                      portfolioVolatility={analytics.portfolioMetrics.volatility}
                      colors={colors}
                    />
                    {userTier < 1 && bestEdgeRow && (
                      <EdgeCTATile
                        dollarGain={bestEdgeRow.dollarGain}
                        enhInvested={bestEdgeRow.enhInvested}
                        periodLabel={bestEdgeRow.periodLabel}
                        cadenceLabel={bestEdgeRow.cadenceLabel}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: '12px' }}>
                    <CorrelationHeatmap matrix={analytics.correlationMatrix} tickers={analytics.tickers} />
                    <AssetContributionTable
                      assetMetrics={analytics.assetMetrics}
                      allocations={Object.fromEntries(allocations.map((a) => [a.ticker, a.pct]))}
                      colors={colors}
                      lookbackYears={analytics.lookbackYears}
                      windowStart={analytics.windowStart}
                      windowEnd={analytics.windowEnd}
                      observations={analytics.alignedObservations}
                    />
                  </div>
                </div>

                {analytics.missingTickers.length > 0 && (
                  <p style={{ margin: 0, fontSize: T.label, color: 'var(--text-2)', background: 'var(--red-dim)', borderRadius: RADIUS.sm, padding: '7px 9px', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--red)' }}>No price history:</strong> {analytics.missingTickers.join(', ')} —
                    excluded from the correlation, risk and volatility figures above.
                  </p>
                )}
              </>
            )}

            {!analytics && !analyticsError && (
              <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '12px' }}>
                {[0, 1, 2].map((i) => (
                  <Panel key={i}>
                    <Skeleton height={140} />
                  </Panel>
                ))}
              </div>
            )}

            {analytics && (
              <PortfolioRecommendations
                allocations={allocations}
                analytics={analytics}
                summaries={summaries}
                assetOptions={assetOptions}
              />
            )}

            {/* The loading indicator used to render below the analytics block it
                described, so it sat off-screen while the area above was empty. */}
            {analyticsLoading && (
              <p role="status" aria-live="polite" style={{ margin: 0, fontSize: T.label, color: 'var(--text-3)', textAlign: 'center' }}>
                Updating analytics…
              </p>
            )}

            <p style={{ margin: 0, fontSize: T.label, color: 'var(--text-3)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--surface-elevated)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: RADIUS.md, boxShadow: 'var(--shadow-xs)' }}>
              <strong style={{ color: 'var(--text-2)' }}>Disclosure:</strong> Past performance doesn&apos;t guarantee future results.
              Backtests assume no rebalancing, fees, taxes or slippage. Sharpe ratios use a 5% risk-free rate. The Alpha strategy
              varies contribution size on signals, so it deploys a different total than standard DCA over the same window — compare
              the return percentages, not just the dollar gap. For informational purposes only.
            </p>
          </>
        )}
      </div>

      <SavePortfolioModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        portfolio={{ tickers: allocations.map(a => a.ticker), allocations: Object.fromEntries(allocations.map(a => [a.ticker, a.pct])) }}
      />

      <CreateWatchlistModal
        isOpen={showCreateWatchlistModal}
        onClose={() => setShowCreateWatchlistModal(false)}
        tickers={allocations.map(a => a.ticker)}
        tier={userTier}
      />
    </div>
  );
}

const ctaStyle = {
  display: 'block',
  textAlign: 'center',
  background: 'var(--teal)',
  color: '#040e18',
  fontSize: T.label,
  fontWeight: 700,
  padding: '8px 10px',
  borderRadius: RADIUS.sm,
  textDecoration: 'none',
  boxShadow: 'var(--shadow-xs)',
} as const;

function pillStyle(background: string, color: string) {
  return {
    background,
    color,
    border: 'none',
    padding: '5px 11px',
    borderRadius: RADIUS.pill,
    fontSize: T.label,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: 'var(--shadow-xs)',
  } as const;
}

/**
 * Weight editor. Keeps the in-progress text locally so clearing the field
 * doesn't snap to 0 — `Number('')` is 0, which used to zero the weight and tear
 * down the results mid-edit.
 */
function AllocationRow({
  ticker,
  name,
  pct,
  amount,
  color,
  onChange,
  onRemove,
}: {
  ticker: string;
  name: string;
  pct: number;
  amount: number;
  color: string;
  onChange: (pct: number) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(String(pct));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(pct));
  }, [pct, editing]);

  return (
    <div
      className="mlln-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        padding: '6px 8px',
        borderRadius: RADIUS.sm,
        border: '1px solid var(--border)',
        background: 'var(--surface2)',
        minWidth: 0,
      }}
    >
      <span aria-hidden style={{ width: '3px', alignSelf: 'stretch', borderRadius: '2px', background: color, flexShrink: 0 }} />
      {/* overflow: hidden here (not just minWidth: 0) is what actually zeroes this
          box's automatic minimum size per the CSS sizing spec — without it, a long
          fund name could force the row wider than the panel and spill over its
          border into whatever sits below. */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ fontSize: T.body, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticker}</div>
        {name && (
          <div style={{ fontSize: T.label, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        )}
      </div>
      <input
        type="number"
        min={0}
        max={100}
        inputMode="decimal"
        value={draft}
        aria-label={`${ticker} allocation percent`}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value !== '') onChange(Number(e.target.value));
        }}
        onBlur={() => {
          setEditing(false);
          if (draft === '') {
            setDraft(String(pct));
            return;
          }
          onChange(Number(draft));
        }}
        className="mlln-focusable"
        style={{
          width: '46px',
          flexShrink: 0,
          padding: '4px 5px',
          fontSize: T.body,
          borderRadius: '5px',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          color: 'var(--text)',
          fontFamily: MONO,
          textAlign: 'right',
          boxShadow: 'var(--inset-recess)',
        }}
      />
      <span aria-hidden style={{ fontSize: T.label, color: 'var(--text-3)', flexShrink: 0 }}>
        %
      </span>
      <span style={{ fontSize: T.label, color: 'var(--text-2)', fontFamily: MONO, minWidth: '52px', textAlign: 'right', flexShrink: 0 }}>
        {formatCurrency(amount)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${ticker}`}
        className="mlln-focusable"
        style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: '2px 0 2px 2px', flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}
