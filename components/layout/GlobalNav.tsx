'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { AnimatedLogo } from '@/components/ui/AnimatedLogo';

interface UserInfo {
  email: string;
  display_name: string | null;
  tier: number;
}

// Expose a function to refresh user info globally
declare global {
  interface Window {
    refreshUserNav?: () => Promise<void>;
  }
}

const TIER_NAMES: Record<number, string> = {
  0: 'Free',
  1: 'Essential',
  2: 'Full Access',
  3: 'Pro',
};

const TIER_COLORS: Record<number, string> = {
  0: '#666',
  1: '#FFA500',
  2: 'var(--teal)',
  3: '#FFD700',
};

export function GlobalNav() {
  const pathname = usePathname() || '';
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadUserInfo();

    // Expose refresh function globally for dynamic updates
    (window as any).refreshUserNav = loadUserInfo;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUserInfo();
    });

    return () => {
      subscription?.unsubscribe();
      delete (window as any).refreshUserNav;
    };
  }, []);


  const loadUserInfo = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, tier')
        .eq('user_id', authUser.id)
        .single();

      if (profile) {
        setUser({
          email: authUser.email || '',
          display_name: profile.display_name,
          tier: profile.tier
        });
      }
    } catch (err) {
      console.error('Failed to load user info:', err);
    } finally {
      setLoading(false);
    }
  };

  const isActive = (href: string) => pathname.startsWith(href);

  // Below the md breakpoint the sidebar becomes an off-canvas drawer (see globals.css).
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
    <button
      type="button"
      className="gn-toggle"
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
      onClick={() => setOpen(o => !o)}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </svg>
    </button>
    <div className="gn-backdrop" data-open={open} onClick={() => setOpen(false)} />
    <div className="gn" data-open={open}>
      {/* Logo */}
      <div style={{
        padding: '20px 18px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0
      }}>
        <AnimatedLogo />
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
        <NavItem
          href="/watchlist"
          label="Watchlist"
          active={isActive('/watchlist')}
          icon={<WatchlistIcon />}
        />

        {(user && user.tier >= 1) || user ? (
          <>
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

            {user && user.tier >= 1 && (
              <NavItem
                href="/my-watchlist"
                label="My Watchlist"
                active={isActive('/my-watchlist')}
                icon={<WatchlistIcon />}
              />
            )}

            {user && (
              <NavItem
                href="/my-portfolio"
                label="My Portfolios"
                active={isActive('/my-portfolio')}
                icon={<PortfolioIcon />}
              />
            )}
          </>
        ) : null}

        {user && user.tier === 4 && (
          <>
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
              Admin
            </div>
            <NavItem
              href="/asset/daily"
              label="Daily"
              active={isActive('/asset/daily')}
              icon={<DailyIcon />}
            />
            <NavItem
              href="/admin/permissions"
              label="Tier Permissions"
              active={isActive('/admin/permissions')}
              icon={<SettingsIcon />}
            />
            <NavItem
              href="/admin/tier-limits"
              label="Tier Limits"
              active={isActive('/admin/tier-limits')}
              icon={<SettingsIcon />}
            />
            <NavItem
              href="/admin/etf-config-comparison"
              label="ETF Config"
              active={isActive('/admin/etf-config-comparison')}
              icon={<SettingsIcon />}
            />
          </>
        )}

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
        <NavItem
          href="/terms"
          label="Terms"
          active={isActive('/terms')}
          icon={<TermsIcon />}
        />
        <NavItem
          href="/cookie-policy"
          label="Cookies"
          active={isActive('/cookie-policy')}
          icon={<CookieIcon />}
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
        {!loading && !user ? (
          <>
            <Link
              href="/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                background: 'transparent',
                color: 'var(--text)',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: '1px solid var(--border)'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
              }}
            >
              Login
            </Link>
            <a
              href="/#pricing"
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
              Pricing
            </a>
          </>
        ) : user ? (
          <>
            <Link
              href="/account"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: '1px solid var(--border)',
                background: 'transparent'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: TIER_COLORS[user.tier] + '20',
                border: `1px solid ${TIER_COLORS[user.tier]}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '700',
                color: TIER_COLORS[user.tier],
                flexShrink: 0
              }}>
                {(user.display_name || user.email).charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: 'var(--text)',
                  marginBottom: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {user.display_name || user.email}
                </div>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  background: TIER_COLORS[user.tier] + '20',
                  color: TIER_COLORS[user.tier]
                }}>
                  {TIER_NAMES[user.tier]}
                </span>
              </div>
            </Link>
          </>
        ) : (
          <div style={{ color: 'var(--text-2)', fontSize: '12px', textAlign: 'center' }}>
            Loading...
          </div>
        )}
      </div>
    </div>
    </>
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

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m0 4.24l4.24 4.24M19.78 4.22l-4.24 4.24m0 4.24l-4.24 4.24" />
    </svg>
  );
}

function TermsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function CookieIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M7 14s1.5 2 5 2 5-2 5-2" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="15" cy="9" r="1" />
    </svg>
  );
}
