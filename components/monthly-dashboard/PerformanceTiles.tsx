'use client';

import { formatCurrency } from '@/lib/formatters';

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

interface Props {
  invested: number;
  currentValue: number;
  totalReturn: number | null;
  medianReturn: number | null;
  avgReturn: number | null;
  winRate: number | null;
  winCount: number;
  validCount: number;
  signalCount: number;
  avgMultiplier: number | null;
  maxDrawdown: number;
  profitExcludingTop5: number;
  totalProfit: number;
}

export function PerformanceTiles({
  invested,
  currentValue,
  totalReturn,
  medianReturn,
  avgReturn,
  winRate,
  winCount,
  validCount,
  signalCount,
  avgMultiplier,
  maxDrawdown,
  profitExcludingTop5,
  totalProfit,
}: Props) {
  const profit = currentValue - invested;

  return (
    <div
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-elevated)',
        borderRadius: '12px',
        padding: '16px 20px',
        boxShadow: 'var(--inset-top), var(--shadow-md)',
      }}
    >
      {/* Summary line */}
      <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '12px', lineHeight: '1.5' }}>
        {signalCount} signals · {avgMultiplier !== null ? `${avgMultiplier.toFixed(2)}×` : '—'} avg multiplier · median {formatPerformance(medianReturn)}
      </div>

      {/* Metrics in 5 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', fontSize: '12px' }}>
        {/* Total Return */}
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            Return
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: getPerformanceColor(totalReturn), lineHeight: '1' }}>
            {formatPerformance(totalReturn)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
            total
          </div>
        </div>

        {/* Capital */}
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            Invested
          </div>
          <div style={{ fontSize: '14px', fontFamily: 'DM Mono, monospace', fontWeight: '600', color: 'var(--text)' }}>
            {formatCurrency(invested)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
            deployed
          </div>
        </div>

        {/* Profit */}
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            Profit
          </div>
          <div style={{ fontSize: '14px', fontFamily: 'DM Mono, monospace', fontWeight: '600', color: profit >= 0 ? 'var(--green)' : '#E24B4A' }}>
            {formatCurrency(profit)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
            realized
          </div>
        </div>

        {/* Win Rate */}
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            Win Rate
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>
            {winRate !== null ? `${winRate.toFixed(0)}%` : '—'}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-3)', marginTop: '2px' }}>
            {winCount}/{validCount}
          </div>
        </div>

        {/* Risk */}
        <div>
          <div style={{ color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
            Max DD
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: maxDrawdown > 20 ? '#E24B4A' : 'var(--text)' }}>
            {maxDrawdown.toFixed(1)}%
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
            drawdown
          </div>
        </div>
      </div>
    </div>
  );
}
