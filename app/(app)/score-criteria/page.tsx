import { Metadata } from 'next'
import Link from 'next/link'
import { colors } from '@/lib/designSystem'
import { Reveal } from '@/components/home/Motion'
import { CtaBand, MarketingFooter, MarketingStyles, PageHero } from '@/components/marketing/MarketingKit'

export const metadata: Metadata = {
  title: 'Score Criteria | How the DCA Score Is Calculated',
  description:
    'How mlln\'s DCA suitability score from 1 to 100 is built: five criteria, what each rewards, and why it is a backward-looking measure rather than a forecast.',
}

export const dynamic = 'force-static'

interface Criterion {
  title: string
  points: number
  measures: string
  why: string
}

const CRITERIA: Criterion[] = [
  {
    title: 'Alpha consistency',
    points: 35,
    measures:
      'How much the Enhanced strategy beat plain DCA on this asset, averaged over the one, three and five year windows and ranked against every other asset. It also counts how many of the five windows (one month to five years) came out ahead.',
    why:
      'A single good year can be luck. Winning across several horizons is much harder to fake, so this carries the largest share of the score.',
  },
  {
    title: 'Absolute profitability',
    points: 25,
    measures:
      'Whether the Enhanced strategy actually made money on this asset over one, three and five years, with each result ranked against the rest of the universe. Longer horizons count for more.',
    why:
      'Beating plain DCA is not much use if both lose money. This keeps the score tied to real outcomes, not just relative ones.',
  },
  {
    title: 'Capital efficiency',
    points: 20,
    measures:
      'Whether the Enhanced strategy bought at a lower average price than plain DCA, and whether each dollar invested ended up worth more. Both are ranked against the universe.',
    why:
      'The point of sizing purchases by signal is to put more money to work when prices are low. These two checks test whether that is what happened.',
  },
  {
    title: 'Short-term defence',
    points: 10,
    measures: 'Whether the strategy was ahead of plain DCA over the last one month and the last three months.',
    why: 'A recent run of underperformance is a warning that conditions may have changed, even if the long history looks good.',
  },
  {
    title: 'Weekly and monthly agreement',
    points: 10,
    measures:
      'Whether the strategy beat plain DCA on both the weekly and the monthly schedule over the same period.',
    why:
      'If the result only works at one cadence, it is more likely to be an accident of timing than a feature of the asset.',
  },
]

// Score bands from the reading guide. Lowest band is flagged as weak.
const BANDS = [
  { range: '70 and above', label: 'Shown in green', color: colors.green },
  { range: '50 to 69', label: 'Shown in blue', color: '#3987e5' },
  { range: '30 to 49', label: 'Shown in yellow', color: colors.amber },
  { range: 'Below 30', label: 'Flagged as weak', color: colors.red },
]

const LIMITS = [
  'It is backward-looking. An asset that suited Enhanced DCA in the past may not in the future.',
  'It only measures how the strategy performed relative to plain DCA and in absolute terms. It says nothing about the quality of the business, valuation or risk beyond what shows up in those results.',
  'A high score on a falling asset still means a falling asset. Check the loss ceiling and the five-year return.',
  'The weights are judgement calls. Different, equally reasonable weights would produce a different ranking.',
]

const SEGMENT_OPACITY = [1, 0.83, 0.66, 0.5, 0.36]

