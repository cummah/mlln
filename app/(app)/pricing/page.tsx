import { Metadata } from 'next'
import Link from 'next/link'
import { colors } from '@/lib/designSystem'
import { Pricing } from '@/components/home/Pricing'
import { Reveal } from '@/components/home/Motion'

export const metadata: Metadata = {
  title: 'Pricing | mlln.ai',
  description: 'Choose your plan. All plans include access to Enhanced DCA signals for stocks and ETFs.',
}

const CSS = `
.lp-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
.lp-btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; transition: background 0.2s, box-shadow 0.2s, transform 0.2s; }
.lp-btn:hover { transform: translateY(-2px); }
.lp-btn-primary { background: var(--teal); color: var(--bg); }
.lp-btn-primary:hover { background: var(--teal-strong); box-shadow: var(--shadow-glow-teal); }
.lp-btn-ghost { color: var(--text); border: 1px solid var(--border-medium); }
.lp-btn-ghost:hover { background: var(--surface2); }
.lp-link { color: var(--text-2); text-decoration: none; font-size: 13px; font-weight: 500; transition: color 0.2s; }
.lp-link:hover { color: var(--text); }
.lp-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.lp-card { transition: transform 0.25s, border-color 0.25s; }
.lp-card:hover { transform: translateY(-4px); border-color: var(--teal-mid) !important; }
.lp-orb { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
.lp-orb-a { width: 460px; height: 460px; background: rgba(0,196,167,0.16); top: -120px; right: -80px; animation: lp-float 14s ease-in-out infinite; }
.lp-orb-b { width: 380px; height: 380px; background: rgba(57,135,229,0.12); bottom: -140px; left: -100px; animation: lp-float 18s ease-in-out infinite reverse; }
@keyframes lp-float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-30px, 24px); } }
@media (max-width: 900px) {
  .lp-grid3 { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-orb { animation: none; }
}
`

const FAQ = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your account page at any time. This stops the next renewal, and you keep access until the end of the year you have paid for.',
  },
  {
    q: 'How do I upgrade or downgrade?',
    a: 'You can change your plan from your account settings. The changes apply to your next renewal.',
  },
  {
    q: 'Do you offer refunds?',
    a: 'Since plans are annual with the launch discount, we do not offer refunds. If you cancel, you keep access through the end of the year you paid for.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards. You can also pay via Revolut.',
  },
  {
    q: 'Is VAT included in the price?',
    a: 'No. The prices shown are excluding VAT. VAT will be added at checkout based on your location.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'Your watchlists and portfolios are archived. If you resubscribe within 2 years, you can restore them from your account settings.',
  },
]

