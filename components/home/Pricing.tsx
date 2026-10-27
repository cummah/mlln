'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { Reveal } from './Motion'
import SignupModal from './SignupModal'

interface Tier {
  id: string
  name: string
  tagline: string
  monthly: number // the launch price per month, already 50% off, billed once a year
  features: string[]
  cta: string
  highlight?: boolean
}

const LAUNCH_DISCOUNT = 0.5

const TIERS: Tier[] = [
  {
    id: 'watchlist',
    name: 'Essential',
    tagline: 'For investors who know what they own.',
    monthly: 12,
    features: [
      'Custom watchlist of up to 20 assets',
      'Weekly and monthly Enhanced DCA signals',
      'How much to buy this period, per asset',
      'Watchlist YTD vs standard DCA and SPY',
    ],
    cta: 'Start with Essential',
  },
  {
    id: 'full',
    name: 'Premium',
    tagline: 'For investors who want to find the best places to put money.',
    monthly: 29,
    features: [
      'All 2,000+ stocks and ETFs',
      'Weekly and monthly Enhanced DCA signals',
      'Sector views and the full ranking table',
      'Backtests and DCA scores for every asset',
      'Unlimited watchlists',
    ],
    cta: 'Get Premium',
    highlight: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Active Traders and Investors.',
    monthly: 49,
    features: [
      'Everything in Premium',
      'Institutional grade TradingView indicators and strategies',
      'Use them across any asset and timeframe',
    ],
    cta: 'Get Pro',
  },
]

const gbp = (n: number) => `£${n.toLocaleString('en-GB')}`

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="3" style={{ flexShrink: 0, marginTop: '3px' }}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function PriceCard({ tier, i }: { tier: Tier; i: number }) {
  const reduce = useReducedMotion()
  const fullMonthly = tier.monthly / (1 - LAUNCH_DISCOUNT)
  const yearly = tier.monthly * 12
  const fullYearly = fullMonthly * 12
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -6 }}
      style={{
        position: 'relative',
        background: tier.highlight ? 'var(--surface-elevated)' : 'var(--surface)',
        border: `1px solid ${tier.highlight ? 'var(--teal-mid)' : 'var(--border)'}`,
        borderRadius: '16px',
        padding: '28px 26px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        boxShadow: tier.highlight ? 'var(--shadow-glow-teal)' : 'none',
      }}
    >
      {tier.highlight && (
        <div style={{ position: 'absolute', top: '-11px', left: '26px', background: 'var(--teal)', color: 'var(--bg)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: '999px' }}>
          Most popular
        </div>
      )}
      <div>
        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>{tier.name}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '4px', minHeight: '38px', lineHeight: 1.45 }}>{tier.tagline}</div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '40px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text)' }}>{gbp(tier.monthly)}</span>
          <span style={{ fontSize: '14px', color: 'var(--text-2)' }}>/month</span>
          <span style={{ fontSize: '15px', color: 'var(--text-3)', textDecoration: 'line-through', marginLeft: 'auto' }}>{gbp(fullMonthly)}</span>
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: '6px' }}>
          Billed annually at <strong style={{ color: 'var(--text)' }}>{gbp(yearly)}</strong>{' '}
          <span style={{ color: 'var(--text-3)', textDecoration: 'line-through' }}>{gbp(fullYearly)}</span>
        </div>
        <div style={{ display: 'inline-block', marginTop: '10px', fontSize: '11px', fontWeight: 600, color: 'var(--green)', background: 'var(--green-dim)', padding: '3px 9px', borderRadius: '999px' }}>
          50% launch discount · save {gbp(fullYearly - yearly)}
        </div>
      </div>

      {/* Buttons removed - single "Get Started" button shown below all tiers */}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '11px' }}>
        {tier.features.map(f => (
          <li key={f} style={{ display: 'flex', gap: '10px', fontSize: '13.5px', lineHeight: 1.5, color: 'var(--text-2)' }}>
            <Check />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

export function Pricing() {
  const [signupOpen, setSignupOpen] = useState(false)

  return (
    <>
      <Reveal>
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 48px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: '12px' }}>Pricing</div>
          <h2 style={{ fontSize: '30px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>Launch pricing: 50% off every plan</h2>
          <p style={{ fontSize: '15px', color: 'var(--text-2)', margin: '14px 0 0', lineHeight: 1.6 }}>
            One simple monthly rate, paid once a year. The prices shown are what you pay at launch, and they rise to the full price after it.
          </p>
        </div>
      </Reveal>
      <div className="lp-grid3" style={{ alignItems: 'stretch' }}>
        {TIERS.map((t, i) => (
          <PriceCard key={t.id} tier={t} i={i} />
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '32px', marginBottom: '22px' }}>
        <button
          onClick={() => setSignupOpen(true)}
          className="lp-btn lp-btn-primary"
          style={{
            border: 'none',
            cursor: 'pointer',
            background: 'var(--teal)',
            color: 'var(--bg)',
            fontSize: '14px',
            fontWeight: '600',
            padding: '12px 32px',
            borderRadius: '8px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--teal-mid)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 200, 180, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--teal)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Start mlln. Stop fear and greed.
        </button>
      </div>

      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-3)', marginTop: '22px' }}>
        Prices in GBP. All plans are annual, with the monthly rate shown for comparison (excluding VAT)
      </div>

      <SignupModal isOpen={signupOpen} onClose={() => setSignupOpen(false)} />
    </>
  )
}
