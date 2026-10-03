'use client';

import React from 'react';
import { formatCurrency } from '@/lib/formatters';
import type { SensitivityRow } from '@/lib/monthly-dashboard-utils';

interface TopContributor {
  ticker: string;
  profit: number;
  return: number;
  invested: number;
}

interface Props {
  sensitivityTable: SensitivityRow[];
  topGainers: TopContributor[];
  topLosers: TopContributor[];
  profitExcludingTop5: number;
  totalProfit: number;
}

function formatPerformance(perf: number): string {
  const sign = perf >= 0 ? '+' : '';
  return `${sign}${perf.toFixed(1)}%`;
}

export function AdvancedMetrics({
  sensitivityTable,
  topGainers,
  topLosers,
  profitExcludingTop5,
  totalProfit,
}: Props) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div style={{ marginBottom: '20px' }}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        style={{
          width: '100%',
          padding: '16px',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-elevated)',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '700',
          color: 'var(--text)',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface-elevated)';
          e.currentTarget.style.borderColor = 'var(--teal)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--surface-elevated)';
          e.currentTarget.style.borderColor = 'var(--border-elevated)';
        }}
      >
        <span>📊 Advanced Metrics & Sensitivity Analysis</span>
        <span style={{ fontSize: '18px' }}>{showDetails ? '▼' : '▶'}</span>
      </button>

      {showDetails && (
        <div
          style={{
            marginTop: '16px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
          }}
        >
          {/* Sensitivity Table */}
          <div
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-elevated)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: 'var(--inset-top), var(--shadow-md)',
            }}
          >
            <h4
              style={{
                fontSize: '13px',
                fontWeight: '700',
                color: 'var(--text)',
                margin: '0 0 12px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Min Exit Score Sensitivity
            </h4>
            <p
              style={{
                fontSize: '11px',
                color: 'var(--text-3)',
                margin: '0 0 12px 0',
                lineHeight: '1.4',
              }}
            >
              How returns change as the exit threshold varies. Lower scores sell earlier
              (more closed trades), higher scores hold longer (more unrealized gains).
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  fontSize: '11px',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th
                      style={{
                        padding: '8px 4px',
                        textAlign: 'left',
                        fontWeight: '600',
                        color: 'var(--text-2)',
                      }}
                    >
                      Score
                    </th>
                    <th
                      style={{
                        padding: '8px 4px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: 'var(--text-2)',
                      }}
                    >
                      Closed
                    </th>
                    <th
                      style={{
                        padding: '8px 4px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: 'var(--text-2)',
                      }}
                    >
                      Return
                    </th>
                    <th
                      style={{
                        padding: '8px 4px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: 'var(--text-2)',
                      }}
                    >
                      Capital
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sensitivityTable.map((row) => (
                    <tr
                      key={row.minExitScore}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        backgroundColor:
                          row.minExitScore === 2.0
                            ? 'rgba(0, 196, 167, 0.06)'
                            : undefined,
                      }}
                    >
                      <td
                        style={{
                          padding: '8px 4px',
                          fontFamily: 'DM Mono, monospace',
                        }}
                      >
                        {row.minExitScore === 0 ? 'Hold All' : `${row.minExitScore}`}
                      </td>
                      <td
                        style={{
                          padding: '8px 4px',
                          textAlign: 'right',
                          fontFamily: 'DM Mono, monospace',
                        }}
                      >
                        {row.closedCount}
                      </td>
                      <td
                        style={{
                          padding: '8px 4px',
                          textAlign: 'right',
                          fontFamily: 'DM Mono, monospace',
                          fontWeight: '600',
                          color: row.return !== null && row.return >= 0 ? 'var(--green)' : '#E24B4A',
                        }}
                      >
                        {row.return !== null ? formatPerformance(row.return) : '—'}
                      </td>
                      <td
                        style={{
                          padding: '8px 4px',
                          textAlign: 'right',
                          fontFamily: 'DM Mono, monospace',
                          fontSize: '10px',
                          color: 'var(--text-3)',
                        }}
                      >
                        {formatCurrency(row.totalCapital)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Contributors */}
          <div
            style={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-elevated)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: 'var(--inset-top), var(--shadow-md)',
            }}
          >
            <h4
              style={{
                fontSize: '13px',
                fontWeight: '700',
                color: 'var(--text)',
                margin: '0 0 12px 0',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Top 5 Winners & Losers
            </h4>

            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--text-2)',
                  marginBottom: '8px',
                }}
              >
                Top Gains
              </div>
              {topGainers.slice(0, 5).map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    padding: '6px 0',
                    borderBottom:
                      i < topGainers.slice(0, 5).length - 1
                        ? '1px solid var(--border-elevated)'
                        : undefined,
                  }}
                >
                  <span style={{ fontWeight: '600', color: 'var(--text)' }}>
                    {c.ticker}
                  </span>
                  <span style={{ fontFamily: 'DM Mono, monospace' }}>
                    {formatPerformance(c.return)} ({formatCurrency(c.profit)})
                  </span>
                </div>
              ))}
            </div>

            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--text-2)',
                  marginBottom: '8px',
                }}
              >
                Top Losses
              </div>
              {topLosers.slice(0, 5).map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    padding: '6px 0',
                    borderBottom:
                      i < topLosers.slice(0, 5).length - 1
                        ? '1px solid var(--border-elevated)'
                        : undefined,
                  }}
                >
                  <span style={{ fontWeight: '600', color: 'var(--text)' }}>
                    {c.ticker}
                  </span>
                  <span
                    style={{
                      fontFamily: 'DM Mono, monospace',
                      color: '#E24B4A',
                    }}
                  >
                    {formatPerformance(c.return)} ({formatCurrency(c.profit)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Concentration metric */}
      <div
        style={{
          marginTop: '12px',
          padding: '12px',
          background: 'var(--surface)',
          borderRadius: '8px',
          fontSize: '11px',
          color: 'var(--text-2)',
        }}
      >
        <div>
          Profit excluding top 5:{' '}
          <span
            style={{
              fontFamily: 'DM Mono, monospace',
              fontWeight: '600',
              color:
                profitExcludingTop5 >= 0
                  ? 'var(--green)'
                  : '#E24B4A',
            }}
          >
            {formatCurrency(profitExcludingTop5)}
          </span>{' '}
          ({(((totalProfit - profitExcludingTop5) / totalProfit) * 100).toFixed(0)}% concentration in top 5)
        </div>
      </div>
    </div>
  );
}
