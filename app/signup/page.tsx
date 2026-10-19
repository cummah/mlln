'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';
import SignupForm from '@/components/auth/SignupForm';
import TierSelector from '@/components/auth/TierSelector';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [selectedTierFromUrl, setSelectedTierFromUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push('/account');
        return;
      }

      // Extract tier from URL params (from pricing page)
      const params = new URLSearchParams(window.location.search);
      const plan = params.get('plan');
      if (plan && ['watchlist', 'full', 'pro'].includes(plan)) {
        setSelectedTierFromUrl(plan as any);
      }

      setLoading(false);
    };

    checkAuth();
  }, [router, supabase]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        color: 'var(--text-2)'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: '60px 20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '60px'
        }}>
          <h1 style={{
            fontSize: '42px',
            fontWeight: '800',
            marginBottom: '16px',
            color: 'var(--text)',
            letterSpacing: '-0.02em'
          }}>
            Choose your plan
          </h1>
          <p style={{
            color: 'var(--text-2)',
            fontSize: '16px',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: '1.6'
          }}>
            Start free with portfolio tracking, or upgrade to unlock full DCA signal analysis across thousands of assets.
          </p>
        </div>

        {/* Free tier option */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '24px'
        }}>
          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--text)',
              margin: '0 0 8px 0'
            }}>
              Free
            </h3>
            <p style={{
              fontSize: '14px',
              color: 'var(--text-2)',
              margin: '0'
            }}>
              Save & track your portfolio
            </p>
          </div>
          <SignupForm showLabel={false} />
        </div>

        {/* Divider */}
        <div style={{
          textAlign: 'center',
          marginBottom: '48px',
          color: 'var(--text-2)',
          fontSize: '14px'
        }}>
          ─ or upgrade for advanced features ─
        </div>

        {/* Paid tiers */}
        <TierSelector initialTier={selectedTierFromUrl} />
      </div>
    </div>
  );
}
