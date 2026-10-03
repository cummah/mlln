'use client';

import { formatCurrency } from '@/lib/formatters';
import { Panel, T, MONO } from './ui';

interface EdgeCTATileProps {
  /** Dollar gain from Alpha over Standard DCA in the best window. */
  dollarGain: number;
  /** Total invested in the enhanced strategy for this period. */
  enhInvested: number;
  /** Period label (e.g., "5Y", "3Y", "1Y"). */
  periodLabel: string;
  /** Cadence label (e.g., "Weekly", "Monthly"). */
  cadenceLabel: string;
}

export function EdgeCTATile({
  dollarGain,
  enhInvested,
  periodLabel,
  cadenceLabel,
}: EdgeCTATileProps) {
  // Calculate subscription cost: $100/month
  const monthsMap: Record<string, number> = {
    '1y': 12,
    '3y': 36,
    '5y': 60,
  };
  const months = monthsMap[periodLabel.toLowerCase()] || 60;
  const subscriptionCost = 100 * months;

  const netGain = dollarGain - subscriptionCost;
  const alphaPercent = enhInvested > 0 ? (dollarGain / enhInvested) * 100 : 0;
  const extraInvestmentPercent = alphaPercent !== 0 ? (netGain / dollarGain) * 100 : 0;
  const subscriptionOfAlphaPercent = dollarGain > 0 ? (subscriptionCost / dollarGain) * 100 : 0;

  const isPositive = netGain >= 0;
  const color = isPositive ? 'var(--green)' : 'var(--red)';

  return (
    <Panel
      title="Signal Investment vs Gain"
      hint={`Net Alpha gain minus $${(subscriptionCost / months).toFixed(0)}/month subscription fee ($${subscriptionCost.toLocaleString()} total over ${months} months).`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ fontSize: T.label, color: 'var(--text-3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Net Gain
          </div>
          <div
            style={{
              fontSize: T.kpi,
              fontWeight: 600,
              fontFamily: MONO,
              color,
              lineHeight: 1.1,
            }}
          >
            {isPositive ? '+' : '−'}
            {formatCurrency(Math.abs(netGain))}
          </div>
          <div style={{ fontSize: T.label, color: 'var(--text-2)', marginTop: '6px', lineHeight: 1.4 }}>
            After deducting $100/month subscription fee on your {periodLabel.toLowerCase()} {cadenceLabel.toLowerCase()} portfolio.
          </div>
        </div>

        <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Cost to Enable
              </div>
              <div
                style={{
                  fontSize: T.heading,
                  fontWeight: 600,
                  fontFamily: MONO,
                  color: 'var(--text)',
                }}
              >
                {subscriptionOfAlphaPercent.toFixed(0)}%
              </div>
              <div style={{ fontSize: T.label, color: 'var(--text-3)', marginTop: '4px', lineHeight: 1.3 }}>
                of your Alpha gain
              </div>
            </div>

            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Remaining Gain
              </div>
              <div
                style={{
                  fontSize: T.heading,
                  fontWeight: 600,
                  fontFamily: MONO,
                  color: isPositive ? 'var(--green)' : 'var(--red)',
                }}
              >
                {extraInvestmentPercent.toFixed(0)}%
              </div>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: T.label, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Based on {periodLabel.toLowerCase()} historical backtests, live signals would help you keep <strong style={{ color: 'var(--text)' }}>{extraInvestmentPercent.toFixed(0)}%</strong> of the potential <strong style={{ color: 'var(--text)' }}>{formatCurrency(dollarGain)}</strong> gain.
          </p>
        </div>

        <button
          type="button"
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'var(--teal)',
            color: '#040e18',
            border: 'none',
            borderRadius: '5px',
            fontSize: T.label,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-xs)',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Get Live Signals for This Portfolio
        </button>
      </div>
    </Panel>
  );
}
