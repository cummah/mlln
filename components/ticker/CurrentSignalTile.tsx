'use client';

import { Signal, OHLCData } from '@/types';

interface CurrentSignalTileProps {
  weeklySignals: Signal[];
  monthlySignals: Signal[];
  ohlcData: OHLCData[];
}

function getLatestBuy(signals: Signal[]): Signal | null {
  const validSignals = signals.filter(s => !s.skipped);
  if (validSignals.length === 0) return null;
  return validSignals[validSignals.length - 1];
}

function getDaysUntilNextSignal(dateStr: string, cycleDays: number): number {
  const lastDate = new Date(dateStr);
  const now = new Date();

  let nextSignalDate = new Date(lastDate);
  nextSignalDate.setDate(nextSignalDate.getDate() + cycleDays);

  // If next signal date is in the past, keep adding cycles until we get a future date
  while (nextSignalDate <= now) {
    nextSignalDate.setDate(nextSignalDate.getDate() + cycleDays);
  }

  const diffMs = nextSignalDate.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return days;
}

function formatMultiplier(mult: number): string {
  if (mult === 0 || !mult) return '0%';
  return `${Math.round(mult * 100)}%`;
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function CurrentSignalTile({ weeklySignals, monthlySignals, ohlcData }: CurrentSignalTileProps) {
  const latestWeekly = getLatestBuy(weeklySignals);
  const latestMonthly = getLatestBuy(monthlySignals);
  const daysUntilWeekly = latestWeekly ? getDaysUntilNextSignal(latestWeekly.date, 7) : 0;
  const daysUntilMonthly = latestMonthly ? getDaysUntilNextSignal(latestMonthly.date, 30) : 0;

  return (
    <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '14px', padding: '18px 20px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text)', marginBottom: '8px' }}>
        Live Signal & Allocation %
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Weekly Buy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '4px' }}>
              Weekly Buy
            </div>
            {latestWeekly && <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '6px' }}>
              {formatDateForDisplay(latestWeekly.date)}
            </div>}
            <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>
              {latestWeekly ? formatMultiplier(latestWeekly.mult) : '−'}
            </div>
          </div>
          <div style={{ padding: '8px', background: 'rgba(40,217,126,0.05)', borderRadius: '8px', border: '1px solid rgba(40,217,126,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-2)' }}>
              Next signal in <span style={{ color: 'var(--green)', fontWeight: '700' }}>{daysUntilWeekly}</span> days
            </div>
          </div>
        </div>

        {/* Monthly Buy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '4px' }}>
              Monthly Buy
            </div>
            {latestMonthly && <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '6px' }}>
              {formatDateForDisplay(latestMonthly.date)}
            </div>}
            <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>
              {latestMonthly ? formatMultiplier(latestMonthly.mult) : '−'}
            </div>
          </div>
          <div style={{ padding: '8px', background: 'rgba(40,217,126,0.05)', borderRadius: '8px', border: '1px solid rgba(40,217,126,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-2)' }}>
              Next signal in <span style={{ color: 'var(--green)', fontWeight: '700' }}>{daysUntilMonthly}</span> days
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
