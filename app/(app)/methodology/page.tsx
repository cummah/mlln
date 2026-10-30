import { Metadata } from 'next'
import { colors } from '@/lib/designSystem'
import { Reveal } from '@/components/home/Motion'
import { CtaBand, Eyebrow, MarketingFooter, MarketingStyles, PageHero } from '@/components/marketing/MarketingKit'

export const metadata: Metadata = {
  title: 'Methodology | How Enhanced DCA Works',
  description:
    'The ideas behind mlln\'s Enhanced DCA model: why it scales each purchase instead of timing the market, which kinds of evidence it draws on, and where its limits are.',
}

export const dynamic = 'force-static'

interface Reference {
  cite: string
  url?: string
  note: string
}

interface Principle {
  title: string
  idea: string
  why: string
  refs: Reference[]
}

interface Measure {
  title: string
  body: string
}

const PRINCIPLES: Principle[] = [
  {
    title: 'Short-term exhaustion',
    idea:
      'A momentum oscillator measures how stretched recent price moves have been. When selling looks exhausted, the model leans in; when buying looks exhausted, it holds back.',
    why:
      'Prices overreact in the short run and partly correct afterwards. Buying after sharp declines has historically been paid slightly better than buying after sharp rallies, though the effect is modest and uneven across markets and eras.',
    refs: [
      {
        url: 'https://doi.org/10.1111/j.1540-6261.1985.tb05004.x',
        cite: 'De Bondt, W. & Thaler, R. (1985). Does the Stock Market Overreact? Journal of Finance, 40(3).',
        note: 'Classic evidence that past losers tend to outperform past winners over longer horizons.',
      },
      {
        cite: 'Wilder, J. W. (1978). New Concepts in Technical Trading Systems. Trend Research.',
        note: 'Origin of the relative strength oscillator family used to quantify exhaustion.',
      },
    ],
  },
  {
    title: 'Distance from the long-run trend',
    idea:
      'A smoothed trend line summarises where price has been spending its time. The further price sits below that line, the cheaper the asset looks relative to its own recent history, and the larger the purchase.',
    why:
      'Prices fluctuate around slow-moving trends. Trend-following research also shows that assets far above their trend are usually in strong uptrends, so the model scales by distance in both directions rather than treating "above trend" as a sell signal on its own.',
    refs: [
      {
        url: 'https://doi.org/10.1111/j.1540-6261.1992.tb04681.x',
        cite: 'Brock, W., Lakonishok, J. & LeBaron, B. (1992). Simple Technical Trading Rules and the Stochastic Properties of Stock Returns. Journal of Finance, 47(5).',
        note: 'Moving-average based rules carried information about future returns in a long US sample.',
      },
      {
        url: 'https://papers.ssrn.com/sol3/papers.cfm?abstract_id=962461',
        cite: 'Faber, M. (2007). A Quantitative Approach to Tactical Asset Allocation. Journal of Wealth Management, 9(4).',
        note: 'Shows how a simple long-term trend filter can reduce drawdowns across asset classes.',
      },
    ],
  },
  {
    title: 'Trend strength: don\'t catch a falling knife',
    idea:
      'Cheap is not the same as good value. When a decline is not only deep but also orderly and persistent, the model reduces its buying rather than adding at full size, unless the fall is so severe that the long-term case for buying becomes compelling.',
    why:
      'Momentum is one of the most robust findings in empirical finance. Assets in persistent downtrends tend, on average, to keep underperforming for a while, so a buy-the-dip rule that ignores trend strength pays a price.',
    refs: [
      {
        url: 'https://doi.org/10.1111/j.1540-6261.1993.tb04702.x',
        cite: 'Jegadeesh, N. & Titman, S. (1993). Returns to Buying Winners and Selling Losers. Journal of Finance, 48(1).',
        note: 'Documents medium-term return continuation.',
      },
      {
        url: 'https://doi.org/10.1016/j.jfineco.2011.11.003',
        cite: 'Moskowitz, T., Ooi, Y. H. & Pedersen, L. H. (2012). Time Series Momentum. Journal of Financial Economics, 104(2).',
        note: 'Trend persistence across many asset classes, not just stocks.',
      },
    ],
  },
  {
    title: 'Drawdown depth',
    idea:
      'The deeper an asset is below its recent high, the more the model is willing to add, within a firm limit. Depth is measured against the asset\'s own history, so a volatile asset and a calm one are judged on their own terms.',
    why:
      'Long-horizon returns show some mean reversion after large declines, and a regular contributor has a structural advantage: new money buys more units when prices are low. The limit exists because deep drawdowns are also where permanent losses live.',
    refs: [
      {
        url: 'https://doi.org/10.1086/261535',
        cite: 'Fama, E. & French, K. (1988). Permanent and Temporary Components of Stock Prices. Journal of Political Economy, 96(2).',
        note: 'Evidence for slowly mean-reverting components in stock prices.',
      },
      {
        url: 'https://doi.org/10.1111/j.1467-9965.1993.tb00044.x',
        cite: 'Grossman, S. & Zhou, Z. (1993). Optimal Investment Strategies for Controlling Drawdowns. Mathematical Finance, 3(3).',
        note: 'Theory of how exposure should respond to distance from a running peak.',
      },
    ],
  },
  {
    title: 'Market fear',
    idea:
      'When market-wide fear is elevated and the asset is already showing signs of exhaustion, the model gives the purchase an extra lift.',
    why:
      'Implied volatility is a proxy for investor fear, and fear tends to be highest near short-term lows when risk is being repriced. Fear alone is not treated as a reason to buy; it only matters in combination with an asset-level signal.',
    refs: [
      {
        url: 'https://doi.org/10.3905/jpm.2000.319728',
        cite: 'Whaley, R. E. (2000). The Investor Fear Gauge. Journal of Portfolio Management, 26(3).',
        note: 'Introduces the VIX as a measure of market-wide fear and discusses what it does and does not tell you.',
      },
    ],
  },
]

