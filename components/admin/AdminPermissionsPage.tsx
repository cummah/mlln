'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { GatingSection, TierPermissions, UserTier } from '@/types';

const SECTIONS: GatingSection[] = ['asset_page', 'rank', 'sectors', 'watchlist', 'weekly_signals', 'monthly_signals', 'admin'];
const TIERS: UserTier[] = [0, 1, 2, 3, 4];

const SECTION_NAMES: Record<GatingSection, string> = {
  asset_page: 'Asset Page',
  rank: 'Rank',
  sectors: 'Sectors',
  watchlist: 'Watchlist',
  weekly_signals: 'Weekly Signals',
  monthly_signals: 'Monthly Signals',
  admin: 'Admin'
};

const TIER_NAMES: Record<UserTier, string> = {
  0: 'Tier 0 (No Plan)',
  1: 'Tier 1 (Limited)',
  2: 'Tier 2 (Full)',
  3: 'Tier 3 (Pro)',
  4: 'Tier 4 (Admin)'
};

interface Tier0User {
  user_id: string;
  email: string;
  tier: number;
  created_at: string;
}

export default function AdminPermissionsPage() {
  const supabase = createClient();
  const [permissions, setPermissions] = useState<Map<string, boolean>>(new Map());
  const [tier0Users, setTier0Users] = useState<Tier0User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  useEffect(() => {
    loadPermissions();
    loadTier0Users();
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

  const loadTier0Users = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('user_id, created_at, tier')
        .eq('tier', 0);

      if (fetchError) throw fetchError;

      // Fetch user emails from auth
      const usersWithEmails = await Promise.all(
        (data || []).map(async (profile) => {
          const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id);
          return {
            user_id: profile.user_id,
            email: authUser?.user?.email || 'unknown',
            tier: profile.tier,
            created_at: profile.created_at
          };
        })
      );

      setTier0Users(usersWithEmails as Tier0User[]);
    } catch (err) {
      console.error('Failed to load tier 0 users:', err);
    }
  };

  const updateUserTier = async (userId: string, newTier: number) => {
    setUpdatingUser(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ tier: newTier })
        .eq('user_id', userId);

      if (error) throw error;

      setSuccess('User tier updated successfully!');
      loadTier0Users();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to update user tier');
      console.error(err);
    } finally {
      setUpdatingUser(null);
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

      {/* Tier 0 Users Management */}
      <div style={{ marginTop: '64px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: 'var(--text)' }}>
          Free Tier Users (Marketing List)
        </h2>
        <p style={{ color: 'var(--text-2)', marginBottom: '24px', fontSize: '14px' }}>
          Users who signed up for free portfolio access. Manage or upgrade their tiers.
        </p>

        {tier0Users.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            background: 'var(--surface)',
            borderRadius: '12px',
            color: 'var(--text-2)',
            border: '1px solid var(--border)'
          }}>
            No free tier users yet
          </div>
        ) : (
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
                    Email
                  </th>
                  <th style={{
                    padding: '16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: 'var(--text)',
                    background: 'var(--surface2)'
                  }}>
                    Created
                  </th>
                  <th style={{
                    padding: '16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: 'var(--text)',
                    background: 'var(--surface2)'
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tier0Users.map(user => (
                  <tr key={user.user_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px', color: 'var(--text)' }}>
                      {user.email}
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-2)', fontSize: '12px' }}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[1, 2, 3].map(tier => (
                          <button
                            key={tier}
                            onClick={() => updateUserTier(user.user_id, tier)}
                            disabled={updatingUser === user.user_id}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'transparent',
                              color: 'var(--text-2)',
                              fontSize: '12px',
                              cursor: updatingUser === user.user_id ? 'not-allowed' : 'pointer',
                              opacity: updatingUser === user.user_id ? 0.6 : 1,
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (updatingUser !== user.user_id) {
                                e.currentTarget.style.background = 'var(--teal)';
                                e.currentTarget.style.color = 'white';
                                e.currentTarget.style.borderColor = 'var(--teal)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = 'var(--text-2)';
                              e.currentTarget.style.borderColor = 'var(--border)';
                            }}
                          >
                            Tier {tier}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
