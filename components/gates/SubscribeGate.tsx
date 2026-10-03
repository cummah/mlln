import React from 'react';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface SubscribeGateProps {
  isVisible: boolean;
}

export function SubscribeGate({ isVisible }: SubscribeGateProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 rounded-[var(--radius-lg)] backdrop-blur-lg bg-gray-500/6 flex flex-col items-center justify-center gap-4">
      <div className="w-7 h-7 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
        <Lock className="w-4 h-4 text-[var(--text-primary)]" />
      </div>
      <div className="text-center max-w-xs">
        <div className="text-sm font-medium text-[var(--text-primary)] mb-1">
          Subscribe to unlock live signals
        </div>
        <div className="text-xs text-[var(--text-secondary)]">
          Know exactly how much to buy each week
        </div>
      </div>
      <div className="flex flex-col gap-2 w-full px-6">
        <Link href="/auth/sign-up?plan=pro">
          <Button variant="primary" size="sm" className="w-full">
            Start free trial
          </Button>
        </Link>
        <Link href="/pricing">
          <Button variant="ghost" size="sm" className="w-full">
            View plans
          </Button>
        </Link>
      </div>
      <div className="text-xs text-[var(--text-tertiary)]">
        From $29/mo · cancel anytime
      </div>
    </div>
  );
}