export default function ScoreCriteriaPage() {
  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <MarketingStyles />

      <PageHero
        eyebrow="Score criteria"
        title="How the DCA score is built"
        lead={
          <>
            The DCA score runs from 1 to 100. For the thinking behind the signals themselves, see the{' '}
            <Link href="/methodology" className="lp-text-link">methodology</Link>.
          </>
        }
      />

      {/* What it means */}
      <section className="lp-section" style={{ paddingTop: '24px' }}>
        <div className="lp-wrap lp-two">
          <Reveal>
            <div className="lp-eyebrow">What the score means</div>
            <h2 className="lp-h2">A measure of past fit, not a forecast.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="lp-stack" style={{ gap: '16px' }}>
              <p className="lp-body" style={{ fontSize: '16px' }}>
                The score answers one question: how well has Enhanced DCA worked on this asset, compared with how it has
                worked on every other asset we track? A high score means the strategy has historically added value on
                this asset, across several time horizons, in both weekly and monthly form. A low score means it has not.
              </p>
              <p className="lp-body">
                It is a measure of past fit. It is not a prediction, a rating of the company, or a recommendation to buy.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Five criteria */}
      <section className="lp-section lp-section-band">
        <div className="lp-wrap">
          <Reveal>
            <div style={{ maxWidth: '620px', marginBottom: '36px' }}>
              <div className="lp-eyebrow">Five criteria, 100 points</div>
              <h2 className="lp-h2">Where the points come from</h2>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="lp-panel" style={{ marginBottom: '28px' }}>
              <div
                className="lp-bar"
                role="img"
                aria-label={`Point split: ${CRITERIA.map(c => `${c.title} ${c.points}`).join(', ')}`}
              >
                {CRITERIA.map((c, i) => (
                  <div
                    key={c.title}
                    style={{
                      width: `${c.points}%`,
                      background: colors.teal,
                      opacity: SEGMENT_OPACITY[i],
                      borderRight: i < CRITERIA.length - 1 ? `1px solid ${colors.bg}` : undefined,
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 22px', marginTop: '18px' }}>
                {CRITERIA.map((c, i) => (
                  <div key={c.title} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: colors.text2 }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: colors.teal, opacity: SEGMENT_OPACITY[i] }} />
                    {c.title} <span className="lp-num" style={{ fontSize: '12px' }}>{c.points}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="lp-grid3">
            {CRITERIA.map((c, i) => (
              <Reveal key={c.title} delay={i * 0.06}>
                <article className="lp-tile lp-card lp-stack" style={{ gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <span className="lp-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="lp-chip">up to {c.points} pts</span>
                  </div>
                  <h3 className="lp-h3">{c.title}</h3>
                  <div>
                    <div className="lp-eyebrow" style={{ fontSize: '10px', marginBottom: '6px' }}>What it measures</div>
                    <p className="lp-body" style={{ fontSize: '14px' }}>{c.measures}</p>
                  </div>
                  <div>
                    <div className="lp-eyebrow" style={{ fontSize: '10px', marginBottom: '6px' }}>Why it is included</div>
                    <p className="lp-body" style={{ fontSize: '14px' }}>{c.why}</p>
                  </div>
                </article>
              </Reveal>
            ))}
            <Reveal delay={0.3}>
              <div className="lp-tile lp-stack" style={{ gap: '14px', justifyContent: 'center', background: colors.surface2 }}>
                <span className="lp-num">Total</span>
                <div style={{ fontSize: '44px', fontWeight: 700, letterSpacing: '-0.03em', color: colors.teal, lineHeight: 1 }}>100</div>
                <p className="lp-body" style={{ fontSize: '14px' }}>
                  Points are added up first. The loss ceiling below is applied after.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Loss ceiling and reading a score */}
      <section className="lp-section">
        <div className="lp-wrap lp-two">
          <Reveal>
            <div className="lp-eyebrow">The loss ceiling</div>
            <h2 className="lp-h2">A cap for assets that lost money.</h2>
            <p className="lp-body" style={{ marginTop: '18px', fontSize: '14px' }}>
              Points are added up first, then a ceiling is applied. If the Enhanced strategy lost money over five
              years, the score cannot rise above a cap, and the bigger the loss, the lower the cap.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="lp-panel">
              <p className="lp-body" style={{ fontSize: '15px', color: colors.text }}>
                Without this, an asset where both strategies lost badly, but the Enhanced one lost slightly less, could
                still look attractive.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-section lp-section-band">
        <div className="lp-wrap lp-two">
          <Reveal>
            <div className="lp-eyebrow">Reading a score</div>
            <h2 className="lp-h2">What the number tells you.</h2>
            <p className="lp-body" style={{ marginTop: '18px', fontSize: '14px' }}>
              Most criteria are ranked against the whole universe, so the score is relative. It can move when other
              assets are added or when their results change, even if nothing changed for the asset you are looking at.
            </p>
            <p className="lp-body" style={{ marginTop: '12px', fontSize: '14px' }}>
              The score is recalculated each evening after the market close, using the latest backtest results. Assets
              without enough history do not get a score.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="lp-stack" style={{ gap: '10px' }}>
              {BANDS.map(b => (
                <div key={b.label} className="lp-tile" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: b.color }} />
                    <span className="lp-h3" style={{ fontSize: '15px' }}>{b.range}</span>
                  </div>
                  <span className="lp-small">{b.label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Limits */}
      <section className="lp-section">
        <div className="lp-wrap" style={{ maxWidth: '820px' }}>
          <Reveal>
            <div className="lp-eyebrow">Limits</div>
            <h2 className="lp-h2">What the score cannot do</h2>
          </Reveal>
          <Reveal delay={0.08}>
            <ol className="lp-panel" style={{ listStyle: 'none', margin: '28px 0 0', padding: '8px 26px', display: 'flex', flexDirection: 'column' }}>
              {LIMITS.map((l, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '18px',
                    padding: '18px 0',
                    borderTop: i === 0 ? 'none' : `1px solid ${colors.border}`,
                    fontSize: '14px',
                    lineHeight: 1.7,
                    color: colors.text2,
                  }}
                >
                  <span className="lp-num" style={{ paddingTop: '2px' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span>{l}</span>
                </li>
              ))}
            </ol>
            <p className="lp-small" style={{ marginTop: '18px' }}>Nothing on this site is investment advice.</p>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Check the score against the numbers"
        body="Scores are recalculated each evening after the market close, using the latest backtest results."
        actions={[
          { label: 'Browse the rankings', href: '/rank', primary: true },
          { label: 'Read the methodology', href: '/methodology' },
        ]}
      />

      <MarketingFooter />
    </div>
  )
}
