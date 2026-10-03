'use client';

import Link from 'next/link';
import { sectorToSlug } from '@/lib/sectors';

interface SectorCardProps {
  name: string;
}

export function SectorCard({ name }: SectorCardProps) {
  return (
    <Link href={`/sectors/${sectorToSlug(name)}`} style={{ textDecoration: 'none' }}>
      <div
        style={{
          padding: '20px',
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
        <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>
          {name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '12px', lineHeight: '1.5' }}>
          Analyze {name} stocks with Enhanced DCA insights
        </div>
        <div style={{ fontSize: '11px', color: 'var(--teal)', fontWeight: '500' }}>
          Explore sector →
        </div>
      </div>
    </Link>
  );
}
