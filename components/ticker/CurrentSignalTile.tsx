'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { CurrentReading } from '@/lib/ticker/data';
import type { UserTier } from '@/types';

interface CurrentSignalTileProps {
  ticker: string;
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

function Half({ label, reading, freq, ticker, canViewAllocation }: { label: string; reading: CurrentReading | null; freq: 'weekly' | 'monthly'; ticker: string; canViewAllocation: boolean }) {
  const isStale = reading && (() => {
    const signalDate = new Date(reading.signalDate + 'T12:00:00Z');
    const now = new Date();
    const daysOld = (now.getTime() - signalDate.getTime()) / (1000 * 60 * 60 * 24);
    const threshold = freq === 'weekly' ? 7 : 30;
    return daysOld > threshold;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div>
        <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '4px' }}>{label}</div>
        {reading && (
          <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '6px' }}>
            Latest signal: {formatDateForDisplay(reading.signalDate)}
          </div>
        )}
        <div style={{ fontSize: '22px', fontWeight: '700', fontFamily: 'DM Mono, monospace', color: reading && reading.mult > 0 ? 'var(--green)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {canViewAllocation ? (
            <>
              <span>{reading ? formatMultiplier(reading.mult) : 'n/a'}</span>
              {isStale && <span style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: '400' }}>— No buy since then</span>}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-2)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Pro only
            </div>
          )}
        </div>
        {reading && reading.mult === 0 && <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>No buy at this reading</div>}
      </div>
      <div style={{ padding: '8px', background: 'rgba(40,217,126,0.05)', borderRadius: '8px', border: '1px solid rgba(40,217,126,0.1)', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-2)' }}>
          {reading ? <>Next signal on or after <span style={{ color: 'var(--green)', fontWeight: '700' }}>{formatDateForDisplay(nextEvaluation(reading.signalDate, freq))}</span></> : 'Not enough history yet'}
        </div>
      </div>
    </div>
  );
}

export function CurrentSignalTile({ ticker, weekly, monthly }: CurrentSignalTileProps) {
  const [canViewAllocation, setCanViewAllocation] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setCanViewAllocation(false);
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase.from('profiles').select('tier').eq('user_id', user.id).single();
        const tier = profile?.tier ?? 0;

        if (tier >= 2) {
          setCanViewAllocation(true);
        } else if (tier === 1) {
          const { data: assets } = await supabase.from('user_assets').select('ticker').eq('user_id', user.id);
          const hasAsset = (assets ?? []).some(a => a.ticker === ticker);
          setCanViewAllocation(hasAsset);
        } else {
          setCanViewAllocation(false);
        }
      } catch (err) {
        console.error('[CurrentSignalTile] Error checking access:', err);
        setCanViewAllocation(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [ticker]);

  return (
    <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '14px', padding: '18px 20px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text)', marginBottom: '8px' }}>
        Latest Signal & Allocation
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <Half label="Weekly Buy" reading={weekly} freq="weekly" ticker={ticker} canViewAllocation={canViewAllocation} />
        <Half label="Monthly Buy" reading={monthly} freq="monthly" ticker={ticker} canViewAllocation={canViewAllocation} />
      </div>
    </div>
  );
}
