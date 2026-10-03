# SEO & AI SEO Optimisation Spec
**dashboard/[ticker] — programmatic, data-driven, applied to all 600 assets**

---

## 1. The core insight

Your pages have something most finance content doesn't: **specific, verifiable backtest numbers**.

"DCA S&P 500 5 years" → most results are opinion. Your page says:
- Standard DCA: +44.1% return, $31,988 value
- Enhanced DCA: +62.5% return, $32,670 value
- Alpha: +18.4%

AI models (ChatGPT, Perplexity, Claude) heavily cite pages with specific numbers, tables,
and structured data. Google ranks them for long-tail queries. This is your moat.

---

## 2. Target keyword structure (programmatic)

Every asset page targets a cluster of keywords. All generated from backtest data.

### Primary (high intent, low competition)
```
"dca [ticker] [N] year[s]"           → "dca spy 5 years"
"dca [full name] [N] year[s]"        → "dca s&p 500 5 years"
"dollar cost averaging [ticker]"      → "dollar cost averaging spy"
"[ticker] dca returns [year]"        → "spy dca returns 2024"
"[ticker] dca backtest"              → "spy dca backtest"
"[ticker] dca calculator"            → "spy dca calculator"
```

### Secondary (comparison intent)
```
"[ticker] dca vs lump sum"
"[ticker] enhanced dca results"
"[ticker] dca weekly vs monthly"
"best dca strategy [ticker]"
"[ticker] dca alpha"
```

### AI answer target queries (conversational)
```
"what would I have made dollar cost averaging into spy for 5 years"
"how much would $100 a week into spy be worth"
"is dca into spy worth it"
"did dca beat the market on spy"
"how many shares of spy would I have buying $100 a week"
```

These are exactly what people type into ChatGPT and Perplexity. Your page needs to
answer them explicitly in the page body — not just in metadata.

---

## 3. generateMetadata — dynamic per ticker + per backtest data

```ts
// app/dashboard/[ticker]/page.tsx

export async function generateMetadata({
  params,
}: {
  params: { ticker: string }
}): Promise<Metadata> {
  const ticker = params.ticker.toUpperCase()
  const data = await getBacktestSummary(ticker) // fetch from Supabase/API

  const { name, enhReturn5y, stdReturn5y, alpha5y, enhInvested5y, enhValue5y } = data

  return {
    title: `${ticker} DCA Backtest — ${enhReturn5y}% in 5 Years | [AppName]`,
    description:
      `Dollar cost averaging $100/week into ${ticker} (${name}) returned ${enhReturn5y}% ` +
      `over 5 years with Enhanced DCA — ${alpha5y}% more than standard DCA. ` +
      `See the full backtest, buy signal chart, and 1Y/3Y/5Y results.`,
    keywords: [
      `dca ${ticker.toLowerCase()}`,
      `dollar cost averaging ${ticker.toLowerCase()}`,
      `${ticker.toLowerCase()} dca backtest`,
      `${ticker.toLowerCase()} dca ${enhReturn5y} percent`,
      `${name.toLowerCase()} dca results`,
      `${name.toLowerCase()} dca 5 years`,
      `${ticker.toLowerCase()} dca calculator`,
      `${ticker.toLowerCase()} dca weekly`,
    ],
    openGraph: {
      title: `${ticker} DCA: +${enhReturn5y}% over 5 years (+${alpha5y}% vs standard)`,
      description:
        `$100/week into ${ticker} → $${enhValue5y.toLocaleString()} in 5 years. ` +
        `Enhanced DCA deployed only $${enhInvested5y.toLocaleString()} and beat ` +
        `standard DCA by ${alpha5y}%.`,
      type: 'website',
      images: [
        {
          url: `/api/og/${ticker}`,  // dynamic OG image — see section 7
          width: 1200,
          height: 630,
          alt: `${ticker} DCA backtest results — Enhanced vs Standard`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${ticker} DCA Backtest: +${enhReturn5y}% in 5 years`,
      description: `Enhanced DCA beat standard by ${alpha5y}%. See the full breakdown.`,
      images: [`/api/og/${ticker}`],
    },
    alternates: {
      canonical: `https://[yourdomain].com/dashboard/${ticker.toLowerCase()}`,
    },
  }
}
```

---

## 4. JSON-LD structured data (machine-readable for AI crawlers)

Add to every asset page. This is what Perplexity, ChatGPT, and Google's AI Overviews
pull from when generating cited answers.

```tsx
// components/ticker/StructuredData.tsx
// Add <StructuredData /> inside page.tsx — renders nothing visible

