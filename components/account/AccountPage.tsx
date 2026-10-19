'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import { usePendingTierUpgrade } from '@/lib/hooks/usePendingTierUpgrade';
import type { UserProfile } from '@/types';

interface AccountUser {
  id: string;
  email?: string;
}

const TIER_NAMES: Record<number, string> = {
  0: 'Free',
  1: 'Essential',
  2: 'Premium',
  3: 'Pro',
};

export default function AccountPage({ user }: { user: AccountUser }) {
  const router = useRouter();
  const supabase = createClient();
  const { upgraded, newTier } = usePendingTierUpgrade();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [assets, setAssets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newAsset, setNewAsset] = useState('');
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      let profile = profileData as UserProfile;

      // If profile doesn't exist, create it
      if (fetchError && profile === null) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert([{ user_id: user.id, tier: 0 }])
          .select()
          .single();
        profile = newProfile as UserProfile;
      }

      setProfile(profile);

      if (profile?.tier === 1) {
        const { data: assetsData } = await supabase
          .from('user_assets')
          .select('ticker')
          .eq('user_id', user.id);
        setAssets((assetsData || []).map(a => a.ticker));
      }
    } catch (err) {
      setError('Failed to load profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.id, supabase]);

  useEffect(() => {
    if (upgraded && newTier) {
      setSuccess(`Welcome to ${TIER_NAMES[newTier]}! Your account has been upgraded.`);
      loadData();
      setTimeout(() => setSuccess(null), 5000);
    }
  }, [upgraded, newTier]);

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset || adding || !profile) return;

    if (profile.tier === 1 && assets.length >= 20) {
      setError('You can only add 20 assets for Tier 1');
      return;
    }

    setAdding(true);
    try {
      const { error: insertError } = await supabase.from('user_assets').insert([
        { user_id: user.id, ticker: newAsset.toUpperCase() }
      ]);

      if (insertError) throw insertError;
      setAssets([...assets, newAsset.toUpperCase()]);
      setNewAsset('');
    } catch (err) {
      setError('Failed to add asset');
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveAsset = async (ticker: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('user_assets')
        .delete()
        .eq('user_id', user.id)
        .eq('ticker', ticker);

      if (deleteError) throw deleteError;
      setAssets(assets.filter(a => a !== ticker));
    } catch (err) {
      setError('Failed to remove asset');
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-2)' }}>
        Loading...
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-2)' }}>
        Profile not found
      </div>
    );
  }

  const tierNames: Record<0 | 1 | 2 | 3, string> = {
    0: 'No Plan',
    1: 'Tier 1 - Limited',
    2: 'Tier 2 - Full Access',
    3: 'Tier 3 - Pro'
  };

  const tierColors: Record<0 | 1 | 2 | 3, string> = {
    0: '#666',
    1: '#FFA500',
    2: 'var(--teal)',
    3: '#FFD700'
  };

  return (
    <div style={{ padding: '40px 20px', maxWidth: '800px', margin: '0 auto' }}>
      {success && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          background: 'rgba(0, 200, 180, 0.1)',
          color: 'var(--teal)',
          border: '1px solid rgba(0, 200, 180, 0.3)',
          marginBottom: '24px',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          ✓ {success}
        </div>
      )}

      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '24px', color: 'var(--text)' }}>
          Account
        </h1>

        {/* User Info */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Email
            </div>
            <div style={{ fontSize: '16px', color: 'var(--text)' }}>
              {user.email}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Current Plan
            </div>
            <div style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: '8px',
              background: `${tierColors[profile.tier]}20`,
              color: tierColors[profile.tier],
              fontWeight: '600',
              fontSize: '14px'
            }}>
              {tierNames[profile.tier]}
            </div>
          </div>

          {profile.current_period_end && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Billing Period Ends
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                {new Date(profile.current_period_end).toLocaleDateString()}
              </div>
            </div>
          )}

          {profile.tier === 0 && (
            <a
              href="/#pricing"
              style={{
                display: 'inline-block',
                marginTop: '8px',
                padding: '10px 20px',
                borderRadius: '8px',
                background: 'var(--teal)',
                color: 'var(--bg)',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Upgrade Plan
            </a>
          )}
        </div>

        {/* Tier 1 Assets Management */}
        {profile.tier === 1 && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: 'var(--text)' }}>
              Your 20 Assets
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '16px' }}>
              {assets.length} / 20 assets added. You can swap up to 5 times per month.
            </p>

            {/* Asset List */}
            {assets.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: '12px'
                }}>
                  {assets.map(ticker => (
                    <div
                      key={ticker}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        borderRadius: '8px',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        gap: '8px'
                      }}
                    >
                      <span style={{ fontWeight: '600', color: 'var(--text)' }}>
                        {ticker}
                      </span>
                      <button
                        onClick={() => handleRemoveAsset(ticker)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ff6b6b',
                          cursor: 'pointer',
                          fontSize: '18px',
                          padding: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Remove asset"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Asset Form */}
            {assets.length < 20 && (
              <form onSubmit={handleAddAsset} style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Enter ticker (e.g., AAPL)"
                  value={newAsset}
                  onChange={(e) => setNewAsset(e.target.value)}
                  disabled={adding}
                  maxLength={5}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}
                />
                <button
                  type="submit"
                  disabled={!newAsset || adding}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--teal)',
                    color: 'var(--bg)',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: adding || !newAsset ? 'not-allowed' : 'pointer',
                    opacity: adding || !newAsset ? 0.6 : 1
                  }}
                >
                  {adding ? 'Adding...' : 'Add'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Error Messages */}
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

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-2)',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)';
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
