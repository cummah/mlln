'use client';

import { useEffect, useRef } from 'react';

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onError?: () => void;
}

export default function TurnstileWidget({ onToken, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.turnstile && containerRef.current) {
      window.turnstile.render(`#turnstile-widget`, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
        theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
        callback: onToken,
        'error-callback': onError,
        'expired-callback': () => {
          // Token expired
        },
      });
    }

    return () => {
      if (typeof window !== 'undefined' && window.turnstile && containerRef.current?.id === 'turnstile-widget') {
        window.turnstile.remove();
      }
    };
  }, [onToken, onError]);

  return (
    <div
      ref={containerRef}
      id="turnstile-widget"
      style={{
        display: 'flex',
        justifyContent: 'center',
        marginTop: '16px'
      }}
    />
  );
}

// Type extension for window.turnstile
declare global {
  interface Window {
    turnstile?: {
      render: (selector: string, options: any) => void;
      remove: () => void;
      getResponse: () => string | undefined;
      reset: () => void;
    };
  }
}
