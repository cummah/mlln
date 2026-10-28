import { useState, useCallback } from 'react';
import type { UpgradePromptProps } from '@/components/upgrade/UpgradePrompt';

export interface UpgradePromptState {
  isOpen: boolean;
  props?: Omit<UpgradePromptProps, 'onClose'>;
}

export function useUpgradePrompt() {
  const [state, setState] = useState<UpgradePromptState>({ isOpen: false });

  const show = useCallback((props: Omit<UpgradePromptProps, 'onClose'>) => {
    setState({ isOpen: true, props });
  }, []);

  const close = useCallback(() => {
    setState({ isOpen: false });
  }, []);

  const showTierLocked = useCallback(
    (currentTier: number, requiredTier: number, feature: string) => {
      show({
        currentTier,
        requiredTier,
        feature,
        reason: 'tier_locked',
      });
    },
    [show]
  );

  const showQuotaExceeded = useCallback(
    (currentTier: number, feature: string, reason: string) => {
      show({
        currentTier,
        requiredTier: currentTier + 1,
        feature,
        reason: 'quota_exceeded',
      });
    },
    [show]
  );

  return {
    isOpen: state.isOpen,
    props: state.props,
    show,
    close,
    showTierLocked,
    showQuotaExceeded,
  };
}

/**
 * Parse error response and show appropriate upgrade prompt
 */
export function useUpgradeFromError() {
  const prompt = useUpgradePrompt();

  const handleError = useCallback(
    (error: any, currentTier: number) => {
      const message = error?.message || error?.error || '';

      if (message.includes('paid subscription')) {
        // Tier 0 trying to access tier 1+ feature
        prompt.showTierLocked(currentTier, 1, 'Custom ' + message.split(' ')[2]?.toLowerCase());
      } else if (message.includes('limit reached')) {
        // Quota exceeded
        const feature = message.split(' ')[0];
        prompt.showQuotaExceeded(currentTier, feature, message);
      }
    },
    [prompt]
  );

  return { ...prompt, handleError };
}
