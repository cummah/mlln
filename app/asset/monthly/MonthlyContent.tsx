'use client';

import { useMemo, useState, useEffect } from 'react';
import { MonthlySignalsTable } from './MonthlySignalsTable';
import { MonthlyStrategyCards } from './MonthlyStrategyCards';
import { applyMonthlyFilters } from './monthly-filters';
import { type SignalRowEnhanced } from '@/lib/monthly-dashboard-utils';
import { PerformanceTiles } from '@/components/monthly-dashboard/PerformanceTiles';
import { DualRangeSlider } from '@/components/ui/DualRangeSlider';

interface SignalRow {
  ticker: string;
  name: string;
  sector: string;
  signalDate: string | null;
  signalMult: number | null;
  invested: number | null;
  performance: number | null;
  currentValue: number | null;
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
  tickerAlpha5y: number | null;
  cohortPeriod: string;
}

function getEarliestSignalDate(data: any[]): string | null {
  if (!data.length) return null;

  let earliestDate: Date | null = null;
  for (const row of data) {
    if (row.signalDate) {
      const date = new Date(row.signalDate);
      if (!earliestDate || date < earliestDate) {
        earliestDate = date;
      }
    }
  }

  return earliestDate ? earliestDate.toISOString().split('T')[0] : null;
}

function toEnhancedSignal(sig: SignalRow): SignalRowEnhanced {
  return {
    ticker: sig.ticker,
    signalDate: sig.signalDate || new Date().toISOString().split('T')[0],
    invested: sig.invested || 0,
    performance: sig.performance,
    currentValue: sig.currentValue || 0,
    exitOpen: sig.exitOpen,
    exitAdjustedValue: sig.exitAdjustedValue || sig.currentValue || 0,
    exitDate: sig.exitDate,
    displayPerformance: sig.performance,
    displayValue: sig.currentValue || 0,
    cohortPeriod: sig.cohortPeriod,
    isClosedProfit: !sig.exitOpen && (sig.performance ?? 0) >= 0,
    isClosedLoss: !sig.exitOpen && (sig.performance ?? 0) < 0,
    isOpenProfit: sig.exitOpen && (sig.performance ?? 0) >= 0,
    isOpenLoss: sig.exitOpen && (sig.performance ?? 0) < 0,
  };
}

function applyFilteredSignals(
  signals: SignalRowEnhanced[],
  filters: { tickerSearch: string; returnFilter: 'all' | 'positive' | 'negative'; statusFilter: 'all' | 'open' | 'closed' }
): SignalRowEnhanced[] {
  return signals.filter(s => {
    if (filters.tickerSearch) {
      const search = filters.tickerSearch.toUpperCase();
      if (!s.ticker.toUpperCase().includes(search)) return false;
    }
    const perf = s.displayPerformance ?? 0;
    if (filters.returnFilter === 'positive' && perf < 0) return false;
    if (filters.returnFilter === 'negative' && perf >= 0) return false;
    if (filters.statusFilter === 'open' && !s.exitOpen) return false;
    if (filters.statusFilter === 'closed' && s.exitOpen) return false;
    return true;
  });
}

