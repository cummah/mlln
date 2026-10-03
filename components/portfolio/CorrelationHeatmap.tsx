'use client';

import { useMemo } from 'react';
import { Panel, Legend, T, MONO } from './ui';

interface CorrelationHeatmapProps {
  matrix: number[][];
  tickers: string[];
}

/**
 * Diverging fill. Alpha caps at 0.55 and the label always uses var(--text) so
 * the cells hold contrast under both themes — the previous version switched to
 * hardcoded `white` above |0.5| and used a near-white tint for zero, both of
 * which vanished under [data-theme="light"].
 */
function fillFor(value: number): string {
  const intensity = Math.min(Math.abs(value), 1) * 0.55;
  if (Number.isNaN(value)) return 'var(--surface2)';
  if (value < 0) return `rgba(240, 92, 110, ${intensity})`;
  if (value > 0) return `rgba(0, 196, 167, ${intensity})`;
  return 'var(--surface2)';
}

export function CorrelationHeatmap({ matrix, tickers }: CorrelationHeatmapProps) {
  const n = tickers.length;

  // Past ~9 assets the in-cell numbers stop fitting at a legible size, so the
  // grid becomes colour-only and the pair callouts below carry the detail.
  const showValues = n <= 9;
  const cell = n <= 5 ? 46 : n <= 9 ? 38 : n <= 14 ? 26 : 20;
  const fontSize = n <= 5 ? 11 : 10;

  // The insight most users actually want, and the only reading that survives a
  // 20-asset matrix.
  const pairs = useMemo(() => {
    const out: Array<{ a: string; b: string; value: number }> = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const value = matrix[i]?.[j];
        if (typeof value === 'number' && Number.isFinite(value)) {
          out.push({ a: tickers[i], b: tickers[j], value });
        }
      }
    }
    return out.sort((x, y) => y.value - x.value);
  }, [matrix, tickers, n]);

  const mostCorrelated = pairs[0];
  const leastCorrelated = pairs[pairs.length - 1];

  return (
    <Panel
      title="Correlation"
      hint="How closely each pair of assets moves together, from −1 (opposite) to +1 (identical). Lower pairwise correlation means more real diversification."
    >
      {/* Horizontal scroll only, for wide (many-ticker) matrices — no maxHeight,
          so the panel grows to fit every row instead of scrolling internally. */}
      <div style={{ overflowX: 'auto', overflowY: 'visible', margin: '0 -2px' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: '2px', fontFamily: MONO }}>
          <caption className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Pairwise correlation of daily returns between portfolio assets
          </caption>
          <thead>
            <tr>
              <th style={{ width: cell, height: cell, position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2 }} />
              {tickers.map((ticker) => (
                <th
                  key={ticker}
                  scope="col"
                  style={{
                    width: cell,
                    minWidth: cell,
                    height: cell,
                    fontSize,
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--surface)',
                    zIndex: 1,
                  }}
                >
                  {ticker}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((rowTicker, i) => (
              <tr key={rowTicker}>
                <th
                  scope="row"
                  style={{
                    width: cell,
                    minWidth: cell,
                    height: cell,
                    fontSize,
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    textAlign: 'right',
                    paddingRight: '4px',
                    position: 'sticky',
                    left: 0,
                    background: 'var(--surface)',
                    zIndex: 1,
                  }}
                >
                  {rowTicker}
                </th>
                {tickers.map((colTicker, j) => {
                  const value = matrix[i]?.[j];
                  const safe = typeof value === 'number' && Number.isFinite(value) ? value : NaN;
                  return (
                    <td
                      key={colTicker}
                      style={{
                        width: cell,
                        minWidth: cell,
                        height: cell,
                        background: fillFor(safe),
                        borderRadius: '3px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontSize,
                        fontWeight: 600,
                        color: 'var(--text)',
                        border: i === j ? '1px solid var(--border-medium, var(--border))' : 'none',
                      }}
                    >
                      <span
                        title={`${rowTicker} vs ${colTicker}: ${Number.isNaN(safe) ? 'no data' : safe.toFixed(2)}`}
                        aria-label={`${rowTicker} versus ${colTicker}: ${Number.isNaN(safe) ? 'no data' : safe.toFixed(2)}`}
                      >
                        {showValues ? (Number.isNaN(safe) ? '·' : safe.toFixed(2)) : ''}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Legend
        items={[
          { label: 'Moves opposite (−1)', color: 'rgba(240, 92, 110, 0.55)' },
          { label: 'Unrelated (0)', color: 'var(--surface2)' },
          { label: 'Moves together (+1)', color: 'rgba(0, 196, 167, 0.55)' },
        ]}
      />

      {mostCorrelated && leastCorrelated && pairs.length > 1 && (
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '10px 0 0', fontSize: T.label }}>
          <div>
            <dt style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}>Most correlated</dt>
            <dd style={{ margin: '2px 0 0', color: 'var(--text)', fontFamily: MONO }}>
              {mostCorrelated.a}/{mostCorrelated.b} {mostCorrelated.value.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px' }}>Best diversifier</dt>
            <dd style={{ margin: '2px 0 0', color: 'var(--teal)', fontFamily: MONO }}>
              {leastCorrelated.a}/{leastCorrelated.b} {leastCorrelated.value.toFixed(2)}
            </dd>
          </div>
        </dl>
      )}
    </Panel>
  );
}
