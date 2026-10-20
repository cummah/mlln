'use client';

import Link from 'next/link';

export function AnimatedLogo({
  href = '/',
  ariaLabel = 'mlln home'
}: {
  href?: string;
  ariaLabel?: string;
}) {
  return (
    <Link href={href} aria-label={ariaLabel} style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: '36px'
    }}>
      <img
        src="/logo-animation.svg"
        alt="mlln animated logo"
        style={{ height: '36px', width: 'auto' }}
      />
    </Link>
  );
}
