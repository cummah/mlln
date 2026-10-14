import Link from 'next/link'
import { Metadata } from 'next'
import { colors, spacing } from '@/lib/designSystem'
import { getHomeData } from '@/lib/home-data'
import { FREQ_CONFIG } from '@/lib/engine/config'
import { Reveal, CountUp } from '@/components/home/Motion'
import { HeroChart } from '@/components/home/HeroChart'
import { SignalBars } from '@/components/home/SignalBars'
import { EdcaCompare } from '@/components/home/EdcaCompare'
import { SectorHighlights } from '@/components/home/SectorHighlights'
import { Pricing } from '@/components/home/Pricing'

export const metadata: Metadata = {
  title: 'Enhanced DCA | Buy more when it is cheap, less when it is not | mlln.ai',
  description:
    'Keep your regular investing schedule. Enhanced DCA tells you how much to buy each week or month, for over 2,000 stocks and ETFs, by scaling every purchase to what the asset has just done.',
}

// Built once a day and refreshed by the nightly job (/api/revalidate), like the watchlist, rank and sector pages it
// reads from. If the data cannot be read this throws, so the last good page keeps being served.
export const revalidate = 86400
export const dynamic = 'force-static'

// The ceiling on any single purchase. Read from the engine so the page cannot drift from what the model does.
const MAX_MULTIPLIER = FREQ_CONFIG.monthly.maxTotalMultiplier

const STEPS = [
  {
    n: '01',
    title: 'Choose assets, amount & frequency',
    body: "Pick your amount and rhythm, weekly or monthly. When you invest never changes, so there's no market timing on your side.",
  },
  {
    n: '02',
    title: 'We monitor markets and your assets',
    body: 'On every scheduled date, the model checks five things: how stretched the recent move is · distance from long-run trend · how persistent the fall is · drawdown depth · how fearful the market is',
  },
  {
    n: '03',
    title: 'You get one number, per asset',
    body: `A multiplier on your normal amount: smaller, normal or larger, capped at ${MAX_MULTIPLIER}×. When there's no case to buy, it says skip. Often deploying less capital over fewer, high-conviction trades compared to standard DCA, while achieving a higher net profit.`,
  },
]

const FAQ = [
  {
    q: 'Is this market timing?',
    a: 'No. You invest on the same schedule as always. Only the size of each purchase changes, and it is capped, so no single date can dominate your plan.',
  },
  {
    q: 'Does it beat standard DCA?',
    a: 'Every asset page shows the backtest of Enhanced DCA against a standard DCA baseline over the same dates and the same contributions, wins and losses included. The numbers on this page are the same ones. Backtests are not a promise about the future, and the methodology page lists the limits.',
  },
  {
    q: 'Do you give financial advice?',
    a: 'No. mlln is a research tool. Signals describe how a rule-based model would size a contribution. They are not recommendations, and you decide what to buy.',
  },
  {
    q: 'How does billing work?',
    a: 'All plans are annual. You see a monthly rate so plans are easy to compare, and you pay for the year up front. The launch price is 50% off the full price, which would be £24, £58 and £98 a month.',
  },
  {
    q: 'Can I cancel?',
    a: 'Yes, any time, from your account. That stops the next renewal, and you keep access until the end of the year you have paid for.',
  },
]