const MEASURES: Measure[] = [
  {
    title: 'Point-in-time',
    body: 'Every signal uses only information that existed on its own date. Nothing is recomputed using later data, so history does not change when new prices arrive.',
  },
  {
    title: 'Compared with plain DCA',
    body: 'Results are measured against a standard fixed-amount schedule on the same asset and dates, so the difference reflects the sizing logic rather than the market.',
  },
  {
    title: 'Trading friction included',
    body: 'A small allowance for slippage is applied to every simulated trade.',
  },
  {
    title: 'End-of-day data',
    body: 'Signals update once per evening after the market close. They are not intraday alerts.',
  },
  {
    title: 'Enough history first',
    body: 'No signal is produced until an asset has a meaningful track record, so new listings stay blank rather than showing noisy output.',
  },
]

const FOUNDATION_REFS: Reference[] = [
  {
    url: 'https://doi.org/10.2307/2330513',
    cite: 'Constantinides, G. M. (1979). A Note on the Suboptimality of Dollar-Cost Averaging as an Investment Policy. Journal of Financial and Quantitative Analysis, 14(2).',
    note: 'The honest baseline: if a lump sum is available, fixed-schedule DCA is not optimal. It is a behavioural and cash-flow tool, which is the setting this model is built for.',
  },
  {
    url: 'https://doi.org/10.1111/0022-1082.00265',
    cite: 'Lo, A., Mamaysky, H. & Wang, J. (2000). Foundations of Technical Analysis. Journal of Finance, 55(4).',
    note: 'Computational evidence that some technical patterns carry incremental information, while stressing the need for rigorous testing.',
  },
]

const CAUTION_REFS: Reference[] = [
  {
    url: 'https://doi.org/10.1090/noti1105',
    cite: 'Bailey, D., Borwein, J., López de Prado, M. & Zhu, Q. (2014). Pseudo-Mathematics and Financial Charlatanism. Notices of the American Mathematical Society, 61(5).',
    note: 'How trying many variants on the same history produces impressive backtests that do not survive.',
  },
  {
    url: 'https://doi.org/10.1093/rfs/hhv059',
    cite: 'Harvey, C., Liu, Y. & Zhu, H. (2016). ...and the Cross-Section of Expected Returns. Review of Financial Studies, 29(1).',
    note: 'Why a claimed edge needs a higher bar of evidence after decades of data mining.',
  },
]

