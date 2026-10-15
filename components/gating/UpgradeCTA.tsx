'use client';

import { useRouter } from 'next/navigation';

export function UpgradeCTA({ section }: { section: string }) {
  const router = useRouter();

  return (
    <div style={{
      padding: '16px',
      borderRadius: '8px',
      background: 'linear-gradient(135deg, rgba(0, 200, 180, 0.1) 0%, rgba(0, 200, 180, 0.05) 100%)',
      border: '1px solid rgba(0, 200, 180, 0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px'
    }}>
      <div>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: 'var(--text)',
          marginBottom: '4px'
        }}>
          Unlock latest signals
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--text-2)'
        }}>
          Upgrade to view the latest {section.replace(/_/g, ' ')} data
        </div>
      </div>
      <button
        onClick={() => router.push('/#pricing')}
        style={{
          padding: '8px 16px',
          borderRadius: '6px',
          border: 'none',
          background: 'var(--teal)',
          color: 'var(--bg)',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '0.9';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '1';
        }}
      >
        Upgrade
      </button>
    </div>
  );
}
