'use client';

import { useEffect, useState } from 'react';
import { ScorePanel } from './ScorePanel';
import { TagBadges } from './TagBadges';
import { Card } from '@/components/ui/Card';

interface AssetScores {
  ticker: string;
  name: string;
  sector: string;
  tags: string[] | null;
  fundamentalsLastUpdated: string | null;
  scores: {
    fundamentalQuality: number | null;
    dcaSuitability: number | null;
    finalConviction: number | null;
    factorExposures: Record<string, number | null> | null;
    macroRegimeState: string | null;
    stalenessPenalty: number | null;
    computedAt: string | null;
  } | null;
  macroContext: {
    score: number | null;
    regime: string | null;
    vix: number | null;
    yieldCurveSpread: number | null;
    creditSpread: number | null;
  } | null;
}

interface AssetScoresSectionProps {
  ticker: string;
}

export function AssetScoresSection({ ticker }: AssetScoresSectionProps) {
  const [data, setData] = useState<AssetScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScores = async () => {
      try {
        const response = await fetch(`/api/asset-scores/${ticker.toUpperCase()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch scores');
        }
        const scoreData = await response.json();
        setData(scoreData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchScores();
  }, [ticker]);

  if (loading) {
    return (
      <Card className="mb-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderLeft: '4px solid var(--orange)', borderRadius: '14px', padding: '24px', marginBottom: '24px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
        <p style={{ color: 'var(--text)', margin: 0, fontWeight: '600' }}>
          Scores unavailable: {error}
        </p>
        <p style={{ color: 'var(--text-2)', fontSize: '14px', marginTop: '8px', margin: '8px 0 0 0' }}>
          Run the conviction score computation scripts to generate scores.
        </p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <>
      {/* Score Panel */}
      {data.scores ? (
        <ScorePanel
          fundamentalQuality={data.scores.fundamentalQuality}
          dcaSuitability={data.scores.dcaSuitability}
          finalConviction={data.scores.finalConviction}
          stalenessPenalty={data.scores.stalenessPenalty}
          macroRegime={data.scores.macroRegimeState}
          computedAt={data.scores.computedAt}
          fundamentalsLastUpdated={data.fundamentalsLastUpdated}
        />
      ) : (
        <Card className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-6">
          <p className="text-blue-800">
            <span className="font-semibold">Scores not yet computed.</span> Run{' '}
            <code className="bg-blue-100 px-2 py-1 rounded text-sm font-mono">
              compute-conviction-scores.ts
            </code>{' '}
            to generate institutional scores.
          </p>
        </Card>
      )}

      {/* Tags Section */}
      {data.tags && data.tags.length > 0 && (
        <section style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '14px', padding: '24px 28px', marginBottom: '24px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
              Tags
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
              · Thematic categories based on business profile
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <TagBadges tags={data.tags} />
          </div>
        </section>
      )}

      {/* Macro Context */}
      {data.macroContext && (
        <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '14px', padding: '24px 28px', marginBottom: '24px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
          <h3 style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 20px 0' }}>
            Current Macro Context
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px' }}>
            <div>
              <div style={{ color: 'var(--text-2)', fontSize: '12px', marginBottom: '8px' }}>Macro Regime</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--blue)' }}>
                {data.macroContext.regime || 'Unknown'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-2)', fontSize: '12px', marginBottom: '8px' }}>VIX Level</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--purple)' }}>
                {data.macroContext.vix !== null ? Math.round(data.macroContext.vix * 10) / 10 : 'N/A'}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-2)', fontSize: '12px', marginBottom: '8px' }}>10Y - 2Y Spread</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--green)' }}>
                {data.macroContext.yieldCurveSpread !== null
                  ? Math.round(data.macroContext.yieldCurveSpread * 100) / 100
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
