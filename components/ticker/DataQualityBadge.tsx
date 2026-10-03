'use client';

import { formatDataQuality } from '@/lib/emaUtils';

interface DataQualityBadgeProps {
  score: number;
  isNewAsset: boolean;
  warningMessage?: string | null;
}

export function DataQualityBadge({
  score,
  isNewAsset,
  warningMessage,
}: DataQualityBadgeProps) {
  const quality = formatDataQuality(score);

  if (!isNewAsset && score >= 90) {
    // Full history - no badge needed
    return null;
  }

  return (
    <div
      style={{
        padding: '12px 16px',
        background: quality.color === 'var(--green)'
          ? 'rgba(72, 199, 142, 0.1)'
          : quality.color === 'var(--cyan)'
          ? 'rgba(0, 194, 255, 0.1)'
          : 'rgba(255, 193, 7, 0.1)',
        border: `1px solid ${quality.color}`,
        borderRadius: '8px',
        marginBottom: '16px',
        fontSize: '12px',
        lineHeight: '1.5',
        color: quality.color,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '16px' }}>{quality.icon}</span>
        <strong>{quality.label}</strong>
        <span style={{ marginLeft: 'auto', opacity: 0.8 }}>
          {quality.percent}% data quality
        </span>
      </div>

      {warningMessage && (
        <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '6px' }}>
          {warningMessage}
        </div>
      )}
    </div>
  );
}
