'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';

interface TierLimit {
  tier: number;
  max_watchlists: number;
  max_portfolios: number;
  asset_swap_limit_per_month: number;
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

export default function AdminTierLimitsPage() {
  const supabase = createClient();
  const [limits, setLimits] = useState<TierLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadLimits();
  }, []);

  const loadLimits = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('tier_limits')
        .select('*')
        .order('tier');

      if (fetchError) throw fetchError;
      setLimits((data as TierLimit[]) || []);
    } catch (err) {
      setError('Failed to load tier limits');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (tier: number, field: keyof TierLimit, value: number) => {
    const updatedLimits = limits.map(l =>
      l.tier === tier ? { ...l, [field]: value } : l
    );
    setLimits(updatedLimits);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      for (const limit of limits) {
        const { error } = await supabase
          .from('tier_limits')
          .update({
            max_watchlists: limit.max_watchlists,
            max_portfolios: limit.max_portfolios,
            asset_swap_limit_per_month: limit.asset_swap_limit_per_month,
            updated_at: new Date().toISOString(),
          })
          .eq('tier', limit.tier);

        if (error) throw error;
      }

      setSuccess('Tier limits updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save tier limits');
      console.error(err);
      loadLimits(); // Reload to undo changes
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-2)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', color: 'var(--text)' }}>
        Tier Limits Configuration
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '32px' }}>
        Configure the maximum number of watchlists, portfolios, and asset swaps for each tier.
      </p>

      {error && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          background: 'rgba(255, 107, 107, 0.1)',
          color: '#ff6b6b',
          border: '1px solid rgba(255, 107, 107, 0.3)',
          marginBottom: '24px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          background: 'rgba(0, 200, 180, 0.1)',
          color: 'var(--teal)',
          border: '1px solid rgba(0, 200, 180, 0.3)',
          marginBottom: '24px',
          fontSize: '14px'
        }}>
          ✓ {success}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        {limits.map((limit) => (
          <div
            key={limit.tier}
            style={{
              background: 'var(--surface)',
              border: `2px solid ${TIER_COLORS[limit.tier]}`,
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: TIER_COLORS[limit.tier],
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: TIER_COLORS[limit.tier]
              }} />
              {TIER_NAMES[limit.tier]} (Tier {limit.tier})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'var(--text-3)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}>
                  Max Watchlists
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={limit.max_watchlists}
                  onChange={(e) => handleUpdate(limit.tier, 'max_watchlists', parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-3)',
                  marginTop: '4px'
                }}>
                  Number of custom watchlists allowed
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'var(--text-3)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}>
                  Max Portfolios
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={limit.max_portfolios}
                  onChange={(e) => handleUpdate(limit.tier, 'max_portfolios', parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-3)',
                  marginTop: '4px'
                }}>
                  Number of saved portfolios allowed
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'var(--text-3)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}>
                  Asset Swaps per Month
                </label>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={limit.asset_swap_limit_per_month}
                  onChange={(e) => handleUpdate(limit.tier, 'asset_swap_limit_per_month', parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{
                  fontSize: '11px',
                  color: 'var(--text-3)',
                  marginTop: '4px'
                }}>
                  Max changes to watchlist assets per month (0 = unlimited)
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={loadLimits}
          disabled={saving}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-2)',
            fontWeight: '600',
            fontSize: '14px',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1
          }}
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--teal)',
            color: 'var(--bg)',
            fontWeight: '600',
            fontSize: '14px',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