const CSS = `
.lp-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
.lp-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.lp-hero { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
.lp-two { display: grid; grid-template-columns: 1fr 1.15fr; gap: 56px; align-items: center; }
.lp-nav-links { display: flex; gap: 24px; align-items: center; }
.lp-btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 22px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; transition: background 0.2s, box-shadow 0.2s, transform 0.2s; }
.lp-btn:hover { transform: translateY(-2px); }
.lp-btn-primary { background: var(--teal); color: var(--bg); }
.lp-btn-primary:hover { background: var(--teal-strong); box-shadow: var(--shadow-glow-teal); }
.lp-btn-ghost { color: var(--text); border: 1px solid var(--border-medium); }
.lp-btn-ghost:hover { background: var(--surface2); }
.lp-link { color: var(--text-2); text-decoration: none; font-size: 13px; font-weight: 500; transition: color 0.2s; }
.lp-link:hover { color: var(--text); }
.lp-card { transition: transform 0.25s, border-color 0.25s; }
.lp-card:hover { transform: translateY(-4px); border-color: var(--teal-mid) !important; }
.lp-header { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(14px); background: rgba(6,15,26,0.78); border-bottom: 1px solid var(--border); }
.lp-gradient-text { background: linear-gradient(100deg, #00c4a7, #5eead4 45%, #00c4a7); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: lp-shine 6s linear infinite; }
.lp-orb { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
.lp-orb-a { width: 460px; height: 460px; background: rgba(0,196,167,0.16); top: -120px; right: -80px; animation: lp-float 14s ease-in-out infinite; }
.lp-orb-b { width: 380px; height: 380px; background: rgba(57,135,229,0.12); bottom: -140px; left: -100px; animation: lp-float 18s ease-in-out infinite reverse; }
.lp-marquee { overflow: hidden; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); background: var(--surface); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
.lp-marquee-track { display: flex; gap: 40px; width: max-content; padding: 14px 0; animation: lp-scroll 38s linear infinite; }
.lp-marquee:hover .lp-marquee-track { animation-play-state: paused; }
.lp-pulse { transform-box: fill-box; transform-origin: center; animation: lp-ping 2s ease-out infinite; opacity: 0.6; }
@keyframes lp-shine { to { background-position: 200% center; } }
@keyframes lp-float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-30px, 24px); } }
@keyframes lp-scroll { to { transform: translateX(-50%); } }
@keyframes lp-ping { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(3.2); opacity: 0; } }
@media (max-width: 900px) {
  .lp-grid3 { grid-template-columns: 1fr; }
  .lp-hero, .lp-two, .lp-compare { grid-template-columns: 1fr !important; gap: 32px; }
  .lp-nav-links .lp-link { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .lp-gradient-text, .lp-orb, .lp-marquee-track, .lp-pulse { animation: none; }
}
`

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: colors.teal, marginBottom: spacing.lg }}>
      {children}
    </div>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: '30px', fontWeight: 600, letterSpacing: '-0.02em', color: colors.text, margin: 0, lineHeight: 1.2 }}>
      {children}
    </h2>
  )
}

const card = {
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border-elevated)',
  borderRadius: '16px',
  padding: '22px 24px',
  boxShadow: 'var(--shadow-md), var(--inset-top)',
} as const