export function StructuredData({ ticker, data }: { ticker: string; data: BacktestSummary }) {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [

      // 1. The page itself
      {
        '@type': 'WebPage',
        '@id': `https://[yourdomain].com/dashboard/${ticker.toLowerCase()}`,
        name: `${ticker} DCA Backtest Results`,
        description: `Dollar cost averaging backtest for ${ticker} over 1, 3, and 5 years`,
        url: `https://[yourdomain].com/dashboard/${ticker.toLowerCase()}`,
        inLanguage: 'en-US',
      },

      // 2. The financial product / strategy being described
      {
        '@type': 'FinancialProduct',
        name: `Enhanced DCA Strategy for ${ticker}`,
        description:
          `An intelligent dollar cost averaging strategy for ${ticker} that buys ` +
          `more during market dips and less during overbought conditions.`,
        feesAndCommissionsSpecification: 'No management fees. Subscription from $29/mo.',
      },

      // 3. FAQ block — this is the AI citation goldmine
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `How much would I have if I DCA'd $100/week into ${ticker} for 5 years?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Dollar cost averaging $100 per week into ${ticker} for 5 years ` +
                `(${data.totalWeeks5y} purchases) would have resulted in a total investment ` +
                `of $${data.stdInvested5y.toLocaleString()} and a current value of ` +
                `$${data.stdValue5y.toLocaleString()}, a return of ${data.stdReturn5y}%. ` +
                `Using Enhanced DCA, which concentrates buys during dips, the same ` +
                `$100/week base deployed $${data.enhInvested5y.toLocaleString()} and ` +
                `grew to $${data.enhValue5y.toLocaleString()} — a ${data.enhReturn5y}% return.`,
            },
          },
          {
            '@type': 'Question',
            name: `What is the best DCA strategy for ${ticker}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Backtesting shows Enhanced DCA — which increases buy amounts during ` +
                `market dips and reduces or skips buys when ${ticker} is overextended — ` +
                `outperformed standard weekly DCA by ${data.alpha5y}% over 5 years. ` +
                `The enhanced strategy achieved a ${data.enhReturn5y}% return vs ` +
                `${data.stdReturn5y}% for standard DCA.`,
            },
          },
          {
            '@type': 'Question',
            name: `What would $100/week into ${ticker} be worth after 3 years?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Investing $100 per week into ${ticker} for 3 years (156 purchases, ` +
                `$${data.stdInvested3y.toLocaleString()} total) would have grown to ` +
                `$${data.stdValue3y.toLocaleString()} — a ${data.stdReturn3y}% return. ` +
                `Enhanced DCA over the same period returned ${data.enhReturn3y}%.`,
            },
          },
          {
            '@type': 'Question',
            name: `Is DCA into ${ticker} worth it?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Based on a 5-year backtest, DCA into ${ticker} returned ${data.stdReturn5y}% ` +
                `with standard weekly purchases. An intelligent DCA strategy that buys more ` +
                `during dips returned ${data.enhReturn5y}% over the same period — ` +
                `${data.alpha5y}% additional return — while deploying a similar amount of capital.`,
            },
          },
          {
            '@type': 'Question',
            name: `How many shares of ${ticker} would I have after DCA for 5 years?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                `Dollar cost averaging $100/week into ${ticker} for 5 years would result in ` +
                `approximately ${data.stdShares5y} shares with a standard DCA approach ` +
                `(avg entry $${data.stdAvgEntry5y}). Enhanced DCA targeting dips results in ` +
                `${data.enhShares5y} shares at an average entry of $${data.enhAvgEntry5y}.`,
            },
          },
        ],
      },

      // 4. Dataset — Google indexes this as a citable data source
      {
        '@type': 'Dataset',
        name: `${ticker} DCA Backtest Dataset`,
        description:
          `Historical backtest results for dollar cost averaging into ${ticker} ` +
          `over 1, 3, and 5 year periods, comparing standard vs enhanced DCA strategies.`,
        creator: { '@type': 'Organization', name: '[AppName]' },
        temporalCoverage: `${data.backtest_start_year}/${new Date().getFullYear()}`,
        variableMeasured: [
          'Total return %',
          'Capital deployed',
          'Portfolio value',
          'Number of purchases',
          'Average entry price',
          'Alpha vs standard DCA',
        ],
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

---

## 5. On-page content — the AI citation layer

AI models and Google both need to find the answer *in the page text*, not just in metadata.
Add a `BacktestNarrative` component that renders readable prose from the backtest data.
It sits below the tiles and above the chart — collapsible on mobile.

```tsx
// components/ticker/BacktestNarrative.tsx
// Renders dynamic prose from backtest data — indexed by Google, cited by AI

export function BacktestNarrative({ ticker, name, data }: Props) {
  return (
    <section aria-label="Backtest summary" className="...">
      <h2>Dollar cost averaging into {ticker} — backtest results</h2>

      <p>
        Investing <strong>$100 per week into {ticker} ({name})</strong> using standard
        dollar cost averaging over the past 5 years would have resulted in a total
        investment of <strong>${data.stdInvested5y.toLocaleString()}</strong> across{' '}
        <strong>{data.stdPurchases5y} purchases</strong>, growing to a current value of{' '}
        <strong>${data.stdValue5y.toLocaleString()}</strong> — a return of{' '}
        <strong>{data.stdReturn5y}%</strong>.
      </p>

      <p>
        Using Enhanced DCA — which increases buy amounts during market dips and reduces
        or skips buys when {ticker} is overextended — the same $100/week base deployed{' '}
        <strong>${data.enhInvested5y.toLocaleString()}</strong> across just{' '}
        <strong>{data.enhPurchases5y} targeted purchases</strong>, growing to{' '}
        <strong>${data.enhValue5y.toLocaleString()}</strong>. That's a return of{' '}
        <strong>{data.enhReturn5y}%</strong> — <strong>{data.alpha5y}% more</strong> than
        standard DCA, with a lower average entry price of{' '}
        <strong>${data.enhAvgEntry5y}</strong> vs ${data.stdAvgEntry5y}.
      </p>

      <h3>1-year DCA results for {ticker}</h3>
      <p>
        Over 1 year, $100/week into {ticker} ({data.stdPurchases1y} purchases,{' '}
        ${data.stdInvested1y.toLocaleString()} invested) returned {data.stdReturn1y}%,
        growing to ${data.stdValue1y.toLocaleString()}. Enhanced DCA returned{' '}
        {data.enhReturn1y}% over the same period — {data.alpha1y}% additional return.
      </p>

      <h3>3-year DCA results for {ticker}</h3>
      <p>
        Over 3 years, $100/week into {ticker} ({data.stdPurchases3y} purchases,{' '}
        ${data.stdInvested3y.toLocaleString()} invested) returned {data.stdReturn3y}%,
        growing to ${data.stdValue3y.toLocaleString()}. Enhanced DCA returned{' '}
        {data.enhReturn3y}% — {data.alpha3y}% ahead of standard DCA.
      </p>

      <h3>5-year DCA results for {ticker}</h3>
      <p>
        Over 5 years, $100/week into {ticker} ({data.stdPurchases5y} purchases,{' '}
        ${data.stdInvested5y.toLocaleString()} invested) returned {data.stdReturn5y}%,
        growing to ${data.stdValue5y.toLocaleString()}. Enhanced DCA returned{' '}
        {data.enhReturn5y}% — a {data.alpha5y}% advantage.
      </p>
    </section>
  )
}
```

**Styling note:** this section should look like editorial content — readable font size
(15px), comfortable line-height (1.7), max-width 680px, not crammed into a card.
It doesn't need to look like a data table. It looks like an article. That's intentional
for both readability and AI crawler indexing.

---

## 6. FAQ section (visible on page, not just JSON-LD)

Render the FAQ questions as a visible accordion below the narrative. Google rewards
visible FAQ content that matches the FAQ structured data. Also makes the page feel
like an authoritative reference.

```tsx
// components/ticker/FAQSection.tsx

const faqs = (ticker: string, name: string, data: BacktestSummary) => [
  {
    q: `How much would I have if I DCA'd $100/week into ${ticker} for 5 years?`,
    a: `$100/week into ${ticker} for 5 years would be worth $${data.stdValue5y.toLocaleString()} 
        with standard DCA (${data.stdReturn5y}% return). Enhanced DCA targeting dips 
        would have grown to $${data.enhValue5y.toLocaleString()} (${data.enhReturn5y}% return).`,
  },
  {
    q: `What is the best DCA strategy for ${ticker}?`,
    a: `Backtesting ${ticker} shows Enhanced DCA outperformed standard weekly DCA 
        by ${data.alpha5y}% over 5 years by concentrating buys during market dips 
        and skipping or reducing purchases when ${ticker} is overextended.`,
  },
  {
    q: `Is weekly or monthly DCA better for ${ticker}?`,
    a: `Weekly DCA into ${ticker} allows finer-grained timing of purchases during 
        volatility. Over 5 years, weekly $100 purchases returned ${data.stdReturn5y}%. 
        Monthly $433 purchases (equivalent capital) returned a similar rate but with 
        fewer opportunities to buy at dips.`,
  },
  {
    q: `How many shares of ${ticker} would I have after 5 years of DCA?`,
    a: `DCA of $100/week into ${ticker} for 5 years results in approximately 
        ${data.stdShares5y} shares at an average price of $${data.stdAvgEntry5y}. 
        Enhanced DCA achieves ${data.enhShares5y} shares at $${data.enhAvgEntry5y} average entry.`,
  },
]
```

---

## 7. Dynamic OG image — shareable, data-driven

Every asset page gets a dynamic Open Graph image generated at `/api/og/[ticker]`.
When someone shares the SPY page on Twitter/X, the preview card shows real numbers.
This drives click-through from social and is what AI models screenshot when citing.

```ts
// app/api/og/[ticker]/route.tsx
import { ImageResponse } from 'next/og'

export async function GET(req: Request, { params }: { params: { ticker: string } }) {
  const data = await getBacktestSummary(params.ticker)

  return new ImageResponse(
    (
      <div style={{
        width: '1200px', height: '630px',
        background: '#141412',
        display: 'flex', flexDirection: 'column',
        padding: '60px',
        fontFamily: 'DM Sans',
      }}>
        <div style={{ fontSize: 18, color: '#9c9a92', marginBottom: 8 }}>
          Dollar Cost Averaging Backtest
        </div>
        <div style={{ fontSize: 72, fontWeight: 500, color: '#f0ede6', marginBottom: 4 }}>
          {params.ticker.toUpperCase()}
        </div>
        <div style={{ fontSize: 22, color: '#9c9a92', marginBottom: 48 }}>
          {data.name}
        </div>

        {/* Key numbers */}
        <div style={{ display: 'flex', gap: 48 }}>
          <div>
            <div style={{ fontSize: 14, color: '#6b6b67' }}>Enhanced DCA · 5Y</div>
            <div style={{ fontSize: 56, fontWeight: 500, color: '#1D9E75' }}>
              +{data.enhReturn5y}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#6b6b67' }}>Standard DCA · 5Y</div>
            <div style={{ fontSize: 56, fontWeight: 500, color: '#9c9a92' }}>
              +{data.stdReturn5y}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#6b6b67' }}>Alpha advantage</div>
            <div style={{ fontSize: 56, fontWeight: 500, color: '#378ADD' }}>
              +{data.alpha5y}%
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 'auto', fontSize: 16, color: '#6b6b67',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>$100/week · Weekly · 5 year backtest</span>
          <span>[yourdomain].com</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
```

---

## 8. Sitemap — programmatic, covers all 600 assets

```ts
// app/sitemap.ts
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: assets } = await supabase
    .from('assets')
    .select('ticker, updated_at')

  return assets.map(asset => ({
    url: `https://[yourdomain].com/dashboard/${asset.ticker.toLowerCase()}`,
    lastModified: asset.updated_at,
    changeFrequency: 'weekly',   // backtest data updates weekly
    priority: asset.ticker === 'SPY' ? 1.0 : 0.8,
  }))
}
```

---

## 9. robots.txt

```ts
// app/robots.ts
export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/dashboard/',       // all asset pages public + crawlable
      disallow: '/api/',
    },
    sitemap: 'https://[yourdomain].com/sitemap.xml',
  }
}
```

---

## 10. AI SEO — specific tactics

### What AI models need to cite your page

Perplexity, ChatGPT (with browsing), and Google AI Overviews all prefer:
1. Specific numbers in plain prose (the BacktestNarrative component does this)
2. FAQPage structured data matching visible FAQ content
3. Dataset structured data (signals you have real data)
4. Pages that directly answer the question in the first 200 words
5. No login wall on the content (your page is public — advantage)

### Page title hierarchy (critical for AI citation)

```
h1: "SPY DCA Backtest — Dollar Cost Averaging Results"
h2: "Dollar cost averaging into SPY — backtest results"
h3: "1-year DCA results for SPY"
h3: "3-year DCA results for SPY"
h3: "5-year DCA results for SPY"
h2: "Frequently asked questions"
```

This exact heading structure makes the page look like a reference article to AI crawlers,
not a SaaS dashboard. Both can be true — the interactive elements are above, the
reference content is below.

### Content freshness signal

Add a visible "Last updated" line next to the backtest data:
```
"Backtest data updated weekly · Last updated: [date]"
```
AI models weight recently-updated pages more heavily for finance queries. This also
signals to users the data isn't stale.

### Internal linking (for all 600 assets)

Add a "Related assets" section at the bottom of each page. For SPY, link to:
- QQQ (Nasdaq DCA)
- VOO (Vanguard S&P DCA)
- IVV (iShares S&P DCA)
- BTC (Bitcoin DCA)

This creates a crawlable internal link graph across all 600 pages, boosting domain
authority for the whole /dashboard/ route.

```tsx
// components/ticker/RelatedAssets.tsx
// Pulled from a curated related_assets table in Supabase
// Shows: ticker, name, 5Y return, alpha — linked to their page
```

---

## 11. Programmatic data requirements (Supabase)

For all of the above to work programmatically across 600 assets, the following data
must be available per ticker in Supabase:

```sql
-- backtest_summary table
CREATE TABLE backtest_summary (
  ticker          TEXT PRIMARY KEY,
  name            TEXT,
  sector          TEXT,
  backtest_start  DATE,

  -- 1 year
  std_return_1y   NUMERIC,
  enh_return_1y   NUMERIC,
  alpha_1y        NUMERIC,
  std_invested_1y NUMERIC,
  enh_invested_1y NUMERIC,
  std_value_1y    NUMERIC,
  enh_value_1y    NUMERIC,
  std_purchases_1y INT,
  enh_purchases_1y INT,
  std_avg_entry_1y NUMERIC,
  enh_avg_entry_1y NUMERIC,
  std_shares_1y   NUMERIC,
  enh_shares_1y   NUMERIC,

  -- 3 year (same columns _3y)
  -- 5 year (same columns _5y)

  -- current signal
  current_signal_strength  TEXT,
  current_signal_amount    NUMERIC,
  current_signal_mult      NUMERIC,
  current_signal_reasoning TEXT,

  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

This table is computed by your backend engine weekly and read by the frontend. The
frontend never computes backtest results — it only reads from this table and scales
the tile values in JS when the user changes amount/frequency.

---

## 12. Claude Code addition to the spec prompt

Add this section to the existing frontend spec prompt:

```
SEO REQUIREMENTS — add to every asset page

1. generateMetadata — dynamic title, description, keywords, OG, Twitter
   Title format: "[TICKER] DCA Backtest — [enhReturn5y]% in 5 Years | [AppName]"
   Description: include ticker, enhReturn5y, alpha5y, enhInvested5y, enhValue5y

2. StructuredData component — JSON-LD with WebPage + FinancialProduct + FAQPage + Dataset
   Render inside page.tsx before closing </body>
   All FAQ answers populated from backtest_summary data

3. BacktestNarrative component — visible prose section below tiles, above chart
   h2: "Dollar cost averaging into [TICKER] — backtest results"
   h3 for each of: 1-year results, 3-year results, 5-year results
   All numbers pulled from backtest_summary, rendered as plain readable prose
   Styling: font-size 15px, line-height 1.7, max-width 680px — editorial style

4. FAQSection component — visible accordion below narrative
   5 questions per page, all answers populated from backtest data
   Must match FAQPage JSON-LD exactly

5. Dynamic OG image at /api/og/[ticker]
   Shows ticker, enhanced 5Y return, standard 5Y return, alpha
   Dark background, large numbers — built with next/og ImageResponse

6. Sitemap entry — app/sitemap.ts reads all tickers from Supabase assets table
   changeFrequency: 'weekly', priority 1.0 for SPY else 0.8

7. Page heading structure:
   h1: "[TICKER] DCA Backtest — Dollar Cost Averaging Results"
   h2: "Dollar cost averaging into [TICKER] — backtest results"
   h3: per time period
   h2: "Frequently asked questions"

8. RelatedAssets component — 4 related tickers linked to their /dashboard/[ticker] page
   Pulled from related_assets table in Supabase

9. Last updated line: "Backtest data updated weekly · Last updated: [updated_at from DB]"
```