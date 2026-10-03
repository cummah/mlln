'use client';

import { useMemo } from 'react';
import { ComposedChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Panel, TooltipShell, T, MONO } from './ui';

interface EfficiencyFrontierProps {
  frontier: Array<{
    volatility: number;
    return: number;
    sharpeRatio: number;
  }>;
  portfolioMetrics: {
    expectedReturn: number;
    volatility: number;
    sharpeRatio: number;
  };
  /** Worst peak-to-trough decline of the weighted portfolio over the lookback. */
  maxDrawdown: number;
}

export function EfficiencyFrontierChart({ frontier, portfolioMetrics, maxDrawdown }: EfficiencyFrontierProps) {
  const cloud = useMemo(
    () =>
      frontier.map((p) => ({
        x: p.volatility * 100,
        y: p.return * 100,
        sharpeRatio: p.sharpeRatio,
      })),
    [frontier]
  );

  /**
   * The API samples random weightings, which is a risk/return cloud — not a
   * frontier. The frontier is its upper envelope, so derive that here: bucket by
   * volatility and keep the best return in each bucket.
   */
  const envelope = useMemo(() => {
    if (cloud.length === 0) return [];
    const xs = cloud.map((p) => p.x);
    const min = Math.min(...xs);
    const max = Math.max(...xs);
    const span = max - min;
    if (span <= 0) return [];
    const buckets = 12;
    const best = new Map<number, { x: number; y: number }>();
    for (const point of cloud) {
      const bucket = Math.min(buckets - 1, Math.floor(((point.x - min) / span) * buckets));
      const current = best.get(bucket);
      if (!current || point.y > current.y) best.set(bucket, { x: point.x, y: point.y });
    }
    return Array.from(best.values()).sort((a, b) => a.x - b.x);
  }, [cloud]);

  const current = {
    x: portfolioMetrics.volatility * 100,
    y: portfolioMetrics.expectedReturn * 100,
  };

  // How much return is available at your risk level from a better weighting.
  const headroom = useMemo(() => {
    const nearby = cloud.filter((p) => p.x <= current.x * 1.02);
    if (nearby.length === 0) return null;
    const bestNearby = Math.max(...nearby.map((p) => p.y));
    return bestNearby - current.y;
  }, [cloud, current.x, current.y]);

  return (
    <Panel
      title="Risk vs Return"
      hint="Grey dots are randomly weighted mixes of your same assets. The line is the best return available at each risk level; the blue dot is your current allocation."
    >
      <div style={{ minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={160}>
          <ComposedChart data={envelope} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 3" stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="x"
              unit="%"
              domain={['dataMin - 2', 'dataMax + 2']}
              // Auto-generated ticks are raw computed floats (e.g. 17.333333);
              // without a formatter they render at full float precision.
              tickFormatter={(v: number) => v.toFixed(1)}
              stroke="var(--text-3)"
              tick={{ fontSize: 10, fill: 'var(--text-2)' }}
              tickLine={false}
              axisLine={false}
              height={18}
            />
            <YAxis
              type="number"
              dataKey="y"
              unit="%"
              domain={['dataMin - 2', 'dataMax + 2']}
              tickFormatter={(v: number) => v.toFixed(1)}
              stroke="var(--text-3)"
              tick={{ fontSize: 10, fill: 'var(--text-2)' }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as { x: number; y: number; sharpeRatio?: number };
                return (
                  <TooltipShell>
                    <div style={{ fontFamily: MONO }}>Risk {d.x.toFixed(1)}%</div>
                    <div style={{ fontFamily: MONO }}>Return {d.y.toFixed(1)}%</div>
                    {typeof d.sharpeRatio === 'number' && <div style={{ color: 'var(--text-2)', fontFamily: MONO }}>Sharpe {d.sharpeRatio.toFixed(2)}</div>}
                  </TooltipShell>
                );
              }}
            />
            <Scatter data={cloud} fill="#122c39" fillOpacity={0.65} r={2.5} isAnimationActive={false} />
            <Line type="monotone" dataKey="y" stroke="#54798a" strokeWidth={1.5} dot={false} isAnimationActive={false} legendType="none" />
            <ReferenceDot x={current.x} y={current.y} r={5} fill="#3b6178" stroke="var(--bg)" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {headroom !== null && headroom > 0.5 && (
        <p style={{ margin: '8px 0 0', fontSize: T.label, color: 'var(--text-2)', lineHeight: 1.5 }}>
          At your risk level, a different weighting of these same assets reached{' '}
          <strong style={{ color: '#54798a' }}>+{headroom.toFixed(1)}%</strong> more return.
        </p>
      )}
    </Panel>
  );
}
