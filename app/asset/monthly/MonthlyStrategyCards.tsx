'use client';

import { useMemo, type ReactNode } from 'react';

interface SignalRow {
  ticker: string;
  signalDate: string | null;
  invested: number | null;
  performance: number | null;
  currentValue: number | null;
  exitAdjustedPerformance: number | null;
  exitAdjustedValue: number | null;
  exitDate: string | null;
  exitOpen: boolean;
  exitScore: number | null;
  displayPerformance?: number | null;
  displayCurrentValue?: number | null;
}

interface StrategyStats {
  count: number;
  totalInvested: number;
  totalValue: number;
  totalReturnPct: number | null;
  avgReturn: number | null;
  medianReturn: number | null;
  winRate: number | null;
  winCount: number;
  validCount: number;
}

const EXIT_SCORE_SLIDER_MAX = 9;

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPerformance(perf: number | null): string {
  if (perf === null) return '—';
  const sign = perf >= 0 ? '+' : '';
  return `${sign}${perf.toFixed(1)}%`;
}

function getPerformanceColor(perf: number | null): string {
  if (perf === null) return 'var(--text-2)';
  if (perf >= 0) return 'var(--green)';
  return '#E24B4A';
}

function formatDuration(days: number): string {
  if (days < 60) return `${Math.round(days)}d`;
  return `${(days / 30).toFixed(1)}mo`;
}

function getHoldingDays(row: SignalRow): number | null {
  if (!row.signalDate) return null;
  const days = (Date.now() - new Date(row.signalDate).getTime()) / (1000 * 60 * 60 * 24);
  return days > 0 ? Math.max(days, 7) : null;
}

function aggregateStats(rows: SignalRow[], mode: 'buyhold' | 'sold'): StrategyStats {
  const perfOf = (r: SignalRow) => (mode === 'buyhold' ? r.performance : r.displayPerformance ?? r.performance);
  const valueOf = (r: SignalRow) => (mode === 'buyhold' ? r.currentValue : r.displayCurrentValue ?? r.currentValue);

  const totalInvested = rows.reduce((sum, r) => sum + (r.invested || 0), 0);
  const totalValue = rows.reduce((sum, r) => sum + (valueOf(r) || 0), 0);
  const perfs = rows.map(perfOf).filter((p): p is number => p !== null && p !== undefined);
  const sortedPerfs = [...perfs].sort((a, b) => a - b);
  const mid = Math.floor(sortedPerfs.length / 2);
  const winCount = perfs.filter(p => p >= 0).length;

  return {
    count: rows.length,
    totalInvested,
    totalValue,
    totalReturnPct: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : null,
    avgReturn: perfs.length ? perfs.reduce((a, b) => a + b, 0) / perfs.length : null,
    medianReturn: sortedPerfs.length
      ? (sortedPerfs.length % 2 ? sortedPerfs[mid] : (sortedPerfs[mid - 1] + sortedPerfs[mid]) / 2)
      : null,
    winRate: perfs.length ? (winCount / perfs.length) * 100 : null,
    winCount,
    validCount: perfs.length,
  };
}

function computeMinStartingCapital(rows: SignalRow[]): { minCapital: number; endingValue: number } {
  const events: { date: number; amount: number }[] = [];
  for (const r of rows) {
    if (r.signalDate && r.invested !== null) {
      events.push({ date: new Date(r.signalDate).getTime(), amount: -r.invested });
    }
    if (!r.exitOpen && r.exitDate && r.exitAdjustedValue !== null) {
      events.push({ date: new Date(r.exitDate).getTime(), amount: r.exitAdjustedValue });
    }
  }
  events.sort((a, b) => a.date - b.date || b.amount - a.amount);

  let balance = 0;
  let minBalance = 0;
  for (const e of events) {
    balance += e.amount;
    if (balance < minBalance) minBalance = balance;
  }

  const openValue = rows.filter(r => r.exitOpen).reduce((sum, r) => sum + (r.currentValue || 0), 0);
  const minCapital = Math.max(0, -minBalance);
  return { minCapital, endingValue: minCapital + balance + openValue };
}

