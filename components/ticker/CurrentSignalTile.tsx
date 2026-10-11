'use client';

import type { CurrentReading } from '@/lib/ticker/data';

interface CurrentSignalTileProps {
  weekly: CurrentReading | null;
  monthly: CurrentReading | null;
}

function formatMultiplier(mult: number): string {
  return `${Math.round(mult * 100)}%`;
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00Z');
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The date a new weekly or monthly signal is next evaluated: the first trading day of the next week or month
 * on or after this date. It is calendar based, so a market holiday can move it by a day.
 */
function nextEvaluation(asOf: string, freq: 'weekly' | 'monthly'): string {
  const d = new Date(asOf + 'T12:00:00Z');
  if (freq === 'weekly') {
    const day = d.getUTCDay() || 7; // Monday is 1
    d.setUTCDate(d.getUTCDate() + (8 - day));
  } else {
    d.setUTCMonth(d.getUTCMonth() + 1, 1);
    const dow = d.getUTCDay();
    if (dow === 6) d.setUTCDate(d.getUTCDate() + 2);
    if (dow === 0) d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

function Half({ label, reading, freq }: { label: string; reading: CurrentReading | null; freq: 'weekly' | 'monthly' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div>
        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '4px' }}>{label}</div>
        {reading && <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '6px' }}>As of {formatDateForDisplay(reading.asOf)} close</div>}
        <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'DM Mono, monospace', color: reading && reading.mult > 0 ? 'var(--green)' : 'var(--text-3)' }}>
          {reading ? formatMultiplier(reading.mult) : 'n/a'}
        </div>
        {reading && reading.mult === 0 && <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>No buy at this reading</div>}
      </div>
      <div style={{ padding: '8px', background: 'rgba(40,217,126,0.05)', borderRadius: '8px', border: '1px solid rgba(40,217,126,0.1)', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-2)' }}>
          {reading ? <>Next signal on or after <span style={{ color: 'var(--green)', fontWeight: '700' }}>{formatDateForDisplay(nextEvaluation(reading.asOf, freq))}</span></> : 'Not enough history yet'}
        </div>
      </div>
    </div>
  );
}

export function CurrentSignalTile({ weekly, monthly }: CurrentSignalTileProps) {
  return (
    <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '14px', padding: '18px 20px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text)', marginBottom: '8px' }}>
        Live Signal & Allocation %
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Half label="Weekly Buy" reading={weekly} freq="weekly" />
        <Half label="Monthly Buy" reading={monthly} freq="monthly" />
      </div>
    </div>
  );
}
