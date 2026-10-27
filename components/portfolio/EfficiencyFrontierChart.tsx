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
      hint={`Each grey dot is a random mix of your assets. The teal line is the efficient frontier—the best possible return at each risk level. Your current allocation is the larger teal dot (max drawdown: ${(maxDrawdown * 100).toFixed(1)}%).`}
    >
      <div style={{ minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={envelope} margin={{ top: 8, right: 12, left: 18, bottom: 28 }}>
            <CartesianGrid strokeDasharray="2 3" stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="x"
              unit="%"
              domain={['dataMin - 2', 'dataMax + 2']}
              tickFormatter={(v: number) => v.toFixed(1)}
              stroke="var(--text-3)"
              tick={{ fontSize: 12, fill: 'var(--text-2)', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              height={24}
              label={{ value: 'Risk (Volatility)', position: 'bottom', offset: 0, style: { fontSize: 11, fill: 'var(--text-3)', fontWeight: 500 } }}
            />
            <YAxis
              type="number"
              dataKey="y"
              unit="%"
              domain={['dataMin - 2', 'dataMax + 2']}
              tickFormatter={(v: number) => v.toFixed(1)}
              stroke="var(--text-3)"
              tick={{ fontSize: 12, fill: 'var(--text-2)', fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              width={58}
              label={{ value: 'Return', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'var(--text-3)', fontWeight: 500 } }}
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
            <Scatter data={cloud} fill="#54798a" fillOpacity={0.55} r={3} isAnimationActive={false} />
            <Line type="monotone" dataKey="y" stroke="#00c4a7" strokeWidth={2.5} dot={false} isAnimationActive={false} legendType="none" />
            <ReferenceDot x={current.x} y={current.y} r={7} fill="#00c4a7" stroke="var(--bg)" strokeWidth={2.5} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {headroom !== null && headroom > 0.1 && (
        <p style={{ margin: '10px 0 0', fontSize: T.label, color: 'var(--text-2)', lineHeight: 1.5, padding: '8px 10px', background: 'rgba(0, 196, 167, 0.08)', borderRadius: '6px', borderLeft: '3px solid #00c4a7' }}>
          <strong style={{ color: 'var(--text)' }}>Rebalancing opportunity:</strong> At your current risk level, a different mix could reach{' '}
          <strong style={{ color: '#00c4a7' }}>+{headroom.toFixed(1)}%</strong> more return.
        </p>
      )}
    </Panel>
  );
}
