'use client';

import Link from 'next/link';
import type { CurrentReading, MajorBuy } from '@/lib/ticker/data';
import { CurrentSignalTile } from './CurrentSignalTile';
import { formatCurrency } from '@/lib/formatters';

interface SignalDataSectionProps {
  ticker: string;
  weeklyMajor: MajorBuy | null;
  monthlyMajor: MajorBuy | null;
  currentWeekly: CurrentReading | null;
  currentMonthly: CurrentReading | null;
  universeCount: number;
}

function formatPerformance(perf: number): string {
  const sign = perf >= 0 ? '+' : '';
  return `${sign}${perf.toFixed(1)}%`;
}

function getPerformanceColor(perf: number): string {
  if (perf >= 0) return 'var(--green)';
  return '#E24B4A';
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SignalDataSection({ ticker, weeklyMajor, monthlyMajor, currentWeekly, currentMonthly, universeCount }: SignalDataSectionProps) {
  // Return to date is measured from the real fill price (next open) to the latest close. It stays empty
  // until that fill price exists, which is the day after the signal.
  const weeklyPerf = weeklyMajor && weeklyMajor.performance !== null ? { ...weeklyMajor, performance: weeklyMajor.performance as number, currentValue: weeklyMajor.currentValue as number } : null;
  const monthlyPerf = monthlyMajor && monthlyMajor.performance !== null ? { ...monthlyMajor, performance: monthlyMajor.performance as number, currentValue: monthlyMajor.currentValue as number } : null;

  const avgPerf = weeklyPerf && monthlyPerf ? (weeklyPerf.performance + monthlyPerf.performance) / 2 : weeklyPerf?.performance ?? monthlyPerf?.performance ?? null;
  const heading = avgPerf !== null ? (avgPerf >= 0 ? 'Alpha you missed while unsubscribed' : 'Performance snapshot while unsubscribed') : 'Recent buy signals';
  const description = avgPerf !== null ? (avgPerf >= 0 ? 'Our Pro members bought these signals. Here\'s what the returns look like — and what was left on the table.' : 'Our Pro members bought these signals. Here\'s how they performed — a real look at what happened in the market.') : 'Our Pro members acted on these signals. Here\'s what happened.';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E24B4A', flexShrink: 0 }} />
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Pro subscribers only
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)', marginLeft: '4px' }}>
          <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m0 4.24l4.24 4.24M19.78 4.22l-4.24 4.24m0 4.24l-4.24 4.24" />
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
          <path d="M9 10h6v4H9z" />
        </svg>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>
          {heading}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0, lineHeight: '1.6' }}>
          {description}
        </p>
      </div>

      <div className="rs-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        {/* Weekly Card */}
        <div style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-elevated)',
          borderTop: '3px solid #E24B4A',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: 'var(--inset-top), var(--shadow-md)'
        }}>
          {/* Lock Icon Top Right */}
          <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div style={{ fontSize: '9px', color: 'var(--text-3)', textAlign: 'center', maxWidth: '50px', lineHeight: '1.2' }}>
              You weren't subscribed
            </div>
          </div>

          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text)', marginBottom: '8px' }}>
            Major Weekly Buy Signal
          </div>

          {weeklyPerf ? (
            <>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '10px', paddingRight: '60px' }}>
                Signal issued <span style={{ fontWeight: '600', color: 'var(--text)' }}>{formatDateForDisplay(weeklyPerf.date)}</span> when our algorithm told users to buy ↗ <span style={{ fontWeight: '600', color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>{formatCurrency(weeklyPerf.invested)}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: getPerformanceColor(weeklyPerf.performance) }}>
                  {formatPerformance(weeklyPerf.performance)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>return to date</div>
              </div>

              <div style={{
                background: 'rgba(40,217,126,0.08)',
                border: '1px solid rgba(40,217,126,0.2)',
                borderRadius: '8px',
                padding: '8px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>Current value of {formatCurrency(weeklyPerf.invested)} position</div>
                <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'DM Mono, monospace', color: getPerformanceColor(weeklyPerf.performance) }}>
                  {formatCurrency(weeklyPerf.currentValue)}
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>No major buy signals yet</div>
          )}
        </div>

        {/* Monthly Card */}
        <div style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-elevated)',
          borderTop: '3px solid #E24B4A',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: 'var(--inset-top), var(--shadow-md)'
        }}>
          {/* Lock Icon Top Right */}
          <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div style={{ fontSize: '9px', color: 'var(--text-3)', textAlign: 'center', maxWidth: '50px', lineHeight: '1.2' }}>
              You weren't subscribed
            </div>
          </div>

          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text)', marginBottom: '8px' }}>
            Major Monthly Buy Signal
          </div>

          {monthlyPerf ? (
            <>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '10px', paddingRight: '60px' }}>
                Signal issued <span style={{ fontWeight: '600', color: 'var(--text)' }}>{formatDateForDisplay(monthlyPerf.date)}</span> when our algorithm told users to buy ↗ <span style={{ fontWeight: '600', color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>{formatCurrency(monthlyPerf.invested)}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: getPerformanceColor(monthlyPerf.performance) }}>
                  {formatPerformance(monthlyPerf.performance)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>return to date</div>
              </div>

              <div style={{
                background: 'rgba(40,217,126,0.08)',
                border: '1px solid rgba(40,217,126,0.2)',
                borderRadius: '8px',
                padding: '8px 10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>Current value of {formatCurrency(monthlyPerf.invested)} position</div>
                <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'DM Mono, monospace', color: getPerformanceColor(monthlyPerf.performance) }}>
                  {formatCurrency(monthlyPerf.currentValue)}
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--text-2)' }}>No major buy signals yet</div>
          )}
        </div>

        {/* Latest Major Buy Signal Tile */}
        <CurrentSignalTile ticker={ticker} weekly={currentWeekly} monthly={currentMonthly} />
      </div>

      <div className="rs-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        {/* Left Column - How Signal Works Button */}
        <Link href="/methodology" style={{ textDecoration: 'none' }}>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border-elevated)',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--text)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            boxShadow: 'var(--shadow-xs)',
            width: '100%'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            How the signal works
          </button>
        </Link>

        {/* Middle Column - Info Text */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: '700', textAlign: 'center' }}>
            Signals like these fire across {universeCount.toLocaleString()} assets
          </div>
        </div>

        {/* Right Column - Get Signal Button */}
        <Link href="/#pricing" style={{ textDecoration: 'none' }}>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: 'var(--teal)',
            border: '1px solid var(--teal)',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#000',
            cursor: 'pointer',
            transition: 'all 0.15s',
            width: '100%'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 196, 167, 0.9)';
            e.currentTarget.style.borderColor = 'rgba(0, 196, 167, 0.9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--teal)';
            e.currentTarget.style.borderColor = 'var(--teal)';
          }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            Get the next signal
          </button>
        </Link>
      </div>
    </div>
  );
}
