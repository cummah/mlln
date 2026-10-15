'use client';

import Link from 'next/link';

export function SectorsTopbar() {
  return (
    <div className="app-topbar" style={{
      position: 'sticky',
      top: 0,
      zIndex: 5,
      background: 'rgba(6,15,26,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      padding: '12px 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div className="tb-crumb" style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: 'var(--text)' }}>Sectors</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="tb-share" style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border-elevated)',
          color: 'var(--text-2)',
          borderRadius: '8px',
          padding: '7px 14px',
          fontSize: '12.5px',
          fontWeight: '500',
          cursor: 'pointer',
          fontFamily: 'DM Sans, sans-serif',
          transition: 'all 0.15s',
          boxShadow: 'var(--shadow-xs)'
        }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--teal)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--teal)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'; }}>
          Share
        </button>
        <Link href="/#pricing" style={{ textDecoration: 'none' }}>
          <button style={{
            background: 'var(--teal)',
            color: '#040e18',
            border: '1px solid var(--teal)',
            fontSize: '12.5px',
            fontWeight: '600',
            borderRadius: '8px',
            padding: '7px 14px',
            cursor: 'pointer',
            fontFamily: 'DM Sans, sans-serif',
            transition: 'opacity 0.15s'
          }} onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'} onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}>
            Pricing
          </button>
        </Link>
      </div>
    </div>
  );
}
