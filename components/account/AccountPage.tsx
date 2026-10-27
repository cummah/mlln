'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import { usePendingTierUpgrade } from '@/lib/hooks/usePendingTierUpgrade';
import PricingTiersForAccount from './PricingTiersForAccount';
import WatchlistManagement from './WatchlistManagement';
import PortfolioManagement from './PortfolioManagement';
import SignalPreferencesManagement from './SignalPreferencesManagement';
import type { UserProfile } from '@/types';

interface AccountUser {
  id: string;
  email?: string;
}

type Tab = 'account' | 'assets';

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
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [displayNameSaved, setDisplayNameSaved] = useState(true);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

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
      setDisplayNameInput(profile?.display_name || '');

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

  const handleSaveDisplayName = async () => {
    if (!profile || displayNameInput === profile.display_name) return;

    setSavingName(true);
    setDisplayNameSaved(false);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ display_name: displayNameInput })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, display_name: displayNameInput });
      setDisplayNameSaved(true);
      setSuccess('Display name updated');

      // Refresh the global nav with the new display name
      if (typeof window !== 'undefined' && (window as any).refreshUserNav) {
        await (window as any).refreshUserNav();
      }

      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError('Failed to save display name');
      console.error('[AccountPage] Error saving display name:', err);
      setDisplayNameInput(profile.display_name || '');
    } finally {
      setSavingName(false);
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

  const tierNames: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: 'No Plan',
    1: 'Tier 1 - Limited',
    2: 'Tier 2 - Full Access',
    3: 'Tier 3 - Pro',
    4: 'Tier 4 - Admin'
  };

  const tierColors: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: '#666',
    1: '#FFA500',
    2: 'var(--teal)',
    3: '#FFD700',
    4: '#ec4899'
  };

  const tabs = [
    { id: 'account' as const, label: 'Account & Plan', show: true },
    { id: 'assets' as const, label: 'Assets & Collections', show: profile && profile.tier > 0 }
  ].filter(t => t.show) as { id: Tab; label: string; show: boolean }[];

  return (
    <div style={{ padding: '40px 20px', maxWidth: '900px', margin: '0 auto' }}>
      {success && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(0, 200, 180, 0.1)',
          color: 'var(--teal)',
          border: '1px solid rgba(0, 200, 180, 0.3)',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          ✓ {success}
        </div>
      )}

      <div style={{ marginBottom: '40px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px', color: 'var(--text)' }}>
            Account
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0 }}>
            Manage your profile and plan
          </p>
        </div>

        {/* Tab Navigation */}
        {tabs.length > 1 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border)',
            marginBottom: '32px',
            overflowX: 'auto',
            paddingBottom: '0'
          }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '12px 16px',
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: activeTab === tab.id ? '600' : '500',
                  color: activeTab === tab.id ? 'var(--teal)' : 'var(--text-2)',
                  cursor: 'pointer',
                  borderBottom: activeTab === tab.id ? '2px solid var(--teal)' : '2px solid transparent',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Account & Plan Tab */}
        {activeTab === 'account' && (
          <div style={{ animation: 'fadeIn 0.2s ease-in' }}>
            {/* Personal Information */}
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '28px',
              marginBottom: '24px'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px', color: 'var(--text)' }}>
                Personal Information
              </h2>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>
                  Display Name
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => {
                      setDisplayNameInput(e.target.value);
                      setDisplayNameSaved(false);
                    }}
                    placeholder="Enter your name"
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      maxWidth: '400px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    onClick={handleSaveDisplayName}
                    disabled={savingName || displayNameSaved}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: displayNameSaved ? 'var(--teal)' : 'var(--teal)',
                      color: 'var(--bg)',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: savingName || displayNameSaved ? 'not-allowed' : 'pointer',
                      opacity: savingName ? 0.6 : 1,
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {savingName ? 'Saving...' : displayNameSaved ? '✓ Saved' : 'Save'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>
                  Email Address
                </label>
                <div style={{ fontSize: '14px', color: 'var(--text)', padding: '10px 12px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {user.email}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>
                  Current Plan
                </label>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
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
                  {profile.current_period_end && (
                    <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                      Renews {new Date(profile.current_period_end).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Plan Features */}
            {profile.tier > 0 && (
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '28px',
                marginBottom: '24px'
              }}>
                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px', color: 'var(--text)' }}>
                  Your Plan Features
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                  <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>
                      Custom Watchlists
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
                      {profile.tier === 1 ? '1' : profile.tier === 2 ? '3' : '5'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>
                      {profile.tier === 1 ? 'watchlist' : 'watchlists'} available
                    </div>
                    <a href="/my-watchlist" style={{
                      display: 'inline-block',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      background: 'var(--teal)',
                      color: 'var(--bg)',
                      fontSize: '12px',
                      fontWeight: '600',
                      textDecoration: 'none',
                      transition: 'all 0.2s'
                    }}>
                      {profile.tier === 1 ? 'View My Watchlist' : 'Manage Watchlists'} →
                    </a>
                  </div>
                  <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>
                      Saved Portfolios
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
                      {profile.tier === 1 ? '1' : profile.tier === 2 ? '3' : '5'}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px' }}>
                      {profile.tier === 1 ? 'portfolio' : 'portfolios'} available
                    </div>
                    <a href="/my-portfolio" style={{
                      display: 'inline-block',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      background: 'var(--teal)',
                      color: 'var(--bg)',
                      fontSize: '12px',
                      fontWeight: '600',
                      textDecoration: 'none',
                      transition: 'all 0.2s'
                    }}>
                      View Portfolios →
                    </a>
                  </div>
                  {profile.tier === 1 && (
                    <div style={{ padding: '20px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>
                        Asset Swaps
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
                        5/mo
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                        swap assets in watchlist
                      </div>
                    </div>
                  )}
                </div>

                {profile.tier === 2 && (
                  <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text)' }}>
                      Full Access Features
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <li style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-2)' }}>
                        <span style={{ color: 'var(--teal)', fontWeight: '700' }}>✓</span>
                        <span>2,000+ stocks and ETFs</span>
                      </li>
                      <li style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-2)' }}>
                        <span style={{ color: 'var(--teal)', fontWeight: '700' }}>✓</span>
                        <span>Sector analysis tools</span>
                      </li>
                      <li style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-2)' }}>
                        <span style={{ color: 'var(--teal)', fontWeight: '700' }}>✓</span>
                        <span>Complete ranking table</span>
                      </li>
                      <li style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-2)' }}>
                        <span style={{ color: 'var(--teal)', fontWeight: '700' }}>✓</span>
                        <span>DCA scores & backtests</span>
                      </li>
                    </ul>
                  </div>
                )}

                {profile.tier === 3 && (
                  <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text)' }}>
                      Pro Features
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      <li style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-2)' }}>
                        <span style={{ color: 'var(--teal)', fontWeight: '700' }}>✓</span>
                        <span>Everything in Full Access</span>
                      </li>
                      <li style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-2)' }}>
                        <span style={{ color: 'var(--teal)', fontWeight: '700' }}>✓</span>
                        <span>TradingView indicators</span>
                      </li>
                      <li style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'var(--text-2)' }}>
                        <span style={{ color: 'var(--teal)', fontWeight: '700' }}>✓</span>
                        <span>Advanced strategies</span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Upgrade Options for Lower Tiers */}
            {profile.tier < 3 && profile.tier > 0 && (
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '28px',
                marginBottom: '24px'
              }}>
                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text)' }}>
                  Upgrade Your Plan
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '24px' }}>
                  Unlock more features and take your investing to the next level
                </p>
                <PricingTiersForAccount />
              </div>
            )}

            {/* Free User Upgrade Section */}
            {profile.tier === 0 && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(0, 200, 180, 0.1) 0%, rgba(0, 200, 180, 0.05) 100%)',
                border: '2px solid var(--teal)',
                borderRadius: '12px',
                padding: '32px 28px',
                marginBottom: '40px',
                textAlign: 'center'
              }}>
                <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px' }}>
                  Ready to unlock advanced features?
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--text-2)', marginBottom: '0' }}>
                  Choose a plan below to get started with professional-grade investing tools
                </p>
              </div>
            )}

            {/* Sign Out Button */}
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
        )}


        {/* Assets & Collections Tab */}
        {activeTab === 'assets' && profile.tier > 0 && (
          <div style={{ animation: 'fadeIn 0.2s ease-in' }}>
            {/* Watchlist Management */}
            {profile.tier >= 1 && (
              <div style={{ marginBottom: '32px' }}>
                <WatchlistManagement
                  userId={user.id}
                  tier={profile.tier}
                  maxWatchlists={profile.tier === 1 ? 1 : profile.tier === 2 ? 3 : 5}
                />
              </div>
            )}

            {/* Portfolio Management */}
            <div style={{ marginBottom: '32px' }}>
              <PortfolioManagement
                userId={user.id}
                tier={profile.tier}
                maxPortfolios={profile.tier === 0 ? 1 : profile.tier === 1 ? 1 : profile.tier === 2 ? 3 : 5}
              />
            </div>

            {/* Signal Filter Preferences */}
            {profile.tier >= 2 && (
              <div style={{ marginBottom: '32px' }}>
                <SignalPreferencesManagement userId={user.id} />
              </div>
            )}

            {/* Tier 1 Watchlist Assets */}
            {profile.tier === 1 && (
              <div style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '28px',
                marginBottom: '32px'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: 'var(--text)' }}>
                  Watchlist Assets
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>
                  Manage up to 20 assets in your watchlist ({assets.length}/20 added). You have <strong>5 swaps per month</strong> to adjust your portfolio.
                </p>

                {assets.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    background: 'var(--bg)',
                    borderRadius: '8px',
                    border: '1px dashed var(--border)',
                    marginBottom: '20px'
                  }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                      No assets added yet. Start by adding your first one below.
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                    gap: '12px',
                    marginBottom: '20px'
                  }}>
                    {assets.map(ticker => (
                      <div
                        key={ticker}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          gap: '8px'
                        }}
                      >
                        <span style={{ fontWeight: '600', color: 'var(--text)', fontSize: '13px' }}>
                          {ticker}
                        </span>
                        <button
                          onClick={() => handleRemoveAsset(ticker)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ff6b6b',
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                          title="Remove asset"
                          onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.opacity = '0.7'}
                          onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {assets.length < 20 && (
                  <form onSubmit={handleAddAsset} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Enter ticker (e.g., AAPL)"
                      value={newAsset}
                      onChange={(e) => setNewAsset(e.target.value.toUpperCase())}
                      disabled={adding}
                      maxLength={5}
                      style={{
                        flex: 1,
                        minWidth: '140px',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--bg)',
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
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'var(--teal)',
                        color: 'var(--bg)',
                        fontWeight: '600',
                        fontSize: '14px',
                        cursor: adding || !newAsset ? 'not-allowed' : 'pointer',
                        opacity: adding || !newAsset ? 0.6 : 1,
                        transition: 'opacity 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {adding ? 'Adding...' : 'Add Asset'}
                    </button>
                  </form>
                )}
              </div>
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
            marginBottom: '20px',
            fontSize: '13px'
          }}>
            ✕ {error}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 640px) {
          div[style*="gridTemplateColumns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