export function MonthlyContent({ data }: { data: SignalRow[] }) {
  // Current period filters
  const [tickerSearch, setTickerSearch] = useState('');
  const [returnFilter, setReturnFilter] = useState<'all' | 'positive' | 'negative'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'lastMonth' | 'last3Months' | 'last6Months' | 'lastYear'>('all');
  const [historicalYear, setHistoricalYear] = useState<'none' | '2025' | '2024' | '2023' | '2022' | '2021'>('none');

  // Score and multiplier filters
  const [minScoreFilter, setMinScoreFilter] = useState(0);
  const [maxScoreFilter, setMaxScoreFilter] = useState(100);
  const [minMultiplierFilter, setMinMultiplierFilter] = useState(0);
  const [maxMultiplierFilter, setMaxMultiplierFilter] = useState(6);
  const [minConvictionFilter, setMinConvictionFilter] = useState(0);
  const [maxConvictionFilter, setMaxConvictionFilter] = useState(100);
  const [minFundamentalFilter, setMinFundamentalFilter] = useState(0);
  const [maxFundamentalFilter, setMaxFundamentalFilter] = useState(100);

  // Exit and hold controls
  const [minExitScoreFilter, setMinExitScoreFilter] = useState(0);
  const [maxExitScoreFilter, setMaxExitScoreFilter] = useState(9);
  const [exitAtNextOpen, setExitAtNextOpen] = useState(false);
  const [maxMonthsHold, setMaxMonthsHold] = useState(0);

  // Factor regime filters
  const [minFactorRegime, setMinFactorRegime] = useState(-40);
  const [maxFactorRegime, setMaxFactorRegime] = useState(40);
  const [minVolTiming, setMinVolTiming] = useState(-30);
  const [maxVolTiming, setMaxVolTiming] = useState(30);
  const [minMeanReversion, setMinMeanReversion] = useState(-30);
  const [maxMeanReversion, setMaxMeanReversion] = useState(30);

  // Sector and base amount
  const [sectorFilters, setSectorFilters] = useState<string[]>([]);
  const [baseAmount, setBaseAmount] = useState(433);
  const [sectorPanelOpen, setSectorPanelOpen] = useState(false);

  // Dashboard state
  const [showDashboard, setShowDashboard] = useState(false);
  const [filtersChanged, setFiltersChanged] = useState(false);
  const [optionalSettingsOpen, setOptionalSettingsOpen] = useState(false);

  // SPY return state
  const [spyReturn, setSpyReturn] = useState<number | null>(null);
  const [spyLoading, setSpyLoading] = useState(false);

  if (!data || data.length === 0) {
    return (
      <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '40px', textAlign: 'center', color: 'var(--text-2)' }}>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No signal data available</div>
      </div>
    );
  }

  // Get unique sectors for filter dropdown
  const uniqueSectors = useMemo(() => Array.from(new Set(data.map(r => r.sector).filter(Boolean))).sort(), [data]);

  // Get current macro regime
  const currentRegime = useMemo(() => data.find(r => r.macroRegimeState)?.macroRegimeState || null, [data]);

  const allEnhancedSignals = useMemo(() => data.map(toEnhancedSignal), [data]);

  const fullStats = useMemo(() => {
    const totalInvested = allEnhancedSignals.reduce((sum, s) => sum + s.invested, 0);
    const totalValue = allEnhancedSignals.reduce((sum, s) => sum + s.displayValue, 0);
    const perfs = allEnhancedSignals.map(s => s.displayPerformance).filter((p): p is number => p !== null);
    const sortedPerfs = [...perfs].sort((a, b) => a - b);
    const mid = Math.floor(sortedPerfs.length / 2);
    const medianReturn = sortedPerfs.length ? (sortedPerfs.length % 2 ? sortedPerfs[mid] : (sortedPerfs[mid - 1] + sortedPerfs[mid]) / 2) : null;
    const winCount = perfs.filter(p => p >= 0).length;
    const winRate = perfs.length ? (winCount / perfs.length) * 100 : null;
    const avgMult = data.filter(r => r.signalMult !== null).map(r => r.signalMult as number);
    const avgMultiplier = avgMult.length ? avgMult.reduce((a, b) => a + b, 0) / avgMult.length : null;

    return { totalInvested, totalValue, totalReturn: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : null, medianReturn, winRate, winCount, validCount: perfs.length, signalCount: allEnhancedSignals.length, avgMultiplier };
  }, [allEnhancedSignals, data]);

  const adjustedData = useMemo(() => {
    return data.map(row => {
      if (row.signalMult === null) return row;
      const newInvested = baseAmount * row.signalMult;
      const scale = (val: number | null | undefined) => {
        if (val == null) return null;
        if (row.invested === null || row.invested === undefined || row.invested === 0) return val;
        return newInvested * (val / row.invested);
      };
      const newCurrentValue = scale(row.currentValue);
      const newExitAdjustedValue = scale(row.exitAdjustedValue);
      return {
        ...row,
        invested: newInvested,
        currentValue: newCurrentValue,
        exitAdjustedValue: newExitAdjustedValue,
        displayCurrentValue: row.exitOpen ? newCurrentValue : newExitAdjustedValue,
        displayPerformance: row.performance,
      } as any;
    });
  }, [data, baseAmount]);

  const cardData = useMemo(() => {
    return applyMonthlyFilters(
      adjustedData as any,
      tickerSearch,
      returnFilter,
      dateRangeFilter,
      sectorFilters,
      minScoreFilter,
      minMultiplierFilter,
      minConvictionFilter,
      minFundamentalFilter,
      statusFilter,
      maxScoreFilter,
      maxMultiplierFilter,
      maxConvictionFilter,
      maxFundamentalFilter,
      minFactorRegime,
      maxFactorRegime,
      minVolTiming,
      maxVolTiming,
      minMeanReversion,
      maxMeanReversion,
      historicalYear
    );
  }, [
    adjustedData,
    tickerSearch,
    returnFilter,
    dateRangeFilter,
    sectorFilters,
    minScoreFilter,
    minMultiplierFilter,
    minConvictionFilter,
    minFundamentalFilter,
    statusFilter,
    maxScoreFilter,
    maxMultiplierFilter,
    maxConvictionFilter,
    maxFundamentalFilter,
    minFactorRegime,
    maxFactorRegime,
    minVolTiming,
    maxVolTiming,
    minMeanReversion,
    maxMeanReversion,
    historicalYear,
  ]);

  // Fetch SPY return when cardData changes
  useEffect(() => {
    const fetchSpyReturn = async () => {
      const startDate = getEarliestSignalDate(cardData);
      if (!startDate) {
        setSpyReturn(null);
        return;
      }

      setSpyLoading(true);
      try {
        const response = await fetch(`/api/spy-return?startDate=${startDate}`);
        const result = await response.json();
        setSpyReturn(result.spyReturn || null);
      } catch (err) {
        console.error('Error fetching SPY return:', err);
        setSpyReturn(null);
      } finally {
        setSpyLoading(false);
      }
    };

    fetchSpyReturn();
  }, [cardData]);

  const handleFilterChange = () => {
    setFiltersChanged(true);
    setShowDashboard(false);
  };

  const resetFilters = () => {
    setTickerSearch('');
    setReturnFilter('all');
    setDateRangeFilter('all');
    setSectorFilters([]);
    setSectorPanelOpen(false);
    setMinScoreFilter(0);
    setMaxScoreFilter(100);
    setMinMultiplierFilter(0);
    setMaxMultiplierFilter(6);
    setMinConvictionFilter(0);
    setMaxConvictionFilter(100);
    setMinFundamentalFilter(0);
    setMaxFundamentalFilter(100);
    setStatusFilter('all');
    setMinExitScoreFilter(0);
    setMaxExitScoreFilter(9);
    setMinFactorRegime(-40);
    setMaxFactorRegime(40);
    setMinVolTiming(-30);
    setMaxVolTiming(30);
    setMinMeanReversion(-30);
    setMaxMeanReversion(30);
    setExitAtNextOpen(false);
    setMaxMonthsHold(0);
    setHistoricalYear('none');
    setBaseAmount(433);
  };

  const FilterButton = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
    <button onClick={onClick} style={{ padding: '8px 12px', background: active ? 'var(--teal)' : 'var(--surface)', border: '1px solid ' + (active ? 'var(--teal)' : 'var(--border)'), borderRadius: '8px', fontSize: '12px', fontWeight: '600', color: active ? '#000' : 'var(--text)', cursor: 'pointer', transition: 'all 0.15s', width: '100%' }}>
      {label}
    </button>
  );

  return (
    <>
      {/* Main 2-column grid: left filters, right content */}
      <div className="grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]" style={{ gap: '14px', alignItems: 'start' }}>

        {/* LEFT COLUMN: All Filters (Sticky) */}
        <div className="lg:sticky" style={{ top: '58px', display: 'grid', gap: '12px', minWidth: 0 }}>
          {/* ALWAYS OPEN SECTION */}
          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '14px', boxShadow: 'var(--inset-top), var(--shadow-md)', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              {/* Signal Date Range */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Signal Date</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                  <FilterButton active={dateRangeFilter === 'all'} onClick={() => { setDateRangeFilter('all'); handleFilterChange(); }} label="All" />
                  <FilterButton active={dateRangeFilter === 'lastMonth'} onClick={() => { setDateRangeFilter('lastMonth'); handleFilterChange(); }} label="1M" />
                  <FilterButton active={dateRangeFilter === 'last3Months'} onClick={() => { setDateRangeFilter('last3Months'); handleFilterChange(); }} label="3M" />
                  <FilterButton active={dateRangeFilter === 'last6Months'} onClick={() => { setDateRangeFilter('last6Months'); handleFilterChange(); }} label="6M" />
                  <FilterButton active={dateRangeFilter === 'lastYear'} onClick={() => { setDateRangeFilter('lastYear'); handleFilterChange(); }} label="1Y" />
                </div>
              </div>

              {/* Base Amount */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Base: £{Math.round(baseAmount)}</div>
                <input
                  type="range"
                  min="50"
                  max="2000"
                  step="50"
                  value={baseAmount}
                  onChange={(e) => { setBaseAmount(Number(e.target.value)); handleFilterChange(); }}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>

              {/* DCA Score */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>DCA Score: {minScoreFilter}–{maxScoreFilter}</div>
                <DualRangeSlider min={0} max={100} minValue={minScoreFilter} maxValue={maxScoreFilter} onMinChange={(v) => { setMinScoreFilter(v); handleFilterChange(); }} onMaxChange={(v) => { setMaxScoreFilter(v); handleFilterChange(); }} />
              </div>

              {/* Multiplier */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Multiplier: {minMultiplierFilter.toFixed(1)}–{maxMultiplierFilter.toFixed(1)}</div>
                <DualRangeSlider min={0} max={6} step={0.5} minValue={minMultiplierFilter} maxValue={maxMultiplierFilter} onMinChange={(v) => { setMinMultiplierFilter(v); handleFilterChange(); }} onMaxChange={(v) => { setMaxMultiplierFilter(v); handleFilterChange(); }} />
              </div>

              {/* Factor Regime */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Factor Regime: {minFactorRegime}–{maxFactorRegime}</div>
                <DualRangeSlider
                  min={-40}
                  max={40}
                  minValue={minFactorRegime}
                  maxValue={maxFactorRegime}
                  onMinChange={(v) => { setMinFactorRegime(v); handleFilterChange(); }}
                  onMaxChange={(v) => { setMaxFactorRegime(v); handleFilterChange(); }}
                />
              </div>

              {/* Volatility Timing */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Vol Timing: {minVolTiming}–{maxVolTiming}</div>
                <DualRangeSlider
                  min={-30}
                  max={30}
                  minValue={minVolTiming}
                  maxValue={maxVolTiming}
                  onMinChange={(v) => { setMinVolTiming(v); handleFilterChange(); }}
                  onMaxChange={(v) => { setMaxVolTiming(v); handleFilterChange(); }}
                />
              </div>

              {/* Mean Reversion */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Mean Reversion: {minMeanReversion}–{maxMeanReversion}</div>
                <DualRangeSlider
                  min={-30}
                  max={30}
                  minValue={minMeanReversion}
                  maxValue={maxMeanReversion}
                  onMinChange={(v) => { setMinMeanReversion(v); handleFilterChange(); }}
                  onMaxChange={(v) => { setMaxMeanReversion(v); handleFilterChange(); }}
                />
              </div>

              {/* Exit Score */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>
                  Exit Score: {minExitScoreFilter === 0 ? 'Off' : `${minExitScoreFilter.toFixed(1)}${maxExitScoreFilter >= 9 ? '+' : `–${maxExitScoreFilter.toFixed(1)}`}`}
                </div>
                <DualRangeSlider
                  min={0}
                  max={9}
                  step={0.5}
                  minValue={minExitScoreFilter}
                  maxValue={maxExitScoreFilter}
                  onMinChange={(v) => { setMinExitScoreFilter(v); handleFilterChange(); }}
                  onMaxChange={(v) => { setMaxExitScoreFilter(v); handleFilterChange(); }}
                />
              </div>
            </div>
          </div>

          {/* OPTIONAL SETTINGS SECTION (COLLAPSIBLE) */}
          <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
            {/* Section Header */}
            <button
              onClick={() => setOptionalSettingsOpen(!optionalSettingsOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '12px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border-elevated)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)' }}>
                Optional Settings
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-2)', transform: optionalSettingsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
            </button>

            {/* Collapsible Content */}
            {optionalSettingsOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', width: '100%' }}>
                {/* Search */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Search</div>
                  <input type="text" value={tickerSearch} onChange={(e) => { setTickerSearch(e.target.value); handleFilterChange(); }} placeholder="Ticker..." style={{ padding: '7px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text)', width: '100%' }} />
                </div>

                {/* Historic Period */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Compare To</div>
                  <select
                    value={historicalYear}
                    onChange={(e) => { setHistoricalYear(e.target.value as any); handleFilterChange(); }}
                    style={{
                      padding: '7px 8px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                      width: '100%',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="none">None</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                    <option value="2021">2021</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Status</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                    <FilterButton active={statusFilter === 'all'} onClick={() => { setStatusFilter('all'); handleFilterChange(); }} label="All" />
                    <FilterButton active={statusFilter === 'open'} onClick={() => { setStatusFilter('open'); handleFilterChange(); }} label="Open" />
                    <FilterButton active={statusFilter === 'closed'} onClick={() => { setStatusFilter('closed'); handleFilterChange(); }} label="Closed" />
                  </div>
                </div>

                {/* Exit Timing */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Exit Timing</div>
                  <button
                    onClick={() => { setExitAtNextOpen(v => !v); handleFilterChange(); }}
                    style={{
                      padding: '7px 8px',
                      background: exitAtNextOpen ? 'rgba(6,118,141,0.15)' : 'var(--surface)',
                      border: '1px solid ' + (exitAtNextOpen ? 'var(--cyan)' : 'var(--border)'),
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: '600',
                      color: exitAtNextOpen ? 'var(--cyan)' : 'var(--text-2)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      width: '100%',
                    }}
                  >
                    {exitAtNextOpen ? '✓ Next Open' : 'Close'}
                  </button>
                </div>

                {/* Max Months Hold */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Max Weeks to Hold: {maxMonthsHold === 0 ? 'Off' : `${maxMonthsHold}m`}</div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="1"
                    value={maxMonthsHold}
                    onChange={(e) => { setMaxMonthsHold(Number(e.target.value)); handleFilterChange(); }}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                </div>

                {/* Conviction */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Conviction: {minConvictionFilter}–{maxConvictionFilter}</div>
                  <DualRangeSlider min={0} max={100} minValue={minConvictionFilter} maxValue={maxConvictionFilter} onMinChange={(v) => { setMinConvictionFilter(v); handleFilterChange(); }} onMaxChange={(v) => { setMaxConvictionFilter(v); handleFilterChange(); }} />
                </div>

                {/* Fundamental */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Fundamental: {minFundamentalFilter}–{maxFundamentalFilter}</div>
                  <DualRangeSlider min={0} max={100} minValue={minFundamentalFilter} maxValue={maxFundamentalFilter} onMinChange={(v) => { setMinFundamentalFilter(v); handleFilterChange(); }} onMaxChange={(v) => { setMaxFundamentalFilter(v); handleFilterChange(); }} />
                </div>

                {/* Current Macro Regime */}
                {currentRegime && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)', marginBottom: '6px' }}>Current Macro Regime</div>
                    <div style={{ display: 'inline-block', padding: '5px 10px', background: 'var(--teal-dim, rgba(0,196,167,0.12))', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: 'var(--teal)' }}>
                      {currentRegime}
                    </div>
                  </div>
                )}

                {/* Sector */}
                <div>
                  <button
                    onClick={() => setSectorPanelOpen(!sectorPanelOpen)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '7px 8px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-2)' }}>
                      Sector: {sectorFilters.length === 0 ? 'All' : sectorFilters.length === 1 ? sectorFilters[0] : `${sectorFilters.length}`}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-2)', transform: sectorPanelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
                  </button>
                  {sectorPanelOpen && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginTop: '6px' }}>
                      <FilterButton active={sectorFilters.length === 0} onClick={() => { setSectorFilters([]); handleFilterChange(); }} label="All" />
                      {uniqueSectors.map((sector) => (
                        <FilterButton
                          key={sector}
                          active={sectorFilters.includes(sector)}
                          onClick={() => { setSectorFilters(prev => prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]); handleFilterChange(); }}
                          label={sector}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reset & Calculate Buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={resetFilters}
              style={{
                flex: 1,
                padding: '7px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '600',
                color: 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
            {filtersChanged && (
              <button onClick={() => { setShowDashboard(true); setFiltersChanged(false); }} style={{ flex: 1, padding: '7px 10px', background: 'var(--teal)', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', color: '#000', cursor: 'pointer' }}>
                📊 Calculate
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Performance Tiles + Strategy Cards */}
        <div style={{ display: 'grid', gap: '12px', minWidth: 0 }}>
          {/* Performance Tiles - Always visible */}
          <PerformanceTiles invested={fullStats.totalInvested} currentValue={fullStats.totalValue} totalReturn={fullStats.totalReturn} medianReturn={fullStats.medianReturn} avgReturn={fullStats.totalReturn} winRate={fullStats.winRate} winCount={fullStats.winCount} validCount={fullStats.validCount} signalCount={fullStats.signalCount} avgMultiplier={fullStats.avgMultiplier} maxDrawdown={0} profitExcludingTop5={0} totalProfit={fullStats.totalValue - fullStats.totalInvested} />

          {/* Buy & Hold and Bought & Sold Strategy Cards - 2 column grid */}
          <MonthlyStrategyCards
            data={cardData}
            minExitScoreFilter={minExitScoreFilter}
            maxExitScoreFilter={maxExitScoreFilter}
            spyReturn={spyReturn}
          />
        </div>
      </div>

      {/* Full-Width Table at Bottom */}
      <MonthlySignalsTable
        data={data}
        tickerSearch={tickerSearch}
        setTickerSearch={setTickerSearch}
        returnFilter={returnFilter}
        setReturnFilter={setReturnFilter}
        dateRangeFilter={dateRangeFilter}
        setDateRangeFilter={setDateRangeFilter}
        sectorFilters={sectorFilters}
        setSectorFilters={setSectorFilters}
        minScoreFilter={minScoreFilter}
        setMinScoreFilter={setMinScoreFilter}
        maxScoreFilter={maxScoreFilter}
        setMaxScoreFilter={setMaxScoreFilter}
        minMultiplierFilter={minMultiplierFilter}
        setMinMultiplierFilter={setMinMultiplierFilter}
        maxMultiplierFilter={maxMultiplierFilter}
        setMaxMultiplierFilter={setMaxMultiplierFilter}
        minConvictionFilter={minConvictionFilter}
        setMinConvictionFilter={setMinConvictionFilter}
        maxConvictionFilter={maxConvictionFilter}
        setMaxConvictionFilter={setMaxConvictionFilter}
        minFundamentalFilter={minFundamentalFilter}
        setMinFundamentalFilter={setMinFundamentalFilter}
        maxFundamentalFilter={maxFundamentalFilter}
        setMaxFundamentalFilter={setMaxFundamentalFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        minExitScoreFilter={minExitScoreFilter}
        setMinExitScoreFilter={setMinExitScoreFilter}
        maxExitScoreFilter={maxExitScoreFilter}
        setMaxExitScoreFilter={setMaxExitScoreFilter}
        minFactorRegime={minFactorRegime}
        setMinFactorRegime={setMinFactorRegime}
        maxFactorRegime={maxFactorRegime}
        setMaxFactorRegime={setMaxFactorRegime}
        minVolTiming={minVolTiming}
        setMinVolTiming={setMinVolTiming}
        maxVolTiming={maxVolTiming}
        setMaxVolTiming={setMaxVolTiming}
        minMeanReversion={minMeanReversion}
        setMinMeanReversion={setMinMeanReversion}
        maxMeanReversion={maxMeanReversion}
        setMaxMeanReversion={setMaxMeanReversion}
        exitAtNextOpen={exitAtNextOpen}
        setExitAtNextOpen={setExitAtNextOpen}
        maxMonthsHold={maxMonthsHold}
        setMaxMonthsHold={setMaxMonthsHold}
        historicalYear={historicalYear}
        setHistoricalYear={setHistoricalYear}
        baseAmount={baseAmount}
        setBaseAmount={setBaseAmount}
      />

      <style jsx global>{`
        input[type='range'] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 5px;
          background: var(--border);
          border-radius: 5px;
          outline: none;
          cursor: pointer;
        }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #06768d;
          border: 2px solid #fff;
          cursor: pointer;
        }
        input[type='range']::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #06768d;
          border: 2px solid #fff;
          cursor: pointer;
        }
        input[type='range']::-moz-range-track {
          background: transparent;
          border: none;
        }
        .dual-range input[type='range'] {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 20px;
          margin: 0;
          background: transparent;
          -webkit-appearance: none;
          appearance: none;
          pointer-events: none;
        }
        .dual-range input[type='range']::-webkit-slider-runnable-track {
          background: transparent;
          -webkit-appearance: none;
        }
        .dual-range input[type='range']::-moz-range-track {
          background: transparent;
        }
        .dual-range input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          pointer-events: auto;
          cursor: pointer;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #06768d;
          border: 2px solid #fff;
        }
        .dual-range input[type='range']::-moz-range-thumb {
          pointer-events: auto;
          cursor: pointer;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #06768d;
          border: 2px solid #fff;
        }
      `}</style>
    </>
  );
}
