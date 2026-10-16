import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';

interface TierUpgradeResult {
  upgraded: boolean;
  newTier: number | null;
  error: string | null;
}

export function usePendingTierUpgrade(): TierUpgradeResult {
  const [result, setResult] = useState<TierUpgradeResult>({
    upgraded: false,
    newTier: null,
    error: null,
  });

  useEffect(() => {
    const checkAndApplyPendingTier = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return;

        // Get profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('tier, pending_tier')
          .eq('user_id', user.id)
          .single();

        if (profileError || !profile) return;

        // If pending_tier is set and current tier is 0, upgrade
        if (profile.pending_tier && profile.tier === 0) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              tier: profile.pending_tier,
              pending_tier: null,
            })
            .eq('user_id', user.id);

          if (updateError) {
            setResult({
              upgraded: false,
              newTier: null,
              error: 'Failed to apply upgrade',
            });
            return;
          }

          setResult({
            upgraded: true,
            newTier: profile.pending_tier,
            error: null,
          });
        }
      } catch (err) {
        console.error('[usePendingTierUpgrade] Error:', err);
        setResult({
          upgraded: false,
          newTier: null,
          error: 'An error occurred',
        });
      }
    };

    checkAndApplyPendingTier();
  }, []);

  return result;
}
