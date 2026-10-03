'use client';

import Link from 'next/link';

interface RelatedAssetCardProps {
  ticker: string;
  name: string;
}

export function RelatedAssetCard({ ticker, name }: RelatedAssetCardProps) {
  return (
    <Link href={`/asset/${ticker.toLowerCase()}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          padding: '16px',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-elevated)',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: 'var(--inset-top), var(--shadow-md)',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = 'var(--teal)';
          el.style.background = 'var(--surface2-elevated)';
          el.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.borderColor = 'var(--border-elevated)';
          el.style.background = 'var(--surface-elevated)';
          el.style.transform = 'translateY(0)';
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
          {ticker}
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--text-2)', marginBottom: '8px' }}>
          {name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
          View DCA results →
        </div>
      </div>
    </Link>
  );
}
