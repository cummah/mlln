'use client';

import Link from 'next/link';

interface MyWatchlistCardProps {
  id: string;
  name: string;
  assetCount: number;
  createdAt: string;
}

export function MyWatchlistCard({ id, name, assetCount, createdAt }: MyWatchlistCardProps) {
  return (
    <Link
      href={`/my-watchlist/${id}`}
      style={{
        textDecoration: 'none',
        display: 'block',
      }}
    >
      <div
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border-elevated)',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: 'var(--inset-top), var(--shadow-md)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--teal)'
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-elevated)'
          e.currentTarget.style.transform = 'none'
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text)', margin: '0 0 8px 0' }}>
          {name}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: '0 0 16px 0', flex: 1 }}>
          {assetCount} asset{assetCount !== 1 ? 's' : ''}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-3)', margin: 0 }}>
          Created {new Date(createdAt).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );
}
