'use client';

import { useState } from 'react';

interface ScorePanelProps {
  fundamentalQuality: number | null;
  dcaSuitability: number | null;
  finalConviction: number | null;
  stalenessPenalty: number | null;
  macroRegime: string | null;
  computedAt: string | null;
  fundamentalsLastUpdated: string | null;
}

export function ScorePanel({
  fundamentalQuality,
  dcaSuitability,
  finalConviction,
  stalenessPenalty,
  macroRegime,
  computedAt,
  fundamentalsLastUpdated,
}: ScorePanelProps) {
  const formatScore = (score: number | null) => {
    if (score === null) return 'N/A';
    return Math.round(score * 10) / 10;
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'var(--text-3)';
    if (score >= 70) return 'var(--green)';
    if (score >= 50) return 'var(--blue)';
    if (score >= 30) return 'var(--yellow)';
    return 'var(--red)';
  };

  const getStalenessColor = (penalty: number | null) => {
    if (penalty === null) return 'var(--text-3)';
    if (penalty >= 0.9) return 'var(--green)';
    if (penalty >= 0.7) return 'var(--blue)';
    if (penalty >= 0.5) return 'var(--yellow)';
    return 'var(--orange)';
  };

  const [showMethodology, setShowMethodology] = useState(false);

  return (
    <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-elevated)', borderRadius: '14px', padding: '24px 28px', marginBottom: '24px', boxShadow: 'var(--inset-top), var(--shadow-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
            Institutional Scoring
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            Computed {formatDate(computedAt)}
          </div>
        </div>
        {macroRegime && (
          <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
            Macro Regime: <span style={{ fontWeight: '500', color: 'var(--text)' }}>{macroRegime}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Fundamental Quality Score */}
        <div style={{ borderLeft: '4px solid var(--blue)', paddingLeft: '16px' }}>
          <div style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>
            Fundamental Quality
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: getScoreColor(fundamentalQuality), marginBottom: '8px' }}>
            {formatScore(fundamentalQuality)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>0-100 scale</div>
        </div>

        {/* DCA Suitability Score */}
        <div style={{ borderLeft: '4px solid var(--purple)', paddingLeft: '16px' }}>
          <div style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>
            DCA Suitability
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: getScoreColor(dcaSuitability), marginBottom: '8px' }}>
            {formatScore(dcaSuitability)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Technical signals</div>
        </div>

        {/* Final Conviction Score */}
        <div style={{ borderLeft: '4px solid var(--green)', paddingLeft: '16px' }}>
          <div style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>
            Final Conviction
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: getScoreColor(finalConviction), marginBottom: '8px' }}>
            {formatScore(finalConviction)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Blended score</div>
        </div>

        {/* Staleness Penalty */}
        <div style={{ borderLeft: '4px solid var(--orange)', paddingLeft: '16px' }}>
          <div style={{ color: 'var(--text-2)', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>
            Fundamentals Freshness
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: getStalenessColor(stalenessPenalty), marginBottom: '8px' }}>
            {stalenessPenalty !== null ? `${Math.round(stalenessPenalty * 100)}%` : 'N/A'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            Fundamentals as of {formatDate(fundamentalsLastUpdated)}
          </div>
        </div>
      </div>

      {/* Methodology note - Collapsible */}
      <button
        onClick={() => setShowMethodology(!showMethodology)}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: 'var(--surface2)',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          transition: 'all 0.2s',
          boxShadow: 'var(--shadow-xs)'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        <p style={{ fontSize: '13px', fontWeight: '600', margin: 0, color: 'var(--text-2)' }}>Scoring Methodology</p>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: 'var(--text-2)', transition: 'transform 0.2s', transform: showMethodology ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {showMethodology && (
        <div style={{ padding: '16px 0', marginTop: '12px' }}>
          <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc', fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>
              <strong>Fundamental Quality:</strong> Z-scored financial factors (ROIC, profitability, valuations) weighted by current macro regime
            </li>
            <li>
              <strong>DCA Suitability:</strong> Technical signals based on Enhanced DCA algorithm (RSI, volatility)
            </li>
            <li>
              <strong>Final Conviction:</strong> DCA Suitability Score weighted by current macro regime and sector (avoids fundamental look-ahead bias)
            </li>
            <li>
              <strong>Fundamentals Freshness:</strong> Time-decay factor based on days since the underlying fundamentals data (ROIC, EV/EBITDA, beta, etc.) was last refreshed (5% daily decay) — this can lag well behind the "scores computed" date above, since the score can be recomputed daily using the same, unrefreshed fundamentals.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
