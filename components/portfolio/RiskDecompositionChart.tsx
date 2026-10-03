'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Panel, TooltipShell, T, MONO, ratioAsPercent } from './ui';

interface RiskDecompositionProps {
  assetMetrics: Array<{
    ticker: string;
    return: number;
    volatility: number;
    sharpeRatio: number;
    contribution: number;
  }>;
  portfolioVolatility: number;
  colors: Record<string, string>;
}

export function RiskDecompositionChart({ assetMetrics, portfolioVolatility, colors }: RiskDecompositionProps) {
  const chartData = assetMetrics
    .map((m) => ({
      ticker: m.ticker,
      contribution: Math.abs(m.contribution) * 100,
      volatility: m.volatility * 100,
      fill: colors[m.ticker] ?? 'var(--teal)',
    }))
    .sort((a, b) => b.contribution - a.contribution);

  const heaviest = chartData[0];
  // Bars need ~22px each to stay legible; the panel grows rather than squeezing
  // 20 assets into a fixed 100px box.
  const height = Math.max(128, Math.min(chartData.length * 22 + 24, 320));

  return (
    <Panel title="Risk Contribution" hint="Each asset's share of total portfolio volatility. An asset contributing far more than its allocation is driving your risk.">
      <div style={{ minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              unit="%"
              tickFormatter={(v: number) => v.toFixed(1)}
              stroke="var(--text-3)"
              tick={{ fontSize: 10, fill: 'var(--text-2)' }}
              tickLine={false}
              axisLine={false}
              height={18}
            />
            <YAxis
              dataKey="ticker"
              type="category"
              stroke="var(--text-3)"
              tick={{ fontSize: 10, fill: 'var(--text-2)' }}
              tickLine={false}
              axisLine={false}
              width={42}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface2)', opacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof chartData)[number];
                return (
                  <TooltipShell>
                    <div style={{ fontWeight: 700 }}>{d.ticker}</div>
                    <div style={{ fontFamily: MONO }}>{d.contribution.toFixed(1)}% of portfolio risk</div>
                    <div style={{ color: 'var(--text-2)', fontFamily: MONO }}>{d.volatility.toFixed(1)}% own volatility</div>
                  </TooltipShell>
                );
              }}
            />
            <Bar dataKey="contribution" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '8px 0 0', fontSize: T.label }}>
        <div>
          <dt style={{ color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portfolio vol</dt>
          {/* Was formatPercent(ratio) — printed 31% annualised volatility as "0.3%". */}
          <dd style={{ margin: '2px 0 0', color: 'var(--text)', fontFamily: MONO, fontWeight: 600 }}>{ratioAsPercent(portfolioVolatility)}</dd>
        </div>
        {heaviest && (
          <div>
            <dt style={{ color: 'var(--text-3)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Biggest driver</dt>
            <dd style={{ margin: '2px 0 0', color: 'var(--text)', fontFamily: MONO, fontWeight: 600 }}>
              {heaviest.ticker} {heaviest.contribution.toFixed(0)}%
            </dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}
