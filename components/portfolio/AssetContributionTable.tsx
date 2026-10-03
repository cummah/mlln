'use client';

import { Panel, T, MONO, ratioAsPercent, signedRatioAsPercent } from './ui';

interface AssetMetric {
  ticker: string;
  return: number;
  volatility: number;
  sharpeRatio: number;
  contribution: number;
}

interface AssetContributionTableProps {
  assetMetrics: AssetMetric[];
  allocations: Record<string, number>;
  colors: Record<string, string>;
  /** Years of history the metrics were computed over, so the note can't drift. */
  lookbackYears: number;
  /** Actual first/last bar used — daily_prices can lag today by months. */
  windowStart: string | null;
  windowEnd: string | null;
  observations: number;
}

const HEADS: Array<{ key: string; label: string; align: 'left' | 'right'; hint?: string }> = [
  { key: 'ticker', label: 'Asset', align: 'left' },
  { key: 'alloc', label: 'Alloc', align: 'right' },
  { key: 'return', label: 'Return', align: 'right' },
  { key: 'vol', label: 'Vol', align: 'right' },
  { key: 'sharpe', label: 'Sharpe', align: 'right' },
  { key: 'risk', label: 'Risk share', align: 'right' },
];

export function AssetContributionTable({
  assetMetrics,
  allocations,
  colors,
  lookbackYears,
  windowStart,
  windowEnd,
  observations,
}: AssetContributionTableProps) {
  const sorted = [...assetMetrics].sort((a, b) => b.return - a.return);

  return (
    <Panel
      title="Per-Asset Metrics"
      hint={`Annualised from ${observations} trading days common to every asset. Sharpe uses a 5% risk-free rate. Risk share is each asset's contribution to portfolio volatility.`}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: T.body }}>
          <thead>
            <tr>
              {HEADS.map((head) => (
                <th
                  key={head.key}
                  scope="col"
                  style={{
                    textAlign: head.align,
                    padding: '0 0 6px',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-3)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {head.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((metric) => {
              const allocation = allocations[metric.ticker] ?? 0;
              const riskShare = Math.abs(metric.contribution) * 100;
              // An asset carrying materially more risk than its weight is the
              // single most actionable reading in this table.
              const riskHeavy = riskShare > allocation + 10;
              return (
                <tr key={metric.ticker} className="mlln-row" style={{ borderBottom: '1px solid var(--border)' }}>
                  <th scope="row" style={{ textAlign: 'left', padding: '7px 0', fontWeight: 600, color: 'var(--text)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                      <span
                        aria-hidden
                        style={{ width: '9px', height: '9px', borderRadius: '2px', background: colors[metric.ticker] ?? 'var(--teal)', flexShrink: 0 }}
                      />
                      {metric.ticker}
                    </span>
                  </th>
                  <td style={{ textAlign: 'right', padding: '7px 0', fontFamily: MONO, color: 'var(--text-2)' }}>{allocation.toFixed(0)}%</td>
                  {/* These four were formatPercent(ratio), which omits the ×100 —
                      a 24% annual return rendered as "+0.2%". */}
                  <td style={{ textAlign: 'right', padding: '7px 0', fontFamily: MONO, fontWeight: 600, color: metric.return >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {signedRatioAsPercent(metric.return)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '7px 0', fontFamily: MONO, color: 'var(--text-2)' }}>{ratioAsPercent(metric.volatility)}</td>
                  <td style={{ textAlign: 'right', padding: '7px 0', fontFamily: MONO, fontWeight: 600, color: metric.sharpeRatio >= 0 ? 'var(--teal)' : 'var(--red)' }}>
                    {metric.sharpeRatio.toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '7px 0', fontFamily: MONO, color: riskHeavy ? 'var(--red)' : 'var(--text-2)' }}>
                    {riskShare.toFixed(1)}%
                    {riskHeavy && (
                      <span title={`${metric.ticker} carries ${riskShare.toFixed(0)}% of portfolio risk on a ${allocation.toFixed(0)}% allocation`} style={{ marginLeft: '4px' }}>
                        ▲
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ margin: '8px 0 0', fontSize: T.label, color: 'var(--text-3)', lineHeight: 1.5 }}>
        <span style={{ color: 'var(--red)' }}>▲</span> carries more portfolio risk than its allocation.{' '}
        {/* States the window that was measured rather than the one requested —
            daily_prices can end months before today. */}
        {windowStart && windowEnd ? (
          <>
            Annualised from {observations} trading days, {windowStart} to {windowEnd}.
          </>
        ) : (
          <>Requested a {lookbackYears}-year window.</>
        )}
      </p>
    </Panel>
  );
}
