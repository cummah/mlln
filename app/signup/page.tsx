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
  const [selectedTierFromUrl, setSelectedTierFromUrl] = useState<number | null>(null);

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
      if (plan && ['1', '2', '3'].includes(plan)) {
        setSelectedTierFromUrl(parseInt(plan));
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '500px'
      }}>
        <div style={{
          marginBottom: '32px',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '800',
            marginBottom: '8px',
            color: 'var(--text)'
          }}>
            Join mlln
          </h1>
          <p style={{
            color: 'var(--text-2)',
            fontSize: '14px'
          }}>
            Create an account to get started with DCA signals
          </p>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '32px'
        }}>
          <SignupForm showLabel />

          <div style={{
            textAlign: 'center',
            color: 'var(--text-2)',
            fontSize: '12px'
          }}>
            or upgrade to a paid plan
          </div>

          <TierSelector initialTier={selectedTierFromUrl} />
        </div>
      </div>
    </div>
  );
}