const StatLine = ({ label, value, color }: { label: string; value: ReactNode; color?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', padding: '3px 0' }}>
    <span style={{ color: 'var(--text-2)' }}>{label}</span>
    <span style={{ fontWeight: '600', color: color || 'var(--text)', fontFamily: 'DM Mono, monospace', textAlign: 'right' }}>{value}</span>
  </div>
);

export function MonthlyStrategyCards({
  data,
  minExitScoreFilter,
  maxExitScoreFilter,
  spyReturn,
}: {
  data: SignalRow[];
  minExitScoreFilter: number;
  maxExitScoreFilter: number;
  spyReturn: number | null;
}) {
  const buyHoldStats = useMemo(() => aggregateStats(data, 'buyhold'), [data]);
  const soldStats = useMemo(() => aggregateStats(data, 'sold'), [data]);
  const minStartingCapital = useMemo(() => computeMinStartingCapital(data), [data]);

  const soldReturnPct = minStartingCapital.minCapital > 0
    ? ((minStartingCapital.endingValue - minStartingCapital.minCapital) / minStartingCapital.minCapital) * 100
    : null;


  const soldExtra = useMemo(() => {
    const closed = data.filter(r => !r.exitOpen);
    const open = data.filter(r => r.exitOpen);
    const closedWithDates = closed.filter(r => r.exitDate && r.signalDate);
    const holdDays = closedWithDates.map(r => (new Date(r.exitDate as string).getTime() - new Date(r.signalDate as string).getTime()) / (1000 * 60 * 60 * 24));
    const closedWithScore = closed.filter(r => r.exitScore !== null);
    const avgPerf = (rows: SignalRow[]) => {
      const perfs = rows.map(r => r.displayPerformance).filter((p): p is number => p !== null && p !== undefined);
      return perfs.length ? perfs.reduce((a, b) => a + b, 0) / perfs.length : null;
    };
    const profitOf = (rows: SignalRow[]) =>
      rows.reduce((sum, r) => sum + ((r.displayCurrentValue ?? r.currentValue ?? 0) - (r.invested ?? 0)), 0);
    return {
      openCount: open.length,
      closedCount: closed.length,
      closedProfit: profitOf(closed),
      openProfit: profitOf(open),
      closedAvgReturn: avgPerf(closed),
      openAvgReturn: avgPerf(open),
      avgHoldDays: holdDays.length ? holdDays.reduce((a, b) => a + b, 0) / holdDays.length : null,
      avgExitScore: closedWithScore.length ? closedWithScore.reduce((a, b) => a + (b.exitScore as number), 0) / closedWithScore.length : null,
    };
  }, [data]);

  const gridColumns = minExitScoreFilter > 0 ? '1fr 1fr' : '1fr';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: gridColumns, gap: '12px' }}>
      {/* Buy & Hold Card */}
      <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)', marginBottom: '10px' }}>
          Buy &amp; Hold
        </div>
        <div style={{ fontSize: '28px', fontWeight: '700', color: getPerformanceColor(buyHoldStats.totalReturnPct) }}>
          {buyHoldStats.totalReturnPct !== null ? formatPerformance(buyHoldStats.totalReturnPct) : '—'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '10px' }}>
          total return · every signal held to today · fixed baseline, doesn't change with Min Exit Score
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
          <StatLine label="Invested" value={formatCurrency(buyHoldStats.totalInvested)} />
          <StatLine label="Current Value" value={formatCurrency(buyHoldStats.totalValue)} />
          <StatLine label="Avg / Median Return" value={`${buyHoldStats.avgReturn !== null ? formatPerformance(buyHoldStats.avgReturn) : '—'} / ${buyHoldStats.medianReturn !== null ? formatPerformance(buyHoldStats.medianReturn) : '—'}`} />
          <StatLine label="Win Rate" value={`${buyHoldStats.winRate !== null ? buyHoldStats.winRate.toFixed(1) : '—'}% (${buyHoldStats.winCount}/${buyHoldStats.validCount})`} />
          <StatLine
            label="vs SPY"
            value={spyReturn !== null && buyHoldStats.totalReturnPct !== null ? formatPerformance(buyHoldStats.totalReturnPct - spyReturn) : '—'}
            color={spyReturn !== null && buyHoldStats.totalReturnPct !== null ? getPerformanceColor(buyHoldStats.totalReturnPct - spyReturn) : undefined}
          />
          <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', lineHeight: '1.4' }}>
            Compared to SPY's return over the same signal period.
          </div>
        </div>
      </div>

      {/* Bought & Sold Card — only appears once Min Exit Score > 0 */}
      {minExitScoreFilter > 0 && (
        <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--teal)', borderRadius: '12px', padding: '16px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--teal)' }}>
              Bought &amp; Sold
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>
              score {minExitScoreFilter.toFixed(1)}{maxExitScoreFilter >= EXIT_SCORE_SLIDER_MAX ? '+' : ` – ${maxExitScoreFilter.toFixed(1)}`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: getPerformanceColor(soldReturnPct) }}>
              {soldReturnPct !== null ? formatPerformance(soldReturnPct) : '—'}
            </div>
            {soldReturnPct !== null && buyHoldStats.totalReturnPct !== null && (() => {
              const delta = soldReturnPct - buyHoldStats.totalReturnPct!;
              return (
                <div style={{ fontSize: '12px', fontWeight: '600', color: getPerformanceColor(delta) }}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs Buy &amp; Hold
                </div>
              );
            })()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '10px' }}>
            return on capital actually required · selling once a signal's own exit score clears the bar
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
            <StatLine label="Current Value" value={formatCurrency(minStartingCapital.endingValue)} />
            <StatLine label="Win Rate" value={`${soldStats.winRate !== null ? soldStats.winRate.toFixed(1) : '—'}%`} />
            <StatLine label="Avg Hold Time (closed)" value={soldExtra.avgHoldDays !== null ? formatDuration(soldExtra.avgHoldDays) : '—'} />
            <StatLine label="Avg Exit Score (closed)" value={soldExtra.avgExitScore !== null ? soldExtra.avgExitScore.toFixed(1) : '—'} />
          </div>

          {/* Realized vs still-open split */}
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', fontSize: '11px' }}>
              <div />
              <div style={{ color: 'var(--text-2)', textAlign: 'right' }}>Closed</div>
              <div style={{ color: 'var(--text-2)', textAlign: 'right' }}>Still Open</div>

              <div style={{ color: 'var(--text-2)' }}>Signals</div>
              <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{soldExtra.closedCount}</div>
              <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>{soldExtra.openCount}</div>

              <div style={{ color: 'var(--text-2)' }}>Profit</div>
              <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: getPerformanceColor(soldExtra.closedProfit) }}>{formatCurrency(soldExtra.closedProfit)}</div>
              <div style={{ textAlign: 'right', fontFamily: 'DM Mono, monospace', color: getPerformanceColor(soldExtra.openProfit) }}>{formatCurrency(soldExtra.openProfit)}</div>

              <div style={{ color: 'var(--text-2)' }}>Avg Return</div>
              <div style={{ textAlign: 'right', fontWeight: '600', color: getPerformanceColor(soldExtra.closedAvgReturn) }}>
                {soldExtra.closedAvgReturn !== null ? formatPerformance(soldExtra.closedAvgReturn) : '—'}
              </div>
              <div style={{ textAlign: 'right', fontWeight: '600', color: getPerformanceColor(soldExtra.openAvgReturn) }}>
                {soldExtra.openAvgReturn !== null ? formatPerformance(soldExtra.openAvgReturn) : '—'}
              </div>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '6px', lineHeight: '1.4' }}>
              Closed = realized profit banked from sales; Still Open = unrealized gain marked-to-market at today's price, not yet past the threshold
            </div>
          </div>

          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <StatLine label="Min Starting Capital" value={formatCurrency(minStartingCapital.minCapital)} />
            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px', lineHeight: '1.4' }}>
              Smallest cash balance that could fund every buy above from that cash plus earlier sale proceeds — never going negative. Min Starting Capital + Closed Profit + Open Profit = Current Value ({formatCurrency(minStartingCapital.minCapital)} + {formatCurrency(soldExtra.closedProfit)} + {formatCurrency(soldExtra.openProfit)} = {formatCurrency(minStartingCapital.endingValue)}).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
