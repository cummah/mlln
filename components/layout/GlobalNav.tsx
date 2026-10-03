'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

export function GlobalNav() {
  const pathname = usePathname() || '';

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div style={{
      width: '220px',
      minWidth: '220px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      zIndex: 10,
      height: '100vh',
      overflow: 'hidden'
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 18px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0
      }}>
        <div style={{
          fontSize: '20px',
          fontWeight: '800',
          letterSpacing: '-0.02em',
          color: 'var(--text)',
          fontFamily: 'DM Sans, sans-serif'
        }}>
          ml<span style={{ color: 'var(--teal)' }}>ln</span>
        </div>
      </div>

      {/* Navigation */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingLeft: '8px',
        paddingRight: '8px',
        paddingTop: '8px',
        paddingBottom: '8px'
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          padding: '12px 12px',
          marginBottom: '4px'
        }}>
          Navigation
        </div>

        <NavItem
          href="/asset/daily"
          label="Daily"
          active={isActive('/asset/daily')}
          icon={<DailyIcon />}
        />
        <NavItem
          href="/asset/weekly"
          label="Weekly"
          active={isActive('/asset/weekly')}
          icon={<WeeklyIcon />}
        />
        <NavItem
          href="/asset/monthly"
          label="Monthly"
          active={isActive('/asset/monthly')}
          icon={<MonthlyIcon />}
        />
        <NavItem
          href="/asset/compare"
          label="Compare"
          active={isActive('/asset/compare')}
          icon={<RankIcon />}
        />
        <NavItem
          href="/sectors"
          label="Sector"
          active={isActive('/sectors')}
          icon={<SectorIcon />}
        />
        <NavItem
          href="/rank"
          label="Rank"
          active={isActive('/rank')}
          icon={<RankIcon />}
        />
        <NavItem
          href="/portfolio"
          label="Portfolio"
          active={isActive('/portfolio')}
          icon={<PortfolioIcon />}
        />

        <div style={{
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          padding: '12px 12px',
          marginTop: '8px',
          marginBottom: '4px'
        }}>
          Tools
        </div>

        <NavItem
          href="/watchlist"
          label="Watchlist"
          active={isActive('/watchlist')}
          icon={<WatchlistIcon />}
        />
        <NavItem
          href="/portfolio"
          label="My Portfolio"
          active={isActive('/portfolio')}
          icon={<PortfolioIcon />}
        />

        <div style={{
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          padding: '12px 12px',
          marginTop: '8px',
          marginBottom: '4px'
        }}>
          Mlln
        </div>

        <NavItem
          href="/about"
          label="About"
          active={isActive('/about')}
          icon={<InfoIcon />}
        />
        <NavItem
          href="/methodology"
          label="Methodology"
          active={isActive('/methodology')}
          icon={<MethodologyIcon />}
        />
        <NavItem
          href="/score-criteria"
          label="Score Criteria"
          active={isActive('/score-criteria')}
          icon={<CriteriaIcon />}
        />
        <NavItem
          href="/privacy"
          label="Privacy"
          active={isActive('/privacy')}
          icon={<PrivacyIcon />}
        />
      </div>

      {/* Account Section */}
      <div style={{
        padding: '12px 8px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <a
          href="/upgrade"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '600',
            background: 'var(--teal)',
            color: 'var(--bg)',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            border: 'none'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = 'var(--teal-mid)';
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 2px 8px rgba(0, 200, 180, 0.2)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = 'var(--teal)';
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
          }}
        >
          Upgrade to Pro
        </a>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 8px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--teal-dim)',
            border: '1px solid var(--teal-mid)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '700',
            color: 'var(--teal)',
            flexShrink: 0
          }}>
            JD
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text)',
              marginBottom: '2px'
            }}>
              James D.
            </div>
            <span style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '600',
              background: 'var(--teal-dim)',
              color: 'var(--teal)'
            }}>
              Guest
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  active,
  icon
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        margin: '1px'
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        const link = el.querySelector('a') as HTMLAnchorElement;
        if (link && !active) {
          link.style.background = 'var(--surface2)';
          link.style.color = 'var(--text)';
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        const link = el.querySelector('a') as HTMLAnchorElement;
        if (link && !active) {
          link.style.background = 'transparent';
          link.style.color = 'var(--text-2)';
        }
      }}
    >
      <Link
        href={href}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: '500',
          transition: 'all 0.2s',
          textDecoration: 'none',
          flex: 1,
          background: active ? 'var(--teal-dim)' : 'transparent',
          color: active ? 'var(--teal)' : 'var(--text-2)',
          cursor: 'pointer'
        }}
      >
        <span style={{
          display: 'flex',
          flexShrink: 0,
          opacity: active ? 1 : 0.7,
          transition: 'opacity 0.2s'
        }}>
          {icon}
        </span>
        <span>{label}</span>
      </Link>
    </div>
  );
}

function PortfolioIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function WatchlistIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function DailyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="6" x2="12" y2="12" />
      <line x1="12" y1="12" x2="15" y2="15" />
    </svg>
  );
}

function WeeklyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function MonthlyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2" />
    </svg>
  );
}

function SectorIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
      <circle cx="17.66" cy="6.34" r="1" />
      <circle cx="6.34" cy="17.66" r="1" />
    </svg>
  );
}

function RankIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5 12 3" />
      <line x1="12" y1="12" x2="20" y2="7.5" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <line x1="12" y1="12" x2="4" y2="7.5" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function MethodologyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function CriteriaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PrivacyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
