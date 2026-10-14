'use client';

import type { CSSProperties } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell } from 'recharts';
import { formatCurrency } from '@/lib/formatters';
import type { Frequency } from '@/lib/portfolio-aggregate';
import type { Period } from '@/types';
import { Panel, Legend, TooltipShell, T, MONO, RADIUS, STD_COLOR, ALPHA_HEX } from './ui';
import { EfficiencyFrontierChart } from './EfficiencyFrontierChart';

interface PerformanceResult {
  period: Period;
  frequency: Frequency;
  stdReturn: number;
  enhReturn: number;
  stdInvested: number;
  enhInvested: number;
  stdValue: number;
  enhValue: number;
  alpha: number;
  excluded: Array<{ ticker: string; reason: string }>;
}

interface PortfolioMetrics {
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

interface RowData {
  period: Period;
  periodLabel: string;
  cadence: Frequency;
  cadenceLabel: string;
  chartLabel: string;
  stdReturn: number;
  enhReturn: number;
  stdInvested: number;
  stdValue: number;
  enhInvested: number;
  enhValue: number;
  dollarGain: number;
  excluded: Array<{ ticker: string; reason: string }>;
}

// 5y first: the longest window is the most informative, so it leads.
const PERIOD_ORDER: Record<Period, number> = { '5y': 0, '3y': 1, '1y': 2 };
const PERIOD_LABEL: Record<Period, string> = { '5y': '5Y', '3y': '3Y', '1y': '1Y' };

export function PortfolioPerformanceSection({
  results,
  portfolioMetrics,
  efficientFrontier,
  maxDrawdown,
}: {
  results: PerformanceResult[];
  portfolioMetrics?: PortfolioMetrics;
  efficientFrontier?: Array<{ volatility: number; return: number; sharpeRatio: number }>;
  maxDrawdown?: number;
}) {
  const rows: RowData[] = results.map((result) => ({
    period: result.period,
    periodLabel: PERIOD_LABEL[result.period],
    cadence: result.frequency,
    cadenceLabel: result.frequency === 'weekly' ? 'Weekly' : 'Monthly',
    chartLabel: `${PERIOD_LABEL[result.period]} ${result.frequency === 'weekly' ? 'W' : 'M'}`,
    stdReturn: result.stdReturn,
    enhReturn: result.enhReturn,
    stdInvested: result.stdInvested,
    stdValue: result.stdValue,
    enhInvested: result.enhInvested,
    enhValue: result.enhValue,
    // Use the aggregator's own value totals rather than re-deriving them from
    // return percentages, which double-applied rounding.
    dollarGain: result.enhValue - result.stdValue,
    excluded: result.excluded,
  }));

  // One ordering for every view on this page: 5Y→1Y, weekly before monthly.
  rows.sort((a, b) => {
    const byPeriod = PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period];
    if (byPeriod !== 0) return byPeriod;
    return a.cadence === 'weekly' ? -1 : 1;
  });

  if (rows.length === 0) return null;

  // The headline row and the headline number have to be the same row. The old
  // code paired max-over-all-rows with rows[0], so the caption described a
  // different window than the figure above it whenever they diverged.
  const bestRow = rows.reduce((best, row) => (row.dollarGain > best.dollarGain ? row : best), rows[0]);
  const alphaTrails = bestRow.dollarGain < 0;

  // Best return edge by percentage (independent of investment base)
  const bestReturnEdgeRow = rows.reduce((best, row) => {
    const rowEdge = row.enhReturn - row.stdReturn;
    const bestEdge = best.enhReturn - best.stdReturn;
    return rowEdge > bestEdge ? row : best;
  }, rows[0]);
  const bestEdge = bestReturnEdgeRow.enhReturn - bestReturnEdgeRow.stdReturn;

  // Whether a negative $ Diff row ever coincides with a negative % edge too —
  // if it never does, the $ Diff column is purely a base-size artifact and the
  // note below can say so outright instead of hedging.
  const edgeCount = rows.filter((r) => r.enhReturn >= r.stdReturn).length;
  const dollarNegativeCount = rows.filter((r) => r.dollarGain < 0).length;

