'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { GatingSection, TierPermissions, UserTier } from '@/types';

const SECTIONS: GatingSection[] = ['asset_page', 'rank', 'sectors', 'watchlist', 'weekly_signals', 'monthly_signals'];
const TIERS: UserTier[] = [0, 1, 2, 3];

const SECTION_NAMES: Record<GatingSection, string> = {
  asset_page: 'Asset Page',
  rank: 'Rank',
  sectors: 'Sectors',
  watchlist: 'Watchlist',
  weekly_signals: 'Weekly Signals',
  monthly_signals: 'Monthly Signals'
};

const TIER_NAMES: Record<UserTier, string> = {
  0: 'Tier 0 (No Plan)',
  1: 'Tier 1 (Limited)',
  2: 'Tier 2 (Full)',
  3: 'Tier 3 (Pro)'
};

export default function AdminPermissionsPage() {
  const supabase = createClient();
  const [permissions, setPermissions] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('tier_permissions')
        .select('section, tier, can_view_latest_signal');

      if (fetchError) throw fetchError;

      const map = new Map<string, boolean>();
      (data as TierPermissions[]).forEach(row => {
        const key = `${row.section}:${row.tier}`;
        map.set(key, row.can_view_latest_signal);
      });

      setPermissions(map);
    } catch (err) {
      setError('Failed to load permissions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (section: GatingSection, tier: UserTier) => {
    const key = `${section}:${tier}`;
    const newValue = !permissions.get(key);
    setPermissions(new Map(permissions.set(key, newValue)));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Build update payloads
      const updates = SECTIONS.flatMap(section =>
        TIERS.map(tier => ({
          section,
          tier,
          can_view_latest_signal: permissions.get(`${section}:${tier}`) ?? false
        }))
      );

      // Upsert each row
      for (const update of updates) {
        const { error: upsertError } = await supabase
          .from('tier_permissions')
          .upsert(update, { onConflict: 'section,tier' });

        if (upsertError) throw upsertError;
      }

      setSuccess('Permissions saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to save permissions');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-2)' }}>
        Loading permissions...
      </div>
    );
  }

  return (
    <div style={{ padding: '40px 20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', color: 'var(--text)' }}>
        Tier Permissions
      </h1>
      <p style={{ color: 'var(--text-2)', marginBottom: '32px', fontSize: '14px' }}>
        Control which tiers can view the latest signals for each section
      </p>

      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(255, 107, 107, 0.1)',
          color: '#ff6b6b',
          border: '1px solid rgba(255, 107, 107, 0.3)',
          marginBottom: '24px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(0, 200, 180, 0.1)',
          color: 'var(--teal)',
          border: '1px solid rgba(0, 200, 180, 0.3)',
          marginBottom: '24px'
        }}>
          {success}
        </div>
      )}

      {/* Permissions Grid */}
      <div style={{
        overflowX: 'auto',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px'
        }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{
                padding: '16px',
                textAlign: 'left',
                fontWeight: '600',
                color: 'var(--text)',
                background: 'var(--surface2)'
              }}>
                Section
              </th>
              {TIERS.map(tier => (
                <th
                  key={tier}
                  style={{
                    padding: '16px',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: 'var(--text)',
                    background: 'var(--surface2)',
                    minWidth: '140px'
                  }}
                >
                  {TIER_NAMES[tier]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map(section => (
              <tr key={section} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{
                  padding: '16px',
                  fontWeight: '600',
                  color: 'var(--text)',
                  background: 'var(--surface2)'
                }}>
                  {SECTION_NAMES[section]}
                </td>
                {TIERS.map(tier => {
                  const key = `${section}:${tier}`;
                  const isEnabled = permissions.get(key) ?? false;

                  return (
                    <td
                      key={key}
                      style={{
                        padding: '16px',
                        textAlign: 'center'
                      }}
                    >
                      <button
                        onClick={() => togglePermission(section, tier)}
                        style={{
                          width: '48px',
                          height: '28px',
                          borderRadius: '14px',
                          border: 'none',
                          background: isEnabled ? 'var(--teal)' : 'var(--border)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.opacity = '0.8';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          width: '24px',
                          height: '24px',
                          borderRadius: '12px',
                          background: 'white',
                          top: '2px',
                          left: isEnabled ? '22px' : '2px',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                        }} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save Button */}
      <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
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
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <button
          onClick={loadPermissions}
          disabled={saving}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-2)',
            fontWeight: '600',
            fontSize: '14px',
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}