export default function PricingPage() {
  return (
    <div style={{ background: colors.bg, color: colors.text, fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif', minHeight: '100vh', overflowY: 'auto' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="lp-orb lp-orb-a" />
        <div className="lp-orb lp-orb-b" />
        <div className="lp-wrap" style={{ position: 'relative', paddingTop: '76px', paddingBottom: '84px', textAlign: 'center' }}>
          <Reveal>
            <h1 style={{ fontSize: '54px', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, margin: 0, maxWidth: '800px', marginLeft: 'auto', marginRight: 'auto' }}>
              Clear pricing for every investor
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p style={{ fontSize: '20px', lineHeight: 1.5, color: colors.text2, margin: '22px auto 0', maxWidth: '580px' }}>
              Choose the plan that works for you. All plans include access to Enhanced DCA signals.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ background: colors.surface, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="lp-wrap" style={{ paddingTop: '84px', paddingBottom: '84px' }}>
          <Pricing />
        </div>
      </section>

      {/* What's included */}
      <section className="lp-wrap" style={{ paddingTop: '84px', paddingBottom: '84px' }}>
        <Reveal>
          <div style={{ maxWidth: '760px', marginBottom: '48px', textAlign: 'center', marginLeft: 'auto', marginRight: 'auto' }}>
            <h2 style={{ fontSize: '30px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>Free features for everyone</h2>
            <p style={{ fontSize: '15px', color: colors.text2, margin: '14px 0 0', lineHeight: 1.6 }}>
              Explore the full data set and understand how Enhanced DCA works, before you subscribe.
            </p>
          </div>
        </Reveal>

        <div className="lp-grid3" style={{ maxWidth: '1000px', marginLeft: 'auto', marginRight: 'auto' }}>
          {[
            {
              title: 'Browse all assets',
              desc: 'View Enhanced DCA signals for all 2,000+ stocks and ETFs, with weekly and monthly sizing.',
            },
            {
              title: 'See the rankings',
              desc: 'Sort by performance, beat rate, and stability. Find the best opportunities this month.',
            },
            {
              title: 'Read the backtests',
              desc: 'Every asset page shows Enhanced DCA vs standard DCA. Same contributions, different sizing.',
            },
            {
              title: 'Explore sectors',
              desc: 'See which sectors have the most high-conviction buy signals today.',
            },
            {
              title: 'Save your research',
              desc: 'One watchlist of up to 20 assets to track side-by-side, completely free.',
            },
            {
              title: 'Learn the methodology',
              desc: 'Read how the model works, the limits, and how we test what we build.',
            },
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 0.08}>
              <div
                className="lp-card"
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '14px',
                  padding: '26px',
                  height: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{item.title}</div>
                <p style={{ fontSize: '14px', lineHeight: 1.65, color: colors.text2, margin: 0 }}>{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Feature comparison table */}
      <section style={{ background: colors.surface, borderTop: '1px solid var(--border)' }}>
        <div className="lp-wrap" style={{ paddingTop: '84px', paddingBottom: '84px' }}>
          <Reveal>
            <h2 style={{ fontSize: '30px', fontWeight: 600, letterSpacing: '-0.02em', margin: '0 0 48px', lineHeight: 1.2, textAlign: 'center' }}>Feature comparison</h2>
          </Reveal>

          <div style={{ overflowX: 'auto', marginBottom: '32px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '16px 0', fontWeight: 600, color: colors.text }}>Feature</th>
                  <th style={{ textAlign: 'center', padding: '16px 12px', fontWeight: 600, color: colors.text }}>Free</th>
                  <th style={{ textAlign: 'center', padding: '16px 12px', fontWeight: 600, color: colors.text }}>Essential</th>
                  <th style={{ textAlign: 'center', padding: '16px 12px', fontWeight: 600, color: colors.text }}>Premium</th>
                  <th style={{ textAlign: 'center', padding: '16px 12px', fontWeight: 600, color: colors.text }}>Pro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Browse all assets', free: true, essential: true, premium: true, pro: true },
                  { feature: 'Ranking table', free: true, essential: false, premium: true, pro: true },
                  { feature: 'Sector views', free: true, essential: false, premium: true, pro: true },
                  { feature: 'Weekly & monthly signals', free: true, essential: true, premium: true, pro: true },
                  { feature: 'Custom watchlist (up to 20)', free: true, essential: true, premium: true, pro: true },
                  { feature: 'Unlimited watchlists', free: false, essential: false, premium: true, pro: true },
                  { feature: 'Backtests & DCA scores', free: false, essential: false, premium: true, pro: true },
                  { feature: 'TradingView indicators', free: false, essential: false, premium: false, pro: true },
                  { feature: 'Asset swap (per month)', free: 0, essential: 5, premium: 100, pro: '∞' },
                  { feature: 'Portfolios', free: 0, essential: 1, premium: 3, pro: '∞' },
                ].map((row, i) => (
                  <tr key={row.feature} style={{ borderBottom: '1px solid var(--border)', color: colors.text2 }}>
                    <td style={{ padding: '14px 0', fontWeight: 500, color: colors.text }}>{row.feature}</td>
                    <td style={{ textAlign: 'center', padding: '14px 12px' }}>
                      {typeof row.free === 'boolean' ? (row.free ? '✓' : '–') : row.free}
                    </td>
                    <td style={{ textAlign: 'center', padding: '14px 12px' }}>
                      {typeof row.essential === 'boolean' ? (row.essential ? '✓' : '–') : row.essential}
                    </td>
                    <td style={{ textAlign: 'center', padding: '14px 12px' }}>
                      {typeof row.premium === 'boolean' ? (row.premium ? '✓' : '–') : row.premium}
                    </td>
                    <td style={{ textAlign: 'center', padding: '14px 12px' }}>
                      {typeof row.pro === 'boolean' ? (row.pro ? '✓' : '–') : row.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ textAlign: 'center', fontSize: '12px', color: colors.text3, marginTop: '16px' }}>
            All plans billed annually. Monthly rates shown for comparison. Prices exclude VAT.
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-wrap" style={{ paddingTop: '84px', paddingBottom: '84px', maxWidth: '760px' }}>
        <Reveal>
          <div style={{ marginBottom: '42px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '30px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>Pricing questions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {FAQ.map(f => (
              <details key={f.q} style={{ borderTop: '1px solid var(--border)', padding: '18px 0' }}>
                <summary style={{ cursor: 'pointer', fontSize: '15px', fontWeight: 500, color: colors.text, listStyle: 'none' }}>{f.q}</summary>
                <p style={{ fontSize: '14px', lineHeight: 1.7, color: colors.text2, margin: '10px 0 0' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section style={{ borderTop: '1px solid var(--border)' }}>
        <div className="lp-wrap" style={{ paddingTop: '84px', paddingBottom: '84px', textAlign: 'center' }}>
          <Reveal>
            <h2 style={{ fontSize: '38px', fontWeight: 700, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.15 }}>Ready to master your DCA?</h2>
            <p style={{ fontSize: '16px', color: colors.text2, margin: '14px 0 28px' }}>Start with a free account and explore all the data. Upgrade anytime.</p>
            <Link href="/signup" className="lp-btn lp-btn-primary">Get started free</Link>
          </Reveal>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div className="lp-wrap" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', padding: '28px 24px', fontSize: '12px', color: colors.text3 }}>
          <span>© {new Date().getFullYear()} mlln.ai. Not financial advice.</span>
          <span style={{ display: 'flex', gap: '20px' }}>
            <Link href="/methodology" className="lp-link" style={{ fontSize: '12px' }}>Methodology</Link>
            <Link href="/privacy" className="lp-link" style={{ fontSize: '12px' }}>Privacy</Link>
            <Link href="/" className="lp-link" style={{ fontSize: '12px' }}>Back to home</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