  // Build line chart data: organize by period (1Y, 3Y, 5Y) with separate values for weekly/monthly
  const chartDataByPeriod = new Map<Period, { period: Period; stdWeekly?: number; enhWeekly?: number; stdMonthly?: number; enhMonthly?: number }>();

  rows.forEach(row => {
    if (!chartDataByPeriod.has(row.period)) {
      chartDataByPeriod.set(row.period, { period: row.period });
    }
    const entry = chartDataByPeriod.get(row.period)!;
    if (row.cadence === 'weekly') {
      entry.stdWeekly = Number(row.stdReturn.toFixed(2));
      entry.enhWeekly = Number(row.enhReturn.toFixed(2));
    } else {
      entry.stdMonthly = Number(row.stdReturn.toFixed(2));
      entry.enhMonthly = Number(row.enhReturn.toFixed(2));
    }
  });

  // Order by period: 1Y → 3Y → 5Y (left to right)
  const chartData = (['1y', '3y', '5y'] as Period[])
    .filter(p => chartDataByPeriod.has(p))
    .map(period => ({
      ...chartDataByPeriod.get(period)!,
      label: PERIOD_LABEL[period],
    }));

  const maxAbsGain = Math.max(...rows.map((r) => Math.abs(r.dollarGain)), 1);
  const excludedTickers = Array.from(
    new Map(rows.flatMap((r) => r.excluded).map((e) => [e.ticker, e])).values()
  );

  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: '12px' }}>
        <Panel title="Biggest Edge" hint="Of the 6 windows compared below (1Y/3Y/5Y × weekly/monthly), this is the one where Alpha's ending value differs most from standard DCA's, in dollars.">
          <div style={{ fontSize: T.kpi, fontWeight: 600, fontFamily: MONO, color: alphaTrails ? 'var(--red)' : 'var(--text)', lineHeight: 1.1 }}>
            {alphaTrails && '−'}
            {formatCurrency(Math.abs(bestRow.dollarGain))}
          </div>
          {/* Spelled out inline rather than left to the hover-only hint — a bare
              dollar figure next to "Best Window" didn't say what was being
              measured or which of the 6 windows it came from. */}
          <div style={{ fontSize: T.label, color: 'var(--text-2)', marginTop: '4px', lineHeight: 1.4 }}>
            Alpha {alphaTrails ? 'trails' : 'beats'} Standard DCA by this much in{' '}
            <strong style={{ color: 'var(--text)' }}>
              {bestRow.periodLabel} {bestRow.cadenceLabel.toLowerCase()}
            </strong>{' '}
            contributions — the widest gap of the 6 windows tested.
          </div>
        </Panel>

        <Panel title="Return Edge" hint="Greatest % return advantage of Alpha over standard DCA across all windows.">
          <div
            style={{
              fontSize: T.kpi,
              fontWeight: 600,
              fontFamily: MONO,
              color: bestEdge >= 0 ? 'var(--green)' : 'var(--red)',
              lineHeight: 1.1,
            }}
          >
            {bestEdge >= 0 ? '+' : '−'}
            {Math.abs(bestEdge).toFixed(1)}
            <span style={{ fontSize: T.body, marginLeft: '2px' }}>%</span>
          </div>
          <div style={{ fontSize: T.label, color: 'var(--text-2)', marginTop: '4px', lineHeight: 1.4 }}>
            <div>{bestReturnEdgeRow.enhReturn.toFixed(1)}% vs {bestReturnEdgeRow.stdReturn.toFixed(1)}% standard</div>
            <div style={{ marginTop: '4px', fontSize: T.label, color: 'var(--text-3)' }}>
              {bestReturnEdgeRow.periodLabel} {bestReturnEdgeRow.cadenceLabel.toLowerCase()}
            </div>
          </div>
        </Panel>

        {/* Smaller tiles: Expected Return & Sharpe */}
        <div className="rs-span2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Panel title="Expected Return" hint="Portfolio's annualized expected return based on 5-year historical performance.">
            <div style={{
              fontSize: T.kpi,
              fontWeight: 600,
              fontFamily: MONO,
              color: portfolioMetrics?.expectedReturn ?? 0 >= 0 ? '#54798a' : '#3b6178',
              lineHeight: 1.1,
            }}>
              {portfolioMetrics?.expectedReturn ? `${portfolioMetrics.expectedReturn >= 0 ? '+' : '−'}${(Math.abs(portfolioMetrics.expectedReturn) * 100).toFixed(1)}%` : '—'}
            </div>
          </Panel>
          <Panel title="Sharpe Ratio" hint="Risk-adjusted return (higher is better). Measures excess return per unit of volatility.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '100px', justifyContent: 'center' }}>
              {portfolioMetrics?.sharpeRatio !== undefined ? (
                <>
                  <div style={{ fontSize: T.heading, fontWeight: 600, fontFamily: MONO, color: 'var(--text)', textAlign: 'center' }}>
                    {portfolioMetrics.sharpeRatio.toFixed(2)}
                  </div>
                  <div style={{ position: 'relative', width: '100%', height: '20px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--border)' }}>
                    <div
                      style={{
                        position: 'absolute',
                        height: '100%',
                        backgroundColor: portfolioMetrics.sharpeRatio >= 2 ? '#54798a' : portfolioMetrics.sharpeRatio >= 1 ? '#3b6178' : '#122c39',
                        width: `${Math.min((portfolioMetrics.sharpeRatio / 3) * 100, 100)}%`,
                        transition: 'width 0.3s ease',
                      }}
                    />
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '8px', paddingRight: '8px', fontSize: '10px', color: 'var(--text-3)' }}>
                      <span>0</span>
                      <span>3</span>
                    </div>
                  </div>
                  <div style={{ fontSize: T.label, color: 'var(--text-2)', textAlign: 'center' }}>
                    {portfolioMetrics.sharpeRatio >= 2 ? 'Excellent' : portfolioMetrics.sharpeRatio >= 1 ? 'Good' : 'Fair'}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: T.heading, fontWeight: 600, fontFamily: MONO, color: 'var(--text)', textAlign: 'center' }}>—</div>
              )}
            </div>
          </Panel>
        </div>

        {/* Smaller tiles: Volatility & Max Drawdown */}
        <div className="rs-span2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Panel title="Volatility" hint="Portfolio standard deviation over the 5-year period. Lower volatility = lower risk.">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100px' }}>
              {portfolioMetrics?.volatility !== undefined ? (
                <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { value: portfolioMetrics.volatility * 100 },
                          { value: Math.max(0, 100 - portfolioMetrics.volatility * 100) }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={32}
                        outerRadius={45}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                      >
                        <Cell fill="#54798a" />
                        <Cell fill="#0d232e" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: T.heading,
                    fontWeight: 600,
                    fontFamily: MONO,
                    color: '#54798a',
                    textAlign: 'center',
                  }}>
                    {Math.round(portfolioMetrics.volatility * 100)}%
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: T.heading, fontWeight: 600, fontFamily: MONO, color: 'var(--text)' }}>—</div>
              )}
            </div>
          </Panel>
          <Panel title="Drawdown" hint="Largest peak-to-trough decline during the period. Indicates worst-case loss.">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100px' }}>
              {portfolioMetrics?.maxDrawdown !== undefined ? (
                <div style={{ position: 'relative', width: '100px', height: '100px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { value: Math.abs(portfolioMetrics.maxDrawdown * 100) },
                          { value: Math.max(0, 100 - Math.abs(portfolioMetrics.maxDrawdown * 100)) }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={32}
                        outerRadius={45}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                      >
                        <Cell fill={portfolioMetrics.maxDrawdown < 0 ? '#3b6178' : '#54798a'} />
                        <Cell fill="#0d232e" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: T.heading,
                    fontWeight: 600,
                    fontFamily: MONO,
                    color: portfolioMetrics.maxDrawdown < 0 ? '#3b6178' : '#54798a',
                    textAlign: 'center',
                  }}>
                    {Math.round(Math.abs(portfolioMetrics.maxDrawdown) * 100)}%
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: T.heading, fontWeight: 600, fontFamily: MONO, color: 'var(--text)' }}>—</div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: '12px' }}>
        <Panel title="Standard DCA vs Alpha" hint="Return progression from 1Y to 5Y. Solid lines are weekly, lighter shades are monthly contributions.">
          {/* Numeric height, not height="100%" inside a flex parent: the parent's
              height isn't resolved when Recharts first measures, which yields a
              width(-1)/height(-1) warning and an unrendered chart. */}
          <div style={{ minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={176}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--text-3)" tick={{ fontSize: 10, fill: 'var(--text-2)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                <YAxis
                  stroke="var(--text-3)"
                  tick={{ fontSize: 10, fill: 'var(--text-2)' }}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                  width={44}
                  tickFormatter={(v: number) => v.toFixed(1)}
                />
                <ReferenceLine y={0} stroke="var(--text-3)" strokeWidth={1} />
                <Tooltip
                  cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <TooltipShell>
                        <div style={{ fontWeight: 700, marginBottom: '3px' }}>{label}</div>
                        {payload.map((entry) => {
                          let name = '';
                          if (entry.dataKey === 'stdWeekly') name = 'Standard DCA (Weekly)';
                          else if (entry.dataKey === 'enhWeekly') name = 'Alpha (Weekly)';
                          else if (entry.dataKey === 'stdMonthly') name = 'Standard DCA (Monthly)';
                          else if (entry.dataKey === 'enhMonthly') name = 'Alpha (Monthly)';
                          return (
                            <div key={String(entry.dataKey)} style={{ color: entry.color }}>
                              {name}: {Number(entry.value).toFixed(1)}%
                            </div>
                          );
                        })}
                      </TooltipShell>
                    );
                  }}
                />
                <Line dataKey="stdWeekly" name="Standard DCA (Weekly)" stroke={STD_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="enhWeekly" name="Alpha (Weekly)" stroke={ALPHA_HEX} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="stdMonthly" name="Standard DCA (Monthly)" stroke={STD_COLOR} strokeWidth={2} strokeOpacity={0.45} dot={false} isAnimationActive={false} />
                <Line dataKey="enhMonthly" name="Alpha (Monthly)" stroke={ALPHA_HEX} strokeWidth={2} strokeOpacity={0.45} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend
            items={[
              { label: 'Standard DCA (Weekly)', color: STD_COLOR },
              { label: 'Alpha (Weekly)', color: ALPHA_HEX },
              { label: 'Standard DCA (Monthly)', color: 'rgba(84, 121, 138, 0.45)' },
              { label: 'Alpha (Monthly)', color: 'rgba(59, 97, 120, 0.45)' },
            ]}
          />
        </Panel>

        {efficientFrontier && portfolioMetrics && maxDrawdown !== undefined ? (
          <EfficiencyFrontierChart
            frontier={efficientFrontier}
            portfolioMetrics={portfolioMetrics}
            maxDrawdown={maxDrawdown}
          />
        ) : null}
      </div>

      {/* Invested vs. current value per strategy. Alpha skips contributions on
          weak signals, so its invested total is rarely equal to standard DCA's
          for the same window — a plain dollar difference between two different
          bases reads as a loss even in windows where Alpha's % return is ahead
          (e.g. 3Y: Alpha invests less, ends with a smaller balance, but a higher
          return on what it did put in). Return% and Edge are base-independent,
          so they're the fair comparison; $ Diff is kept for the literal number
          but demoted below them. */}
      <Panel
        title="Invested & Value"
        hint="Edge is the % return gap — fair even when the two strategies invest different amounts. $ Diff is the literal ending-value difference, which can look negative in a window Alpha's Edge is actually positive, simply because Alpha put in less."
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: T.body, whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th scope="col" style={headCellStyle('left')} />
                <th scope="col" colSpan={3} style={{ ...headCellStyle('center'), borderBottom: '1px solid var(--border)' }}>
                  Standard DCA
                </th>
                <th scope="col" colSpan={3} style={{ ...headCellStyle('center'), borderBottom: '1px solid var(--border)' }}>
                  Alpha
                </th>
                <th scope="col" style={{ ...headCellStyle('right'), color: 'var(--text-2)' }}>
                  Edge
                </th>
                <th scope="col" style={headCellStyle('right')}>
                  $ Diff
                </th>
              </tr>
              <tr>
                <th scope="col" style={headCellStyle('left')}>
                  Window
                </th>
                <th scope="col" style={headCellStyle('right')}>
                  Invested
                </th>
                <th scope="col" style={headCellStyle('right')}>
                  Value
                </th>
                <th scope="col" style={headCellStyle('right')}>
                  Return
                </th>
                <th scope="col" style={headCellStyle('right')}>
                  Invested
                </th>
                <th scope="col" style={headCellStyle('right')}>
                  Value
                </th>
                <th scope="col" style={headCellStyle('right')}>
                  Return
                </th>
                <th scope="col" style={headCellStyle('right')} />
                <th scope="col" style={headCellStyle('right')} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isBest = row === bestRow;
                const negative = row.dollarGain < 0;
                const edge = row.enhReturn - row.stdReturn;
                const edgeUp = edge >= 0;
                return (
                  <tr key={`${row.period}-${row.cadence}-value`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <th scope="row" style={{ textAlign: 'left', padding: '6px 8px 6px 0', fontSize: T.body, fontWeight: isBest ? 700 : 500, color: 'var(--text)' }}>
                      {row.periodLabel} {row.cadence === 'weekly' ? 'W' : 'M'}
                      {isBest && (
                        <span style={{ marginLeft: '5px', fontSize: '9px', fontWeight: 700, color: 'var(--teal)', letterSpacing: '0.05em' }}>BEST $</span>
                      )}
                    </th>
                    <td style={bodyCellStyle}>{formatCurrency(row.stdInvested)}</td>
                    <td style={{ ...bodyCellStyle, fontWeight: 600 }}>{formatCurrency(row.stdValue)}</td>
                    <td style={bodyCellStyle}>{row.stdReturn.toFixed(1)}%</td>
                    <td style={bodyCellStyle}>{formatCurrency(row.enhInvested)}</td>
                    <td style={{ ...bodyCellStyle, fontWeight: 600, color: 'var(--green)' }}>{formatCurrency(row.enhValue)}</td>
                    <td style={{ ...bodyCellStyle, fontWeight: 600, color: edgeUp ? 'var(--green)' : 'var(--red)' }}>{row.enhReturn.toFixed(1)}%</td>
                    <td style={{ ...bodyCellStyle, fontWeight: 700, color: edgeUp ? 'var(--green)' : 'var(--red)' }}>
                      {edgeUp ? '+' : '−'}
                      {Math.abs(edge).toFixed(1)}%
                    </td>
                    <td style={{ ...bodyCellStyle, color: negative ? 'var(--red)' : 'var(--text-2)' }}>
                      {negative && '−'}
                      {formatCurrency(Math.abs(row.dollarGain))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p style={{ margin: '8px 0 0', fontSize: T.label, color: 'var(--text-3)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--teal)' }}>BEST $</strong> marks the widest dollar difference, not the widest
          percentage edge.{' '}
          {edgeCount === rows.length && dollarNegativeCount > 0 ? (
            <>Alpha&apos;s % return beats standard DCA&apos;s in every window here, including the ones with a negative $ Diff — that column is smaller (or negative) there only because Alpha put in less.</>
          ) : dollarNegativeCount > 0 ? (
            <>Compare the Edge column on any row with a negative $ Diff — it can still be positive when Alpha simply invested less that window.</>
          ) : (
            <>Compare the Edge column for the base-independent view of the same comparison.</>
          )}
        </p>
      </Panel>
    </div>
  );
}

function headCellStyle(align: 'left' | 'right' | 'center'): CSSProperties {
  return {
    textAlign: align,
    padding: '0 8px 6px 0',
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-3)',
  };
}

const bodyCellStyle: CSSProperties = {
  textAlign: 'right',
  padding: '6px 8px 6px 0',
  fontFamily: MONO,
  color: 'var(--text-2)',
};
