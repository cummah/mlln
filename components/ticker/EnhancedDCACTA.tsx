'use client'

import Link from 'next/link'
import type { UserTier } from '@/types'

interface EnhancedDCACtaProps {
  ticker: string
  name: string
  monthlyAlpha5y: number
  dca_suitability_score: number | null
  tier: UserTier
}

export function EnhancedDCACTA({ ticker, name, monthlyAlpha5y, dca_suitability_score, tier }: EnhancedDCACtaProps) {
  const score = dca_suitability_score ?? 0
  const isHighQuality = score >= 50
  const edcaWins = monthlyAlpha5y > 0


  const isFree = tier === 0
  const isBasic = tier === 1

  // High-quality asset where eDCA underperformed
  if (isHighQuality && !edcaWins) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, var(--surface-elevated) 0%, var(--surface) 100%)',
        border: '1px solid var(--border-elevated)',
        borderRadius: '14px',
        padding: '32px 28px',
        textAlign: 'center',
        boxShadow: 'var(--inset-top), var(--shadow-md)',
      }}>
        <div style={{ maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            margin: '0 0 12px',
            lineHeight: 1.2,
          }}>
            Even quality assets have seasons.
          </h2>

          <p style={{
            fontSize: '15px',
            color: 'var(--text-2)',
            margin: '0 0 24px',
            lineHeight: 1.6,
          }}>
            {ticker} scores high for DCA suitability, but Enhanced DCA lagged standard over the past 5 years. Markets are cyclical — volatility strategies don't always win.
          </p>

          <Link
            href={isFree ? '/signup' : isBasic ? '/pricing' : '/portfolio'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 22px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              textDecoration: 'none',
              background: 'var(--teal)',
              color: 'var(--bg)',
              transition: 'background 0.2s, box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--teal-strong)'
              e.currentTarget.style.boxShadow = 'var(--shadow-glow-teal)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--teal)'
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            {isFree ? 'Get Started' : isBasic ? 'Explore More Assets' : 'View Your Watchlist'}
          </Link>
        </div>
      </div>
    )
  }

  // High-quality asset where eDCA wins
  if (isHighQuality && edcaWins) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, var(--teal-dim) 0%, rgba(0,196,167,0.08) 100%)',
        border: '1px solid var(--teal-mid)',
        borderRadius: '14px',
        padding: '32px 28px',
        textAlign: 'center',
        boxShadow: 'var(--inset-top), var(--shadow-md)',
      }}>
        <div style={{ maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            margin: '0 0 12px',
            lineHeight: 1.2,
          }}>
            Profit from fear. Sidestep greed.
          </h2>

          <p style={{
            fontSize: '15px',
            color: 'var(--text-2)',
            margin: '0 0 24px',
            lineHeight: 1.6,
          }}>
            {isFree ? (
              <>Over 5 years, Enhanced DCA beat standard DCA on {name} ({ticker}). Sign up to get live signals for your portfolio and build your own watchlist.</>
            ) : isBasic ? (
              <>Over 5 years, Enhanced DCA beat standard DCA on {name} ({ticker}). Upgrade to Full Access to track all 2,000 assets and unlock deeper insights.</>
            ) : (
              <>Over 5 years, Enhanced DCA beat standard DCA on {name} ({ticker}). Start building your watchlist today.</>
            )}
          </p>

          <Link
            href={isFree ? '/signup' : isBasic ? '/pricing' : '/portfolio'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 22px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              textDecoration: 'none',
              background: 'var(--teal)',
              color: 'var(--bg)',
              transition: 'background 0.2s, box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--teal-strong)'
              e.currentTarget.style.boxShadow = 'var(--shadow-glow-teal)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--teal)'
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Start Enhancing your DCA
          </Link>
        </div>
      </div>
    )
  }

  // Low-quality asset
  if (!isHighQuality) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, var(--surface-elevated) 0%, var(--surface) 100%)',
        border: '1px solid var(--border-elevated)',
        borderRadius: '14px',
        padding: '32px 28px',
        textAlign: 'center',
        boxShadow: 'var(--inset-top), var(--shadow-md)',
      }}>
        <div style={{ maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            margin: '0 0 12px',
            lineHeight: 1.2,
          }}>
            {ticker} isn't ideal for dollar-cost averaging.
          </h2>

          <p style={{
            fontSize: '15px',
            color: 'var(--text-2)',
            margin: '0 0 24px',
            lineHeight: 1.6,
          }}>
            Our analysis shows this asset has lower DCA suitability. Browse assets scored 50+ where Enhanced DCA has historically outperformed.
          </p>

          <Link
            href="/rank"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 22px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              textDecoration: 'none',
              background: 'var(--teal)',
              color: 'var(--bg)',
              transition: 'background 0.2s, box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--teal-strong)'
              e.currentTarget.style.boxShadow = 'var(--shadow-glow-teal)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--teal)'
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            Explore better assets
          </Link>
        </div>
      </div>
    )
  }

  return null
}
