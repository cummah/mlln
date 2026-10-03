'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Panel, T, RADIUS, Skeleton } from '@/components/portfolio/ui';

interface WatchlistItem {
  ticker: string;
  name: string;
  sector: string;
  allocationPct: number;
  targetAllocationPct?: number;
  executed: boolean;
  executedDate?: string;
  executedPrice?: number;
  executedShares?: number;
}

interface SignalData {
  ticker: string;
  signalDate: string | null;
  signalMult: number | null;
  performance: number | null;
  finalConvictionScore: number | null;
  exitScore: number | null;
  exitOpen: boolean;
}

interface WatchlistSignals {
  weekly: Record<string, SignalData>;
  monthly: Record<string, SignalData>;
  lastFetch: number;
}

const MAX_ASSETS = 30;
const CACHE_DURATION_MS = 3600000; // 1 hour

export function WatchlistContent() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [signals, setSignals] = useState<WatchlistSignals>({ weekly: {}, monthly: {}, lastFetch: 0 });
  const [assetOptions, setAssetOptions] = useState<Array<{ ticker: string; name: string; sector: string }>>([]);
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'conviction' | 'date' | 'performance' | 'allocation'>('date');
  const [filterByType, setFilterByType] = useState<'all' | 'new' | 'profit-taking'>('all');
  const [lastVisitDate, setLastVisitDate] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      console.log('WatchlistContent mounting...');
      console.log('URL params:', new URLSearchParams(window.location.search).toString());

      // Check if importing from portfolio - read import data first
      const importData = localStorage.getItem('mlln-watchlist-import');
      console.log('Import data from localStorage:', importData ? 'Found' : 'Not found');

      if (importData) {
        try {
          const allocations: any[] = JSON.parse(importData);
          console.log('✓ Parsed allocations:', allocations);
          // Convert allocations to watchlist items (names will be filled from assetOptions)
          const newWatchlist = allocations.map((a) => ({
            ticker: a.ticker,
            name: '', // Will be filled from assetOptions
            sector: '',
            allocationPct: a.pct,
            executed: false,
          }));
          console.log('✓ Created watchlist items:', newWatchlist);
          setWatchlist(newWatchlist);

          // Clear the import data after loading
          localStorage.removeItem('mlln-watchlist-import');

          // Remove import param from URL
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.has('imported')) {
            urlParams.delete('imported');
            window.history.replaceState({}, '', urlParams.toString() ? `/watchlist?${urlParams}` : '/watchlist');
          }
        } catch (e) {
          console.error('✗ Failed to parse import data:', e);
        }
      } else {
        // Load existing watchlist if not importing
        const saved = localStorage.getItem('mlln-watchlist');
        console.log('Existing watchlist data:', saved ? 'Found' : 'Not found');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            console.log('✓ Loaded existing watchlist:', parsed);
            setWatchlist(parsed);
          } catch (e) {
            console.error('✗ Failed to parse saved watchlist:', e);
          }
        }
      }

      const savedVisit = localStorage.getItem('mlln-watchlist-visit');
      if (savedVisit) setLastVisitDate(savedVisit);

      // Update last visit date
      localStorage.setItem('mlln-watchlist-visit', new Date().toISOString());

      // Mark as hydrated so we can render now
      setIsHydrated(true);
    } catch (e) {
      console.error('✗ Failed to load watchlist from localStorage:', e);
      setIsHydrated(true);
    }
  }, []);

  // Save watchlist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mlln-watchlist', JSON.stringify(watchlist));
    } catch (e) {
      console.error('Failed to save watchlist to localStorage:', e);
    }
  }, [watchlist]);

  // Fetch asset options
  useEffect(() => {
    fetch('/api/assets')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const options = Array.isArray(data) ? data : [];
        setAssetOptions(options);

        // Fill in missing asset names for imported watchlist items
        setWatchlist((prev) =>
          prev.map((item) => {
            if (!item.name) {
              const found = options.find((opt) => opt.ticker.toUpperCase() === item.ticker.toUpperCase());
              return {
                ...item,
                name: found?.name || item.ticker,
                sector: found?.sector || '',
              };
            }
            return item;
          })
        );
      })
      .catch(() => setAssetOptions([]));
  }, []);

  // Fetch signals for watchlist
  useEffect(() => {
    if (watchlist.length === 0) {
      setSignals({ weekly: {}, monthly: {}, lastFetch: 0 });
      return;
    }

    const now = Date.now();
    if (signals.lastFetch > 0 && now - signals.lastFetch < CACHE_DURATION_MS) {
      return; // Use cached signals
    }

    const loadSignals = async () => {
      setSignalsLoading(true);
      const tickers = watchlist.map((w) => w.ticker);

      try {
        const [weeklyRes, monthlyRes] = await Promise.all([
          fetch(`/api/watchlist/weekly?tickers=${tickers.join(',')}`),
          fetch(`/api/watchlist/monthly?tickers=${tickers.join(',')}`),
        ]);

        const weeklyData = weeklyRes.ok ? await weeklyRes.json() : [];
        const monthlyData = monthlyRes.ok ? await monthlyRes.json() : [];

        const weeklyMap: Record<string, SignalData> = {};
        const monthlyMap: Record<string, SignalData> = {};

        (weeklyData as any[]).forEach((row: any) => {
          weeklyMap[row.ticker] = {
            ticker: row.ticker,
            signalDate: row.signalDate,
            signalMult: row.signalMult,
            performance: row.performance,
            finalConvictionScore: row.finalConvictionScore,
            exitScore: row.exitScore,
            exitOpen: row.exitOpen,
          };
        });

        (monthlyData as any[]).forEach((row: any) => {
          monthlyMap[row.ticker] = {
            ticker: row.ticker,
            signalDate: row.signalDate,
            signalMult: row.signalMult,
            performance: row.performance,
            finalConvictionScore: row.finalConvictionScore,
            exitScore: row.exitScore,
            exitOpen: row.exitOpen,
          };
        });

        setSignals({
          weekly: weeklyMap,
          monthly: monthlyMap,
          lastFetch: now,
        });
      } catch (err) {
        console.error('Failed to fetch signals:', err);
      } finally {
        setSignalsLoading(false);
      }
    };

    loadSignals();
  }, [watchlist, signals.lastFetch]);

  const selectedTickers = useMemo(() => new Set(watchlist.map((w) => w.ticker)), [watchlist]);

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
      if (!ticker || selectedTickers.has(ticker) || watchlist.length >= MAX_ASSETS) return;
      setError(null);

      const asset = assetOptions.find((a) => a.ticker.toUpperCase() === ticker);
      if (!asset) {
        setError(`Asset not found: ${ticker}`);
        return;
      }

      setQuery('');
      setShowResults(false);

      setWatchlist((prev) => [
        ...prev,
        {
          ticker: asset.ticker,
          name: asset.name,
          sector: asset.sector,
          allocationPct: 5,
          executed: false,
        },
      ]);
    },
    [assetOptions, selectedTickers, watchlist.length]
  );

  const removeTicker = useCallback((ticker: string) => {
    setWatchlist((prev) => prev.filter((w) => w.ticker !== ticker));
  }, []);

  const updateAllocation = useCallback((ticker: string, pct: number) => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
    setWatchlist((prev) => prev.map((w) => (w.ticker === ticker ? { ...w, allocationPct: clamped } : w)));
  }, []);

  const toggleExecuted = useCallback((ticker: string) => {
    setWatchlist((prev) =>
      prev.map((w) =>
        w.ticker === ticker
          ? {
              ...w,
              executed: !w.executed,
              executedDate: !w.executed ? new Date().toISOString().split('T')[0] : undefined,
            }
          : w
      )
    );
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
      void addTicker(choice ? choice.ticker : query);
    }
  };

  // Determine if signal is new (since last visit)
  const isNewSignal = (signalDate: string | null): boolean => {
    if (!signalDate || !lastVisitDate) return false;
    return new Date(signalDate) > new Date(lastVisitDate);
  };

  // Determine if strong sell signal (profit-taking opportunity)
  const isStrongSellSignal = (exitScore: number | null): boolean => {
    return exitScore !== null && exitScore >= 7;
  };

  // Sorted and filtered watchlist
  const displayList = useMemo(() => {
    let list = [...watchlist];

    // Filter
    if (filterByType === 'new') {
      list = list.filter(
        (item) =>
          isNewSignal(signals.weekly[item.ticker]?.signalDate) || isNewSignal(signals.monthly[item.ticker]?.signalDate)
      );
    } else if (filterByType === 'profit-taking') {
      list = list.filter(
        (item) =>
          isStrongSellSignal(signals.weekly[item.ticker]?.exitScore) ||
          isStrongSellSignal(signals.monthly[item.ticker]?.exitScore)
      );
    }

    // Sort
    if (sortBy === 'conviction') {
      list.sort((a, b) => {
        const aConv = Math.max(signals.weekly[a.ticker]?.finalConvictionScore ?? 0, signals.monthly[a.ticker]?.finalConvictionScore ?? 0);
        const bConv = Math.max(signals.weekly[b.ticker]?.finalConvictionScore ?? 0, signals.monthly[b.ticker]?.finalConvictionScore ?? 0);
        return bConv - aConv;
      });
    } else if (sortBy === 'date') {
      list.sort((a, b) => {
        const aDate = Math.max(
          new Date(signals.weekly[a.ticker]?.signalDate ?? 0).getTime(),
          new Date(signals.monthly[a.ticker]?.signalDate ?? 0).getTime()
        );
        const bDate = Math.max(
          new Date(signals.weekly[b.ticker]?.signalDate ?? 0).getTime(),
          new Date(signals.monthly[b.ticker]?.signalDate ?? 0).getTime()
        );
        return bDate - aDate;
      });
    } else if (sortBy === 'performance') {
      list.sort((a, b) => {
        const aPerf = Math.max(signals.weekly[a.ticker]?.performance ?? -Infinity, signals.monthly[a.ticker]?.performance ?? -Infinity);
        const bPerf = Math.max(signals.weekly[b.ticker]?.performance ?? -Infinity, signals.monthly[b.ticker]?.performance ?? -Infinity);
        return bPerf - aPerf;
      });
    } else if (sortBy === 'allocation') {
      list.sort((a, b) => b.allocationPct - a.allocationPct);
    }

    return list;
  }, [watchlist, signals, sortBy, filterByType, lastVisitDate]);

  const totalAllocation = useMemo(() => watchlist.reduce((sum, w) => sum + w.allocationPct, 0), [watchlist]);
  const executedCount = useMemo(() => watchlist.filter((w) => w.executed).length, [watchlist]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]" style={{ gap: '14px', alignItems: 'start' }}>
      {/* ── Left rail: Editor and controls ── */}
      <div className="lg:sticky" style={{ top: '58px', display: 'grid', gap: '12px', minWidth: 0 }}>
        <Panel title="Add Assets">
          <div ref={searchRef} style={{ position: 'relative' }}>
            <label htmlFor="watchlist-asset-search" style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)', marginBottom: '4px' }}>
              Search ({watchlist.length}/{MAX_ASSETS})
            </label>
            <input
              id="watchlist-asset-search"
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={showResults && query.trim().length > 0}
              aria-controls="watchlist-options"
              placeholder={watchlist.length >= MAX_ASSETS ? 'Watchlist full' : 'Ticker or name…'}
              value={query}
              disabled={watchlist.length >= MAX_ASSETS}
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

            {showResults && query.trim().length > 0 && (
              <ul
                id="watchlist-options"
                role="listbox"
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
                    <li key={option.ticker} role="option">
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
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{option.ticker}</span>
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
                margin: '8px 0 0',
                fontSize: T.label,
                color: 'var(--red)',
                background: 'var(--red-dim)',
                borderRadius: RADIUS.sm,
                padding: '6px 8px',
              }}
            >
              {error}
            </p>
          )}
        </Panel>

        {watchlist.length > 0 && (
          <Panel title="Summary">
            <div style={{ display: 'grid', gap: '8px', fontSize: T.body }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--text-2)' }}>Assets:</span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{watchlist.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--text-2)' }}>Executed:</span>
                <span style={{ fontWeight: 600, color: 'var(--teal)' }}>{executedCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--text-2)' }}>Allocation:</span>
                <span style={{ fontWeight: 600, fontFamily: 'DM Mono, monospace', color: totalAllocation === 100 ? 'var(--text)' : 'var(--red)' }}>
                  {totalAllocation}%
                </span>
              </div>
            </div>
          </Panel>
        )}

        {watchlist.length > 0 && (
          <Panel title="Controls">
            <div style={{ display: 'grid', gap: '8px', fontSize: T.label }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-2)', fontWeight: 600 }}>Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: T.body,
                    borderRadius: RADIUS.sm,
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="date">Newest Signal</option>
                  <option value="conviction">Highest Conviction</option>
                  <option value="performance">Best Performance</option>
                  <option value="allocation">Highest Allocation</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', color: 'var(--text-2)', fontWeight: 600 }}>Filter:</label>
                <select
                  value={filterByType}
                  onChange={(e) => setFilterByType(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    fontSize: T.body,
                    borderRadius: RADIUS.sm,
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">All Assets</option>
                  <option value="new">New Signals</option>
                  <option value="profit-taking">Profit-Taking Alerts</option>
                </select>
              </div>
            </div>
          </Panel>
        )}
      </div>

      {/* ── Right column: Watchlist ── */}
      <div style={{ display: 'grid', gap: '12px', minWidth: 0 }}>
        {watchlist.length === 0 ? (
          <Panel>
            <p style={{ margin: 0, fontSize: T.value, color: 'var(--text-2)', lineHeight: 1.7 }}>
              Add portfolio assets to your watchlist to monitor weekly and monthly signals in one place. Search on the left to get started.
            </p>
          </Panel>
        ) : (
          <>
            {signalsLoading && watchlist.length > 0 && signals.lastFetch === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {watchlist.slice(0, 4).map((item) => (
                  <Panel key={item.ticker}>
                    <Skeleton height={120} />
                  </Panel>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {displayList.map((item) => {
                  const weekly = signals.weekly[item.ticker];
                  const monthly = signals.monthly[item.ticker];
                  const latestSignal = weekly && monthly
                    ? new Date(weekly.signalDate ?? 0) > new Date(monthly.signalDate ?? 0) ? weekly : monthly
                    : weekly || monthly;

                  const isNewWeekly = isNewSignal(weekly?.signalDate ?? null);
                  const isNewMonthly = isNewSignal(monthly?.signalDate ?? null);
                  const hasProfitTaking = isStrongSellSignal(weekly?.exitScore) || isStrongSellSignal(monthly?.exitScore);

                  return (
                    <Panel
                      key={item.ticker}
                      style={{
                        opacity: item.executed ? 0.65 : 1,
                        border: hasProfitTaking ? '1px solid rgba(240, 162, 92, 0.3)' : undefined,
                        background: hasProfitTaking ? 'var(--surface-elevated)' : 'var(--surface-elevated)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: T.heading, fontWeight: 700, color: 'var(--text)' }}>
                              {item.ticker}
                            </div>
                            <div style={{ fontSize: T.label, color: 'var(--text-3)' }}>
                              {item.name}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTicker(item.ticker)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-3)',
                              cursor: 'pointer',
                              fontSize: '18px',
                              padding: 0,
                              flexShrink: 0,
                            }}
                          >
                            ×
                          </button>
                        </div>

                        {/* Allocation */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: T.label, color: 'var(--text-2)' }}>Alloc:</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={item.allocationPct}
                            onChange={(e) => updateAllocation(item.ticker, Number(e.target.value))}
                            style={{
                              width: '40px',
                              padding: '4px 5px',
                              fontSize: T.label,
                              borderRadius: RADIUS.sm,
                              border: '1px solid var(--border)',
                              background: 'var(--surface2)',
                              color: 'var(--text)',
                              fontFamily: 'DM Mono, monospace',
                            }}
                          />
                          <span style={{ fontSize: T.label, color: 'var(--text-2)' }}>%</span>
                        </div>

                        {/* Signals Grid */}
                        {latestSignal && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: T.label }}>
                            {/* Weekly */}
                            {weekly && (
                              <Link
                                href={`/asset/weekly?ticker=${item.ticker}`}
                                style={{
                                  padding: '8px',
                                  borderRadius: RADIUS.sm,
                                  background: 'var(--surface2)',
                                  border: '1px solid var(--border)',
                                  textDecoration: 'none',
                                  color: 'inherit',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                  <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>Weekly</span>
                                  {isNewWeekly && (
                                    <span
                                      style={{
                                        fontSize: '9px',
                                        background: 'var(--teal)',
                                        color: '#040e18',
                                        padding: '2px 5px',
                                        borderRadius: '3px',
                                        fontWeight: 600,
                                      }}
                                    >
                                      NEW
                                    </span>
                                  )}
                                </div>
                                {weekly.signalDate && (
                                  <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
                                    {formatDateRelative(new Date(weekly.signalDate))}
                                  </div>
                                )}
                                {weekly.finalConvictionScore !== null && (
                                  <div style={{ fontSize: T.value, fontWeight: 600, color: 'var(--text)' }}>
                                    {weekly.finalConvictionScore.toFixed(0)}/100
                                  </div>
                                )}
                                {weekly.performance !== null && (
                                  <div
                                    style={{
                                      fontSize: T.label,
                                      fontWeight: 600,
                                      color: weekly.performance >= 0 ? 'var(--green)' : '#E24B4A',
                                    }}
                                  >
                                    {weekly.performance >= 0 ? '+' : ''}{weekly.performance.toFixed(1)}%
                                  </div>
                                )}
                              </Link>
                            )}

                            {/* Monthly */}
                            {monthly && (
                              <Link
                                href={`/asset/monthly?ticker=${item.ticker}`}
                                style={{
                                  padding: '8px',
                                  borderRadius: RADIUS.sm,
                                  background: 'var(--surface2)',
                                  border: '1px solid var(--border)',
                                  textDecoration: 'none',
                                  color: 'inherit',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                  <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>Monthly</span>
                                  {isNewMonthly && (
                                    <span
                                      style={{
                                        fontSize: '9px',
                                        background: 'var(--teal)',
                                        color: '#040e18',
                                        padding: '2px 5px',
                                        borderRadius: '3px',
                                        fontWeight: 600,
                                      }}
                                    >
                                      NEW
                                    </span>
                                  )}
                                </div>
                                {monthly.signalDate && (
                                  <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
                                    {formatDateRelative(new Date(monthly.signalDate))}
                                  </div>
                                )}
                                {monthly.finalConvictionScore !== null && (
                                  <div style={{ fontSize: T.value, fontWeight: 600, color: 'var(--text)' }}>
                                    {monthly.finalConvictionScore.toFixed(0)}/100
                                  </div>
                                )}
                                {monthly.performance !== null && (
                                  <div
                                    style={{
                                      fontSize: T.label,
                                      fontWeight: 600,
                                      color: monthly.performance >= 0 ? 'var(--green)' : '#E24B4A',
                                    }}
                                  >
                                    {monthly.performance >= 0 ? '+' : ''}{monthly.performance.toFixed(1)}%
                                  </div>
                                )}
                              </Link>
                            )}
                          </div>
                        )}

                        {/* Profit-Taking Alert */}
                        {hasProfitTaking && (
                          <div
                            style={{
                              padding: '7px 8px',
                              borderRadius: RADIUS.sm,
                              background: 'rgba(240, 162, 92, 0.1)',
                              border: '1px solid rgba(240, 162, 92, 0.3)',
                              fontSize: T.label,
                              color: '#f0a35c',
                              fontWeight: 600,
                            }}
                          >
                            ⚠️ Strong sell signal — consider taking profit
                          </div>
                        )}

                        {/* Execution Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleExecuted(item.ticker)}
                          style={{
                            marginTop: 'auto',
                            padding: '7px 10px',
                            borderRadius: RADIUS.sm,
                            border: '1px solid var(--border)',
                            background: item.executed ? 'var(--teal-dim)' : 'var(--surface2)',
                            color: item.executed ? 'var(--teal)' : 'var(--text-2)',
                            fontWeight: 600,
                            fontSize: T.label,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{item.executed ? '✓' : '○'}</span>
                          <span>{item.executed ? `Executed ${item.executedDate}` : 'Mark Executed'}</span>
                        </button>
                      </div>
                    </Panel>
                  );
                })}
              </div>
            )}

            {signalsLoading && (
              <p role="status" aria-live="polite" style={{ margin: 0, fontSize: T.label, color: 'var(--text-3)', textAlign: 'center' }}>
                Loading signals…
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatDateRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
