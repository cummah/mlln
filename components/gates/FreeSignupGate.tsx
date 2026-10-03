import React from 'react';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface FreeSignupGateProps {
  isVisible: boolean;
}

export function FreeSignupGate({ isVisible }: FreeSignupGateProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 rounded-[var(--radius-lg)] backdrop-blur-sm bg-white/8 dark:bg-black/25 flex flex-col items-center justify-center gap-3">
      <div className="w-7 h-7 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
        <Lock className="w-4 h-4 text-[var(--text-primary)]" />
      </div>
      <div className="text-sm font-medium text-[var(--text-primary)]">
        Free sign-up to unlock
      </div>
      <Link href="/auth/sign-up">
        <Button variant="primary" size="sm">
          Free sign-up
        </Button>
      </Link>
      <div className="text-xs text-[var(--text-tertiary)]">
        No card required
      </div>
    </div>
  );
}
