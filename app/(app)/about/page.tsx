import { Metadata } from 'next'
import { colors } from '@/lib/designSystem'
import { Reveal } from '@/components/home/Motion'
import { CtaBand, MarketingFooter, MarketingStyles, PageHero } from '@/components/marketing/MarketingKit'

export const metadata: Metadata = {
  title: 'About | mlln.ai',
  description: 'About mlln.ai — Intelligent Dollar Cost Averaging with signal-driven buying.',
}

export const dynamic = 'force-static'

const WHAT_IS = [
  'mlln.ai is an intelligent Dollar Cost Averaging (DCA) platform that helps investors build wealth through systematic, signal-driven investment strategies. We combine market analysis with behavioral economics to identify optimal buying opportunities.',
]

const MISSION = [
  'We believe consistent, disciplined investing is more important than perfect timing. mlln.ai empowers everyday investors to make data-driven decisions without emotional bias, combining technical analysis, market signals, and proven DCA principles.',
]

const FEATURES = [
  { title: 'Signal-driven buying', desc: 'Identify optimal entry points using multi-factor analysis' },
  { title: 'Portfolio analytics', desc: 'Visualize performance, drawdowns, and diversification' },
  { title: 'Sector insights', desc: 'Monitor sector-level trends and relative performance' },
  { title: 'Weekly & monthly views', desc: 'Customize your analysis timeframe' },
]

const DISCLAIMER = [
  'mlln.ai is provided for educational and informational purposes only. Nothing on this site constitutes financial, investment, legal, or tax advice. Past performance does not guarantee future results. Always conduct your own research and consult with qualified financial advisors before making investment decisions.',
  'The information and analysis provided on mlln.ai are based on publicly available data and historical patterns. Markets are inherently unpredictable, and actual results may differ significantly from projections or historical performance.',
]

const CONTENT_LABEL = { fontSize: '13px', color: colors.text3, fontWeight: 500 } as const

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <MarketingStyles />

      <PageHero
        eyebrow="About"
        title="About mlln.ai"
        lead="Intelligent Dollar Cost Averaging with signal-driven buying"
      />

      {/* What it is and why it exists */}
      <section className="lp-section">
        <div className="lp-wrap lp-stack" style={{ gap: '72px' }}>
          <div className="lp-two">
            <Reveal>
              <div className="lp-eyebrow">What is mlln.ai?</div>
              <h2 className="lp-h2">A DCA platform that sizes each purchase.</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="lp-body" style={{ fontSize: '16px' }}>{WHAT_IS[0]}</p>
            </Reveal>
          </div>

          <div className="lp-two">
            <Reveal>
              <div className="lp-eyebrow">Our mission</div>
              <h2 className="lp-h2">Discipline beats perfect timing.</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="lp-body" style={{ fontSize: '16px' }}>{MISSION[0]}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Key features */}
      <section className="lp-section lp-section-band">
        <div className="lp-wrap">
          <Reveal>
            <div style={{ maxWidth: '620px', marginBottom: '40px' }}>
              <div className="lp-eyebrow">Key features</div>
              <h2 className="lp-h2">What you can do on mlln.ai</h2>
            </div>
          </Reveal>
          <div className="lp-grid2">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <div className="lp-tile lp-card">
                  <div className="lp-num" style={{ marginBottom: '14px' }}>{String(i + 1).padStart(2, '0')}</div>
                  <h3 className="lp-h3" style={{ marginBottom: '8px' }}>{f.title}</h3>
                  <p className="lp-body" style={{ fontSize: '14px' }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Company information and disclaimer */}
      <section className="lp-section">
        <div className="lp-wrap lp-two">
          <Reveal>
            <div className="lp-eyebrow">Company information</div>
            <h2 className="lp-h2">Who runs mlln.ai</h2>
            <p className="lp-body" style={{ marginTop: '18px', fontSize: '14px' }}>
              mlln.ai is operated under UK law and complies with UK data protection regulations including the UK GDPR.
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="lp-panel" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '14px 28px', fontSize: '14px', alignItems: 'baseline' }}>
              <span style={CONTENT_LABEL}>Company</span>
              <span style={{ color: colors.text }}>mlln.ai</span>
              <span style={CONTENT_LABEL}>Email</span>
              <a href="mailto:support@mlln.ai" style={{ color: colors.teal, textDecoration: 'none' }}>support@mlln.ai</a>
              <span style={CONTENT_LABEL}>Jurisdiction</span>
              <span style={{ color: colors.text }}>United Kingdom</span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-section lp-section-band" style={{ paddingTop: '64px', paddingBottom: '64px' }}>
        <div className="lp-wrap" style={{ maxWidth: '820px' }}>
          <Reveal>
            <div className="lp-eyebrow" style={{ color: colors.amber }}>Disclaimer</div>
            <div className="lp-stack" style={{ gap: '14px', borderLeft: `2px solid ${colors.amber}`, paddingLeft: '22px' }}>
              {DISCLAIMER.map((p, i) => (
                <p key={i} className="lp-body">{p}</p>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Ready to size your DCA?"
        body="Explore the data for free, then choose a plan when you are ready."
        actions={[
          { label: 'See pricing', href: '/pricing', primary: true },
          { label: 'Read the methodology', href: '/methodology' },
        ]}
      />

      <MarketingFooter />
    </div>
  )
}
