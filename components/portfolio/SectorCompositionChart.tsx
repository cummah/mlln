'use client';

import { PieChart, Pie, Tooltip, ResponsiveContainer } from 'recharts';
import { Panel, Legend, TooltipShell, SERIES, T, MONO } from './ui';

interface SectorCompositionProps {
  data: Record<string, { allocation: number; tickers: string[] }>;
}

export function SectorCompositionChart({ data }: SectorCompositionProps) {
  // Colour is baked onto each datum so the slice, the legend entry and the
  // tooltip agree regardless of allocation order.
  const chartData = Object.entries(data)
    .map(([sector, info]) => ({
      name: sector,
      value: info.allocation,
      tickers: info.tickers.join(', '),
    }))
    .sort((a, b) => b.value - a.value)
    .map((d, i) => ({ ...d, fill: SERIES[i % SERIES.length] }));

  const topSector = chartData[0];

  return (
    <Panel title="Sectors" hint="Share of your monthly contribution going to each sector. A single sector above ~40% means concentrated exposure.">
      <div style={{ minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={128}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={30} outerRadius={56} dataKey="value" stroke="var(--surface)" strokeWidth={2} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const entry = payload[0].payload as (typeof chartData)[number];
                return (
                  <TooltipShell>
                    <div style={{ fontWeight: 700 }}>{entry.name}</div>
                    <div style={{ fontFamily: MONO }}>{entry.value.toFixed(1)}% of contribution</div>
                    <div style={{ color: 'var(--text-2)' }}>{entry.tickers}</div>
                  </TooltipShell>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {topSector && (
        <p style={{ margin: 0, fontSize: T.label, color: 'var(--text-2)', textAlign: 'center' }}>
          Largest: <strong style={{ color: 'var(--text)' }}>{topSector.name}</strong>{' '}
          <span style={{ fontFamily: MONO }}>{topSector.value.toFixed(0)}%</span>
        </p>
      )}

      {/* The compact pie used to render bare "%" labels with no legend at all,
          so the colours were unidentifiable. */}
      <Legend items={chartData.map((d) => ({ label: `${d.name} ${d.value.toFixed(0)}%`, color: d.fill }))} />
    </Panel>
  );
}
