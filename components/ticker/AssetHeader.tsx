'use client';

import { motion } from 'framer-motion';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import type { AssetData } from '@/types';

interface AssetHeaderProps {
  asset: AssetData;
  score?: number | null;
  updatedAt?: string;
}

function getScoreBadge(score?: number | null): { label: string; color: string; background: string; border: string } {
  if (score == null) {
    return { label: 'No score yet', color: 'var(--text-2)', background: 'var(--surface2)', border: 'var(--border)' };
  }
  if (score >= 70) {
    return { label: 'Opportunity', color: 'var(--green)', background: 'var(--green-dim)', border: 'rgba(40,217,126,0.2)' };
  }
  if (score >= 40) {
    return { label: 'Neutral', color: 'var(--text-2)', background: 'var(--surface2)', border: 'var(--border)' };
  }
  return { label: 'Caution', color: '#E24B4A', background: 'rgba(226,75,74,0.08)', border: 'rgba(226,75,74,0.2)' };
}

export function AssetHeader({ asset, score, updatedAt }: AssetHeaderProps) {
  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';
  const scoreBadge = getScoreBadge(score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Icon */}
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: '700',
            color: 'var(--text)',
            flexShrink: 0
          }}>
            {asset.ticker.substring(0, 1)}
          </div>

          {/* Meta */}
          <div>
            <h1 className="rs-h1" style={{ fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px', lineHeight: '1', margin: 0, marginBottom: '8px' }}>
              {asset.ticker} DCA Backtest — Dollar Cost Averaging Results
            </h1>
            <div style={{ fontSize: '13.5px', color: 'var(--text-2)', marginTop: '8px' }}>
              {asset.name} · {asset.sector || 'ETF'}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '500', background: scoreBadge.background, border: `1px solid ${scoreBadge.border}`, color: scoreBadge.color }}>
                {scoreBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* DCA Score */}
        <div className="rs-score" style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', marginBottom: '4px' }}>
            DCA Score
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', fontFamily: 'DM Mono, monospace', letterSpacing: '-1px', color: 'var(--text)' }}>
            {score == null ? '—' : Math.round(score)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
            Updated {formattedDate}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
