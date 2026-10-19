import { Metadata } from 'next'
import Link from 'next/link'
import { colors, spacing, typography } from '@/lib/designSystem'

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: typography.fontSize['5xl'], fontWeight: 500, color: colors.text, margin: 0 }}>
      {children}
    </h2>
  )
}

function Para({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '14px', lineHeight: 1.7, color: colors.text2, margin: 0 }}>{children}</p>
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: typography.fontSize.sm,
        fontWeight: 700,
        letterSpacing: typography.tracking.widest,
        textTransform: 'uppercase',
        color: colors.teal,
        marginBottom: spacing.sm,
      }}
    >
      {children}
    </div>
  )
}

const linkStyle = { color: colors.teal, textDecoration: 'none' } as const

export default function ScoreCriteriaPage() {
  return (
    <div style={{ minHeight: '100vh', background: colors.bg }}>
      <div
        style={{
          maxWidth: '820px',
          marginLeft: 'auto',
          marginRight: 'auto',
          padding: `${spacing['5xl']} ${spacing['4xl']}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '36px',
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
          <h1 style={{ fontSize: '32px', fontWeight: 500, color: colors.text, margin: 0 }}>Score Criteria</h1>
          <p style={{ fontSize: '15px', lineHeight: 1.7, color: colors.text2, margin: 0 }}>
            How the DCA score from 1 to 100 is calculated. For the thinking behind the signals themselves, see the{' '}
            <Link href="/methodology" style={linkStyle}>
              methodology
            </Link>
            .
          </p>
        </header>

        <section style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
          <SectionTitle>What the score means</SectionTitle>
          <Para>
            The score answers one question: how well has Enhanced DCA worked on this asset, compared with how it has
            worked on every other asset we track? A high score means the strategy has historically added value on
            this asset, across several time horizons, in both weekly and monthly form. A low score means it has not.
          </Para>
          <Para>
            It is a measure of past fit. It is not a prediction, a rating of the company, or a recommendation to buy.
          </Para>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
          <SectionTitle>Five criteria, 100 points</SectionTitle>
          <div
            style={{
              display: 'flex',
              height: '12px',
              borderRadius: '6px',
              overflow: 'hidden',
              border: `1px solid ${colors.border}`,
            }}
            role="img"
            aria-label={`Point split: ${CRITERIA.map(c => `${c.title} ${c.points}`).join(', ')}`}
          >
            {CRITERIA.map((c, i) => (
              <div
                key={c.title}
                style={{
                  width: `${c.points}%`,
                  background: colors.teal,
                  opacity: 1 - i * 0.17,
                  borderRight: i < CRITERIA.length - 1 ? `1px solid ${colors.bg}` : undefined,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['4xl'] }}>
            {CRITERIA.map((c, i) => (
              <div
                key={c.title}
                style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing['2xl'],
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing['2xl'] }}>
                  <h3 style={{ fontSize: typography.fontSize['4xl'], fontWeight: 500, color: colors.text, margin: 0 }}>
                    {i + 1}. {c.title}
                  </h3>
                  <span style={{ fontSize: typography.fontSize['4xl'], color: colors.teal, whiteSpace: 'nowrap' }}>
                    up to {c.points} pts
                  </span>
                </div>
                <div>
                  <Label>What it measures</Label>
                  <Para>{c.measures}</Para>
                </div>
                <div>
                  <Label>Why it is included</Label>
                  <Para>{c.why}</Para>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
          <SectionTitle>The loss ceiling</SectionTitle>
          <Para>
            Points are added up first, then a ceiling is applied. If the Enhanced strategy lost money over five
            years, the score cannot rise above a cap, and the bigger the loss, the lower the cap. Without this, an
            asset where both strategies lost badly, but the Enhanced one lost slightly less, could still look
            attractive.
          </Para>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
          <SectionTitle>Reading a score</SectionTitle>
          <Para>
            Most criteria are ranked against the whole universe, so the score is relative. It can move when other
            assets are added or when their results change, even if nothing changed for the asset you are looking at.
            As a rough guide, scores of 70 and above are shown in green, 50 and above in blue, 30 and above in
            yellow, and anything lower is flagged as weak.
          </Para>
          <Para>
            The score is recalculated each evening after the market close, using the latest backtest results. Assets
            without enough history do not get a score.
          </Para>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: spacing['2xl'] }}>
          <SectionTitle>Limits</SectionTitle>
          <ul
            style={{
              margin: 0,
              paddingLeft: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.lg,
              fontSize: '14px',
              lineHeight: 1.7,
              color: colors.text2,
            }}
          >
            <li>It is backward-looking. An asset that suited Enhanced DCA in the past may not in the future.</li>
            <li>
              It only measures how the strategy performed relative to plain DCA and in absolute terms. It says nothing
              about the quality of the business, valuation or risk beyond what shows up in those results.
            </li>
            <li>A high score on a falling asset still means a falling asset. Check the loss ceiling and the five-year return.</li>
            <li>The weights are judgement calls. Different, equally reasonable weights would produce a different ranking.</li>
          </ul>
          <p style={{ fontSize: typography.fontSize.sm, color: colors.text3, margin: 0, lineHeight: 1.6 }}>
            Nothing on this site is investment advice.
          </p>
        </section>
      </div>
    </div>
  )
}