const SECTIONS = [
  { id: 'problem', label: 'The problem it addresses' },
  { id: 'sizing', label: 'How a purchase is sized' },
  { id: 'ideas', label: 'The five ideas' },
  { id: 'exits', label: 'Taking profit' },
  { id: 'cadence', label: 'Cadences and settings' },
  { id: 'measurement', label: 'How results are measured' },
  { id: 'limits', label: 'What it cannot tell you' },
]

function RefList({ refs }: { refs: Reference[] }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {refs.map(r => (
        <li key={r.cite} className="lp-small" style={{ lineHeight: 1.6 }}>
          {r.url ? (
            <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: colors.teal, textDecoration: 'none' }}>
              {r.cite} ↗
            </a>
          ) : (
            <span style={{ color: colors.text2 }}>{r.cite}</span>
          )}{' '}
          {r.note}
        </li>
      ))}
    </ul>
  )
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="lp-stack" style={{ gap: '8px' }}>
      <div className="lp-eyebrow" style={{ margin: 0, fontSize: '10px' }}>{label}</div>
      {children}
    </div>
  )
}

export default function MethodologyPage() {
  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <MarketingStyles />

      <PageHero
        eyebrow="Methodology"
        title="How Enhanced DCA decides what to buy"
        lead="This page explains the ideas behind the Enhanced DCA model and the research behind them. It does not publish the exact indicator settings, thresholds or weights."
      />

      <section className="lp-section" style={{ paddingTop: '24px' }}>
        <div className="lp-wrap lp-split">
          <nav className="lp-toc" aria-label="On this page">
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`}>{s.label}</a>
            ))}
          </nav>

          <div className="lp-main">
            <Reveal>
              <section id="problem" className="lp-anchor lp-stack" style={{ gap: '18px' }}>
                <Eyebrow>01 · Context</Eyebrow>
                <h2 className="lp-h2">The problem it addresses</h2>
                <p className="lp-body">
                  Dollar-cost averaging (DCA) means investing on a fixed schedule regardless of price. It is simple, it
                  removes the temptation to wait for a better moment, and it is easy to stick with. Its weakness is that it
                  treats every purchase date as equal, even when some dates are plainly better than others for a long-term
                  buyer.
                </p>
                <p className="lp-body">
                  Enhanced DCA keeps what is good about the schedule and changes only the size of each purchase. It never
                  tries to predict a crash or call a bottom. On every scheduled date, it asks a narrower question: given
                  what this asset has just done, should this contribution be smaller, normal, or larger than usual?
                </p>
              </section>
            </Reveal>

            <Reveal>
              <section id="sizing" className="lp-anchor lp-stack" style={{ gap: '18px' }}>
                <Eyebrow>02 · Mechanics</Eyebrow>
                <h2 className="lp-h2">How a purchase is sized</h2>
                <p className="lp-body">
                  Each scheduled date is scored on five independent questions. Each one nudges the purchase up or down, and
                  the nudges are combined into a single multiplier on the base contribution. A hard ceiling on that
                  multiplier means no single date, however attractive it looks, can dominate the plan.
                </p>
                <p className="lp-body">
                  The signals are deliberately drawn from different families of evidence: short-term reversal, trend
                  distance, trend strength, drawdown depth and market fear. They are meant to disagree with each other
                  sometimes. A purchase is only sized up strongly when several of them point the same way.
                </p>
              </section>
            </Reveal>

            <section id="ideas" className="lp-anchor lp-stack" style={{ gap: '18px' }}>
              <Reveal>
                <div className="lp-stack" style={{ gap: '18px' }}>
                  <Eyebrow>03 · Evidence</Eyebrow>
                  <h2 className="lp-h2">The five ideas</h2>
                </div>
              </Reveal>
              {PRINCIPLES.map((p, i) => (
                <Reveal key={p.title}>
                  <article className="lp-panel lp-stack" style={{ gap: '22px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
                      <span className="lp-num">{String(i + 1).padStart(2, '0')}</span>
                      <h3 className="lp-h3" style={{ fontSize: '19px' }}>{p.title}</h3>
                    </div>
                    <Labelled label="What it does">
                      <p className="lp-body">{p.idea}</p>
                    </Labelled>
                    <Labelled label="Why it is reasonable">
                      <p className="lp-body">{p.why}</p>
                    </Labelled>
                    <Labelled label="Further reading">
                      <RefList refs={p.refs} />
                    </Labelled>
                  </article>
                </Reveal>
              ))}
            </section>

            <Reveal>
              <section id="exits" className="lp-anchor lp-stack" style={{ gap: '18px' }}>
                <Eyebrow>04 · Exits</Eyebrow>
                <h2 className="lp-h2">Knowing when to take profit</h2>
                <p className="lp-body">
                  Buying is only half of the model. Each open position is also checked on later signal dates against a
                  separate exit assessment. It looks at the same kinds of evidence from the other side: is the asset
                  stretched, extended above its trend, no longer in a drawdown, and calm enough that fear is no longer
                  supporting the case? Positions exit when enough of those line up.
                </p>
                <p className="lp-body">
                  Alongside that, a volatility-based trailing stop is available as an alternative exit. It ratchets upward
                  as the price makes new highs and never moves back down, so it protects gains without trying to guess the
                  top. Wider settings tolerate more noise; tighter ones lock in profit sooner.
                </p>
              </section>
            </Reveal>

            <Reveal>
              <section id="cadence" className="lp-anchor lp-stack" style={{ gap: '18px' }}>
                <Eyebrow>05 · Cadence</Eyebrow>
                <h2 className="lp-h2">Different cadences, different settings</h2>
                <p className="lp-body">
                  Daily, weekly and monthly signals share the same logic, but the sensitivity of the underlying measures is
                  tuned for each cadence. A daily signal needs to react to short moves; a monthly one should look through
                  them. The settings are not published, and they are not interchangeable across cadences.
                </p>
              </section>
            </Reveal>

            <Reveal>
              <section id="measurement" className="lp-anchor lp-stack" style={{ gap: '18px' }}>
                <Eyebrow>06 · Testing</Eyebrow>
                <h2 className="lp-h2">How results are measured</h2>
                <div className="lp-grid2">
                  {MEASURES.map((m, i) => (
                    <div key={m.title} className="lp-tile lp-tile-surface" style={{ gridColumn: i === MEASURES.length - 1 ? '1 / -1' : undefined }}>
                      <div className="lp-num" style={{ marginBottom: '10px' }}>{String(i + 1).padStart(2, '0')}</div>
                      <h3 className="lp-h3" style={{ marginBottom: '8px' }}>{m.title}</h3>
                      <p className="lp-body" style={{ fontSize: '14px' }}>{m.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            </Reveal>

            <Reveal>
              <section id="limits" className="lp-anchor lp-stack" style={{ gap: '18px' }}>
                <Eyebrow>07 · Limits</Eyebrow>
                <h2 className="lp-h2">What it cannot tell you</h2>
                <p className="lp-body">
                  A backtest describes the past. The research above documents tendencies that are modest, uneven and have
                  weakened in some periods. Anyone who tests many variants on the same history will find some that look
                  excellent by chance, and we have no way to prove we are exempt from that risk. Treat past results as
                  evidence that the approach is sensible, not as a forecast.
                </p>
                <p className="lp-body">
                  Enhanced DCA also does not know your goals, tax position, time horizon or risk tolerance, and it does not
                  assess whether a company is sound. A cheap-looking asset can be cheap for good reason. Nothing on this
                  site is investment advice.
                </p>
                <div className="lp-panel lp-stack" style={{ gap: '16px', marginTop: '8px' }}>
                  <div className="lp-eyebrow" style={{ margin: 0 }}>Context and cautions</div>
                  <RefList refs={[...FOUNDATION_REFS, ...CAUTION_REFS]} />
                </div>
                <p className="lp-small">
                  Citations are given as pointers to the underlying literature. They motivate the ideas above; they do not
                  validate this specific model.
                </p>
              </section>
            </Reveal>
          </div>
        </div>
      </section>

      <CtaBand
        title="See the model on real assets"
        body="Every asset page shows Enhanced DCA against standard DCA, and the score criteria explain how assets are ranked."
        actions={[
          { label: 'Score criteria', href: '/score-criteria', primary: true },
          { label: 'See pricing', href: '/pricing' },
        ]}
      />

      <MarketingFooter />
    </div>
  )
}
