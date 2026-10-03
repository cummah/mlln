'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Asset {
  ticker: string;
  name: string;
}

interface DashboardTopbarProps {
  /** Trailing breadcrumb label. Defaults to the asset-detail wording this
   *  topbar was originally written for; the portfolio page passes its own so the
   *  page no longer renders a second, contradictory breadcrumb of its own. */
  breadcrumb?: string;
}

export function DashboardTopbar({ breadcrumb = 'Asset Details' }: DashboardTopbarProps = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Asset[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch all assets on mount
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const response = await fetch('/api/assets');
        if (response.ok) {
          const data = await response.json();
          setAssets(data);
        }
      } catch (err) {
        console.error('Error fetching assets:', err);
      }
    };
    fetchAssets();
  }, []);

  // Handle search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = assets.filter(asset =>
      asset.ticker.toLowerCase().includes(query) ||
      asset.name.toLowerCase().includes(query)
    );

    setResults(filtered.slice(0, 8));
    setShowResults(true);
  }, [searchQuery, assets]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAsset = (ticker: string) => {
    router.push(`/asset/${ticker.toLowerCase()}`);
    setSearchQuery('');
    setShowResults(false);
  };

  return (
    <div style={{
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
      <div style={{ fontSize: '12px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <a href="/dashboard" style={{ color: 'var(--text-2)', textDecoration: 'none', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'var(--teal)'} onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-2)'}>Assets</a>
        <span>›</span>
        <span style={{ color: 'var(--text)' }}>{breadcrumb}</span>
      </div>

      {/* Search Bar */}
      <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: '350px', margin: '0 24px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search assets or ticker..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={(e) => {
              if (searchQuery) setShowResults(true);
              (e.target as HTMLInputElement).style.borderColor = 'var(--teal)';
              (e.target as HTMLInputElement).style.background = 'var(--surface)';
            }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
              color: 'var(--text)',
              fontFamily: 'DM Sans, sans-serif',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              if (!(e.target as HTMLInputElement).value) {
                (e.target as HTMLInputElement).style.borderColor = 'var(--teal)';
              }
            }}
            onMouseLeave={(e) => {
              if (!(e.target as HTMLInputElement).value) {
                (e.target as HTMLInputElement).style.borderColor = 'var(--border)';
              }
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = 'var(--border)';
              (e.target as HTMLInputElement).style.background = 'var(--surface2)';
            }}
          />
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-3)',
              pointerEvents: 'none'
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        {/* Dropdown Results */}
        {showResults && results.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-elevated)',
            borderRadius: '8px',
            boxShadow: 'var(--inset-top), var(--shadow-lg)',
            overflow: 'hidden',
            zIndex: 1000
          }}>
            {results.map((asset, idx) => (
              <button
                key={`${asset.ticker}-${idx}`}
                onClick={() => handleSelectAsset(asset.ticker)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: 'var(--text-2)',
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  borderBottom: idx < results.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--teal)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)';
                }}
              >
                <div style={{ fontWeight: '500', color: 'inherit' }}>
                  {asset.ticker.toUpperCase()}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                  {asset.name}
                </div>
              </button>
            ))}
          </div>
        )}

        {showResults && searchQuery && results.length === 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-elevated)',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '13px',
            color: 'var(--text-3)',
            textAlign: 'center',
            boxShadow: 'var(--inset-top), var(--shadow-lg)'
          }}>
            No assets found
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button style={{
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
          Sign up free
        </button>
      </div>
    </div>
  );
}
