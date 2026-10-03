'use client';

import { Card } from '@/components/ui/Card';
import { SubscribeGate } from '@/components/gates/SubscribeGate';
import type { CurrentSignal, UserPlan } from '@/types';

const signalColors: Record<string, string> = {
  strong_dip: '#E24B4A',
  moderate_dip: '#BA7517',
  mild_dip: '#639922',
  mild_opportunity: '#639922',
  neutral: '#888780',
  overbought: '#BA7517',
};

const signalLabels: Record<string, string> = {
  strong_dip: 'Strong dip',
  moderate_dip: 'Moderate dip',
  mild_dip: 'Mild dip',
  mild_opportunity: 'Mild opportunity',
  neutral: 'Neutral',
  overbought: 'Overbought',
};

interface SignalGateProps {
  signal: CurrentSignal | null;
  plan: UserPlan;
}

export function SignalGate({ signal, plan }: SignalGateProps) {
  const isGated = !signal || (plan === 'free' || plan === null);

  return (
    <div className="grid grid-cols-2 gap-3.5 relative">
      {/* Signal Card */}
      <div className="bg-[var(--surface)] border border-[rgba(240,161,40,0.2)] rounded-[14px] p-5 relative overflow-hidden">
        <div className="absolute top-[-30px] right-[-30px] w-[120px] h-[120px] rounded-full bg-[radial-gradient(circle,rgba(240,161,40,0.12),transparent_70%)] pointer-events-none" />

        <div className={isGated ? 'blur-xl pointer-events-none select-none' : ''}>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-3)] mb-2 flex items-center gap-1.5">
            This week's signal
            <span className="inline-block px-1.75 py-0.5 rounded text-[10px] bg-[rgba(240,161,40,0.15)] text-[var(--amber)]">PRO</span>
          </div>
          <div className="text-[28px] font-bold font-mono tracking-[-0.5px] text-[var(--green)] mb-1.5">
            ${Math.round(signal?.amount || 0)}
          </div>
          <div className="text-[12px] text-[var(--text-2)] leading-relaxed mb-3.5">
            {signal?.reasoning || 'Market conditions suggest a buying opportunity this week. Your engine recommends deploying above your base amount.'}
          </div>
          <div className="p-3 bg-[var(--green-dim)] rounded-lg border border-[rgba(40,217,126,0.15)]">
            <div className="text-[11px] font-semibold text-[var(--green)] mb-0.5">Entry price context</div>
            <div className="text-[12px] text-[var(--text-2)]">
              ${Math.round(signal?.amount || 0)} deployed vs $100 standard · {Math.round(((signal?.mult || 1) - 1) * 100)}% lower cost basis
            </div>
          </div>
        </div>

        {isGated && (
          <div className="absolute inset-0 rounded-[14px] backdrop-blur-sm bg-[rgba(6,15,26,0.5)] flex flex-col items-center justify-center gap-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f0a128" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div className="text-[13px] font-semibold text-[var(--text)]">Unlock live signals</div>
            <div className="text-[11.5px] text-[var(--text-2)] text-center max-w-[200px]">
              Know exactly how much to invest each week
            </div>
            <button className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#f0a128] to-[#e08020] text-[#040e18] text-[13px] font-bold cursor-pointer border-none">
              Upgrade to Pro →
            </button>
          </div>
        )}
      </div>

      {/* How Enhanced DCA Works */}
      <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '14px', padding: '18px 20px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: '12px' }}>
          How Enhanced DCA works
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#28d97e" strokeWidth="2.5">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '2px' }}>Buy more at dips</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.4' }}>
                When RSI &lt; 40, the algorithm scales up your buy by up to 3× – concentrating capital at oversold prices
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00c4a7" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '2px' }}>Skip overbought weeks</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.4' }}>
                When RSI &gt; 70, buys are reduced or skipped entirely – preserving cash for better opportunities
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(240,161,40,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f0a128" strokeWidth="2.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', marginBottom: '2px' }}>Same base budget</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.4' }}>
                Your total annual capital deployed stays comparable – returns improve through timing, not more money
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