export default async function HomePage() {
  const { watchlist, top, universe, sectors } = await getHomeData()

  // The strip of live signals under the hero. Duplicated so the scroll loops without a jump.
  const ticker = watchlist.rows.map(r => ({
    ticker: r.ticker,
    mult: r.monthly && r.monthly.inLatestPeriod ? r.monthly.mult : null,
  }))

  return (
    <div style={{ background: colors.bg, color: colors.text, fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif', overflowY: 'auto', height: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="lp-header">
        <div className="lp-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          <Link href="/" style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: colors.text, textDecoration: 'none' }}>
            ml<span style={{ color: colors.teal }}>ln</span>
          </Link>
          <nav className="lp-nav-links">
            <Link href="/methodology" className="lp-link">Methodology</Link>
            <Link href="/asset/monthly" className="lp-link">Signals</Link>
            <a href="#pricing" className="lp-link">Pricing</a>
            <Link href="/auth/sign-up" className="lp-btn lp-btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="lp-orb lp-orb-a" />
        <div className="lp-orb lp-orb-b" />
        <div className="lp-wrap" style={{ position: 'relative', paddingTop: '76px', paddingBottom: '84px' }}>
          <div className="lp-hero">
            <div>
              <Reveal>
                <div style={{ display: 'inline-block', fontSize: '12px', fontWeight: 600, color: colors.teal, background: colors.tealDim, border: '1px solid var(--teal-mid)', padding: '5px 12px', borderRadius: '999px', marginBottom: '22px' }}>
                  Launch offer: 50% off every plan
                </div>
              </Reveal>
              <Reveal delay={0.08}>
                <h1 style={{ fontSize: '54px', fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, margin: 0 }}>
                  Dollar Cost Averaging,
                  <br />
                  <span className="lp-gradient-text">Enhanced.</span>
                </h1>
              </Reveal>
              <Reveal delay={0.16}>
                <p style={{ fontSize: '20px', lineHeight: 1.5, color: colors.text2, margin: '22px 0 0', maxWidth: '520px' }}>
                  Buy more when others are fearful. Buy less when they&apos;re greedy.
                </p>
              </Reveal>
              <Reveal delay={0.24}>
                <div style={{ display: 'flex', gap: '12px', marginTop: '32px', flexWrap: 'wrap' }}>
                  <Link href="/portfolio" className="lp-btn lp-btn-primary">Compare my portfolio</Link>
                  <Link href="/asset/monthly" className="lp-btn lp-btn-ghost">Browse live signals</Link>
                </div>
              </Reveal>
              <Reveal delay={0.32}>
                <div style={{ display: 'flex', gap: '36px', marginTop: '38px', flexWrap: 'wrap' }}>
                  {[
                    { v: universe.stocks, label: 'stocks' },
                    { v: universe.etfs, label: 'ETFs' },
                    { v: sectors.length, label: 'sectors' },
                    { v: 2, label: 'signal speeds: weekly, monthly' },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                        <CountUp value={s.v} />
                      </div>
                      <div style={{ fontSize: '12px', color: colors.text3, maxWidth: '110px', lineHeight: 1.4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.2} y={36}>
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{watchlist.name}, year to date</div>
                  <div style={{ fontSize: '11px', color: colors.green, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors.green, display: 'inline-block' }} /> Live data
                  </div>
                </div>
                {watchlist.ytd ? <HeroChart ytd={watchlist.ytd} /> : <SignalBars data={watchlist} />}
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '11px', color: colors.text3, lineHeight: 1.5 }}>
                  The ten largest companies on 1 January 2026, invested in monthly. Price returns, before fees. Past results do not predict the future.
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Live signal strip */}
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {[...ticker, ...ticker].map((t, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '13px', whiteSpace: 'nowrap' }}>
              <strong style={{ color: colors.text }}>{t.ticker}</strong>
              <span style={{ fontFamily: 'DM Mono, monospace', color: t.mult === null ? colors.text3 : t.mult > 1 ? colors.teal : colors.amber }}>
                {t.mult === null ? 'Skip' : `${t.mult.toFixed(2)}×`}
              </span>
              <span style={{ color: colors.text3 }}>this month</span>
            </span>
          ))}
        </div>
      </div>

      {/* Problem */}
      <section className="lp-wrap" style={{ paddingTop: '84px', paddingBottom: '84px', maxWidth: '820px', textAlign: 'center' }}>
        <Reveal>
          <Eyebrow>The problem with plain DCA</Eyebrow>
          <H2>Standard DCA treats a crash and a rally the same. They are not.</H2>
          <p style={{ fontSize: '16px', lineHeight: 1.7, color: colors.text2, margin: '20px 0 0' }}>
            Investing a fixed amount on a fixed schedule is simple, and that's why people stick with it. But it buys the same dollar amount whether an asset has just fallen 20% or has been climbing for months. You can't fix that by waiting for the perfect moment, because nobody calls bottoms reliably.
            Enhanced DCA keeps your schedule and changes only the size of each buy, using simple rules: more after sell-offs, less after run-ups, and a skip when there's no case to buy.
          </p>
        </Reveal>
      </section>

      {/* How it works */}
      <section style={{ background: colors.surface, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="lp-wrap" style={{ paddingTop: '84px', paddingBottom: '84px' }}>
          <Reveal>
            <div style={{ maxWidth: '620px', marginBottom: '40px' }}>
              <Eyebrow>How it works</Eyebrow>
              <H2>Three steps, one number per asset.</H2>
            </div>
          </Reveal>
          <div className="lp-grid3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.12}>
                <div className="lp-card" style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: '14px', padding: '26px', height: '100%', boxSizing: 'border-box' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '13px', color: colors.teal, marginBottom: '14px' }}>{s.n}</div>
                  <div style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px' }}>{s.title}</div>
                  <p style={{ fontSize: '14px', lineHeight: 1.65, color: colors.text2, margin: 0 }}>{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2}>
            <div style={{ marginTop: '28px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
              <Link href="/portfolio" className="lp-btn lp-btn-primary">Compare 2,000 assets : Standard vs Enhanced DCA</Link>
              <Link href="/assets" style={{ color: colors.teal, textDecoration: 'none', fontWeight: 500, fontSize: '14px' }}>
                Read the methodology and the research behind it →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* This month's signals on the watchlist */}
      <section className="lp-wrap" style={{ paddingTop: '84px', paddingBottom: '84px' }}>
        <div className="lp-two">
          <Reveal>
            <Eyebrow>Your number, every period</Eyebrow>
            <H2>This month, the model buys these at these sizes.</H2>
            <p style={{ fontSize: '15px', lineHeight: 1.7, color: colors.text2, margin: '18px 0 0' }}>
              Each bar is how much of your normal contribution the model would put into that asset this month. Past the
              line you are buying more than usual, short of it less, and where there is no case to buy the signal says skip.
              Build your own list of up to twenty assets and get this view for the things you actually hold.
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <div style={card}>
              <SignalBars data={watchlist} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Standard vs Enhanced on the top assets */}
      <section style={{ background: colors.surface, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="lp-wrap" style={{ paddingTop: '84px', paddingBottom: '84px' }}>
          <Reveal>
            <div style={{ maxWidth: '660px', marginBottom: '40px' }}>
              <Eyebrow>The proof is on every asset page</Eyebrow>
              <H2>Standard DCA against Enhanced DCA, side by side.</H2>
              <p style={{ fontSize: '15px', lineHeight: 1.7, color: colors.text2, margin: '16px 0 0' }}>
                Same dates, same contributions, only the sizing differs. The panel on the right is every asset we cover,
                not just the best ones, so you can see the honest average.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <EdcaCompare top={top} universe={universe} />
          </Reveal>
        </div>
      </section>

      {/* Sector highlights */}
      <section className="lp-wrap" style={{ paddingTop: '84px', paddingBottom: '84px' }}>
        <Reveal>
          <div style={{ maxWidth: '660px', marginBottom: '36px' }}>
            <Eyebrow>Where the signals are today</Eyebrow>
            <H2>Sectors with the most assets signalling a large buy.</H2>
            <p style={{ fontSize: '15px', lineHeight: 1.7, color: colors.text2, margin: '16px 0 0' }}>
              The ring shows how many assets in each sector have a weekly multiplier of 4× or more today. Full Access
              opens every sector and every asset inside it.
            </p>
          </div>
        </Reveal>
        <SectorHighlights sectors={sectors} />
        <Reveal delay={0.1}>
          <div style={{ marginTop: '22px', fontSize: '14px' }}>
            <Link href="/sectors" style={{ color: colors.teal, textDecoration: 'none', fontWeight: 500 }}>Explore all sectors →</Link>
          </div>
        </Reveal>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ background: colors.surface, borderTop: '1px solid var(--border)' }}>
        <div className="lp-wrap" style={{ paddingTop: '84px', paddingBottom: '84px' }}>
          <Pricing />
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-wrap" style={{ paddingTop: '72px', paddingBottom: '72px', maxWidth: '760px' }}>
        <Reveal>
          <div style={{ marginBottom: '28px' }}>
            <Eyebrow>Questions</Eyebrow>
            <H2>Before you subscribe</H2>
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

      {/* Closing CTA */}
      <section style={{ position: 'relative', overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
        <div className="lp-orb lp-orb-a" style={{ top: '-200px' }} />
        <div className="lp-wrap" style={{ position: 'relative', paddingTop: '84px', paddingBottom: '84px', textAlign: 'center' }}>
          <Reveal>
            <h2 style={{ fontSize: '38px', fontWeight: 700, letterSpacing: '-0.03em', margin: 0, lineHeight: 1.15 }}>Same schedule. Better-sized buys.</h2>
            <p style={{ fontSize: '16px', color: colors.text2, margin: '14px 0 28px' }}>Get 50% off while launch pricing lasts.</p>
            <a href="#pricing" className="lp-btn lp-btn-primary">Choose your plan</a>
          </Reveal>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)' }}>
        <div className="lp-wrap" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', padding: '28px 24px', fontSize: '12px', color: colors.text3 }}>
          <span>© {new Date().getFullYear()} mlln.ai. Not financial advice. Past performance does not predict future results.</span>
          <span style={{ display: 'flex', gap: '20px' }}>
            <Link href="/methodology" className="lp-link" style={{ fontSize: '12px' }}>Methodology</Link>
            <Link href="/score-criteria" className="lp-link" style={{ fontSize: '12px' }}>Score criteria</Link>
            <Link href="/privacy" className="lp-link" style={{ fontSize: '12px' }}>Privacy</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
