'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const LINKS: { href: string; label: string }[] = [
  { href: '/asset/daily', label: 'Daily signals' },
  { href: '/asset/weekly', label: 'Weekly signals' },
  { href: '/asset/monthly', label: 'Monthly signals' },
  { href: '/sectors', label: 'Sectors' },
  { href: '/rank', label: 'Rank' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/score-criteria', label: 'Score criteria' },
  { href: '#pricing', label: 'Pricing' },
  { href: '/privacy', label: 'Privacy' },
]

/** Hamburger and dropdown for the landing page header. Hidden on wide screens, where the inline links show. */
export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [open])

  return (
    <div ref={ref} className="lp-menu">
      <button type="button" className="lp-menu-btn" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></> : <><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>}
        </svg>
      </button>
      {open && (
        <nav className="lp-menu-panel" aria-label="Site">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} className="lp-menu-item" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
        </nav>
      )}
    </div>
  )
}
