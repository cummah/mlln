# Enhanced DCA — Frontend Specification
**For Claude Code · Full build spec**

---

## 1. Project overview

A SaaS web application for an intelligent Dollar Cost Averaging strategy tool. The product runs a proprietary engine on top of standard DCA, buying more during market dips and less (or nothing) when markets are overextended. The frontend serves two audiences:

- **Unregistered visitors** — land on a public asset page (e.g. SPY), see backtest proof, hit a conversion gate
- **Registered users (Free)** — access their dashboard, watchlist, and backtest tiles; signal for the week is blurred
- **Subscribers (Pro $29/mo)** — live weekly signals, broker connection, up to 10 assets
- **Quant ($99/mo)** — API access, unlimited assets, marketplace publishing

**Current model constraint:** The backend currently supports one preset only (equivalent to "Balanced"). The 4-preset UI (Conservative / Balanced / Aggressive / Max) should be built in full but all non-Balanced presets should display a "Coming soon" state. The aggression slider and preset selector are built and visible, but only Balanced returns live data.

---

## 2. Tech stack

```
Framework:        Next.js 14 (App Router)
Language:         TypeScript
Styling:          Tailwind CSS + CSS custom properties for theming
Charts:           TradingView Lightweight Charts v4 (lightweight-charts)
Database:         Supabase (5Y daily OHLC data — existing)
Auth:             Clerk or NextAuth (TBD by backend team)
State:            Zustand (client), React Query (server state)
Fonts:            Geist (headings) + DM Sans (body) — via next/font
Icons:            Lucide React
Animation:        Framer Motion (page transitions, gate reveals)
Deployment:       Vercel
```

---

## 3. Design system

### 3.1 Colour tokens

```css
:root {
  /* Backgrounds */
  --bg-primary:     #ffffff;
  --bg-secondary:   #f8f8f6;
  --bg-tertiary:    #f1f0eb;

  /* Text */
  --text-primary:   #1a1a18;
  --text-secondary: #6b6b67;
  --text-tertiary:  #9c9a92;

  /* Borders */
  --border-subtle:  rgba(0,0,0,0.08);
  --border-medium:  rgba(0,0,0,0.15);

  /* Semantic */
  --green-fill:     #EAF3DE;
  --green-text:     #27500A;
  --green-mid:      #639922;
  --green-strong:   #1D9E75;

  --blue-fill:      #E6F1FB;
  --blue-text:      #0C447C;
  --blue-mid:       #378ADD;

  --amber-fill:     #FAEEDA;
  --amber-text:     #633806;
  --amber-mid:      #BA7517;

  --red-fill:       #FCEBEB;
  --red-text:       #791F1F;
  --red-mid:        #E24B4A;

  --teal-light:     #9FE1CB;
  --teal-mid:       #5DCAA5;
  --teal-strong:    #1D9E75;
  --teal-dark:      #0F6E56;

  /* Radius */
  --radius-sm:      6px;
  --radius-md:      8px;
  --radius-lg:      12px;
  --radius-xl:      16px;
}

[data-theme="dark"] {
  --bg-primary:     #141412;
  --bg-secondary:   #1c1c1a;
  --bg-tertiary:    #242422;
  --text-primary:   #f0ede6;
  --text-secondary: #9c9a92;
  --text-tertiary:  #6b6b67;
  --border-subtle:  rgba(255,255,255,0.07);
  --border-medium:  rgba(255,255,255,0.13);
}
```

### 3.2 Typography

```css
/* Headings: Geist */
h1 { font-size: 28px; font-weight: 500; }
h2 { font-size: 20px; font-weight: 500; }
h3 { font-size: 16px; font-weight: 500; }

/* Body: DM Sans */
body { font-size: 14px; font-weight: 400; line-height: 1.6; }

/* Utility classes */
.label-xs  { font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); }
.label-sm  { font-size: 12px; color: var(--text-secondary); }
.val-lg    { font-size: 24px; font-weight: 500; }
.val-xl    { font-size: 32px; font-weight: 500; }
```

### 3.3 Component tokens

```
Cards:        bg-primary, border 0.5px border-subtle, radius-lg, padding 20px
Stat cards:   bg-secondary, no border, radius-md, padding 12px
Pills:        radius-full, font-size 11px, font-weight 500, padding 3px 9px
Buttons:      radius-md, font-size 13px, padding 8px 18px
Inputs:       radius-md, border 0.5px border-medium, height 36px, padding 0 12px
Dividers:     0.5px border-subtle
Sections:     label-xs above, border-bottom 0.5px border-subtle, margin-bottom 10px
```

### 3.4 TradingView Lightweight Charts global defaults

```ts
// lib/chartDefaults.ts
// Apply these options when creating every chart instance

export const chartOptions = {
  layout: {
    background: { color: 'transparent' },
    textColor: '#9c9a92',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 11,
  },
  grid: {
    vertLines: { color: 'rgba(0,0,0,0.05)' },
    horzLines: { color: 'rgba(0,0,0,0.05)' },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
  },
  rightPriceScale: {
    borderColor: 'rgba(0,0,0,0.08)',
  },
  timeScale: {
    borderColor: 'rgba(0,0,0,0.08)',
    timeVisible: true,
    secondsVisible: false,
  },
  handleScroll: false,
  handleScale: false,
};

// Dark mode overrides — apply when data-theme="dark"
export const chartOptionsDark = {
  ...chartOptions,
  grid: {
    vertLines: { color: 'rgba(255,255,255,0.06)' },
    horzLines: { color: 'rgba(255,255,255,0.06)' },
  },
  rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
  timeScale: { borderColor: 'rgba(255,255,255,0.08)' },
};
```

---

## 4. Page map

```
/                              → Marketing home (out of scope for this build)
/dashboard/[ticker]            → Public asset page (primary build target — overwrites existing page.tsx)
/dashboard                     → Authenticated dashboard home
/dashboard/watchlist           → Watchlist manager
/dashboard/settings            → Account + preset settings
/auth/sign-up                  → Sign-up (Clerk modal or page)
/auth/sign-in                  → Sign-in
```

> **Important:** `app/dashboard/[ticker]/page.tsx` already exists in the codebase. This build **overwrites** it entirely. Do not merge — replace.

---

## 5. Asset page — `/dashboard/[ticker]`

This is the primary conversion page. Accessible to all users (authenticated and not). All sections visible except gated ones. **Overwrites the existing `app/dashboard/[ticker]/page.tsx`.**

### 5.1 Page header

```
Layout: flex row, space-between, align-start
Left:
  - Ticker (28px, font-weight 500) e.g. "SPY"
  - Asset name pill: "S&P 500 ETF" — green-fill bg, green-text
  - Signal badge (live): dot + label e.g. "● Mild opportunity" — green-fill, green-text
    · dot color maps to signal strength: green (mild), amber (moderate), red (strong/crash)
  - Below: full name · sector · current price · today % change

Right:
  - Current price (24px, font-weight 500)
  - 1-day change % (color: green if positive, red if negative)
```

### 5.2 Backtest settings bar

Visible to all users. Updates all tiles and chart live on change.

```
Row layout: flex, gap 12px, align-center, wrap

Element 1 — Frequency segmented control:
  [Weekly] [Monthly]
  - Segmented button style: border 0.5px, radius-md, active = bg-text-primary + text-bg-primary
  - Default: Weekly

Element 2 — Amount input:
  Label: "Amount"
  Prefix: "$"
  Input: number, min 10, max 50000, step 10, default 100
  Suffix: "per week" or "per month" (updates with frequency)

Element 3 — Quick amount buttons:
  [$50] [$100] [$250] [$500]
  - Ghost button style
  - Clicking sets the input value and triggers recalculation

On any change → recalculate all tile values and re-render chart
```

### 5.3 Backtest result tiles (1Y / 3Y / 5Y)

Three tiles in a 3-column grid. Each tile compares Standard DCA vs Enhanced DCA for the selected amount and frequency.

**Tile anatomy:**

```
┌─────────────────────────────────┐
│ [Period label]    [+X.X% alpha] │  ← header: border-bottom
│─────────────────────────────────│
│ Standard DCA          label-xs  │
│ Invested        $XX,XXX         │
│ Value           $XX,XXX         │
│ Return          XX.X%           │
│ Purchases       XXX             │
│ ──────────────────────────────  │
│ Enhanced DCA          label-xs  │  ← blue text
│ Invested        $XX,XXX         │
│ Value           $XX,XXX  green  │
│ Return          XX.X%    green  │
│ Buys / skipped  XX / XXX        │
│ ──────────────────────────────  │
│ Alpha advantage       +XX.X%    │  ← larger, green
└─────────────────────────────────┘
```

**Tile data — base values at $100/week:**

| Metric | 1Y Std | 1Y Enh | 3Y Std | 3Y Enh | 5Y Std | 5Y Enh |
|---|---|---|---|---|---|---|
| Return % | 5.7 | 8.6 | 20.4 | 22.6 | 44.1 | 62.5 |
| Invested | $5,200 | $1,246 | $15,600 | $5,717 | $26,000 | $20,101 |
| Purchases | 52 | 7 | 156 | 35 | 260 | 75 |
| Skipped | 4 | — | 83 | — | 147 | — |
| Alpha | — | +2.9% | — | +2.2% | — | +18.4% |

**Scaling formula** (apply when user changes amount/frequency):
```js
// Weekly → Monthly: divide periods by 4.33
const freqMult = frequency === 'monthly' ? 1 / 4.33 : 1;
const periods = Math.round(basePeriods * freqMult);
const stdInvested = amount * periods;
const enhInvested = Math.round(stdInvested * (enhBaseInvested / stdBaseInvested));
const stdValue = Math.round(stdInvested * (1 + stdReturn / 100));
const enhValue = Math.round(enhInvested * (1 + enhReturn / 100));
const stdBuys = Math.round(baseStdBuys * freqMult);
const enhBuys = Math.round(baseEnhBuys * freqMult);
```

**Gate — 1Y tile only:**
```
Position: absolute, inset 0
Style: backdrop-filter blur(7px), bg rgba(255,255,255,0.08) [dark: rgba(0,0,0,0.25)]
Content (centered column):
  - Lock icon SVG (28px circle container)
  - "Free sign-up to unlock" — 13px font-weight 500
  - [Free sign-up] button → /auth/sign-up
  - "No card required" — 10px text-tertiary

Behaviour: remove gate when user is authenticated (any tier)
```

### 5.4 Alpha callout banner

Between tiles and chart. Full width.

```
Background: green-fill
Border-radius: radius-md
Padding: 14px 18px
Layout: flex, space-between, align-center

Left:
  - Label: "Alpha advantage" (11px, green-text, font-weight 500)
  - Value: "+18.4%" (30px, green-text, font-weight 500)
    · Recalculates to match 5Y tile alpha

Right (max-width 280px):
  - Body text (12px, #3B6D11, line-height 1.5):
    "Enhanced DCA deployed less capital and achieved a higher return
     — by concentrating buys at better prices."
```

### 5.5 Buy signal chart — TradingView Lightweight Charts

**This is the hero element of the page. It must load fast and look credible.**

The chart uses real OHLC candlestick data from Supabase, with buy signal triangles overlaid as `SeriesMarker` objects. Triangle size maps to buy amount. This is more compelling than an equity curve because it makes the strategy's intelligence *visible* — large triangles sit exactly on crash-low candles.

```
Container: card, padding 16px
Height:    320px (desktop) / 220px (mobile)
Range:     1Y / 3Y / 5Y toggle (top-right of card)
```

**Supabase data fetch:**
```ts
// lib/supabase.ts — fetch OHLC for chart
const { data } = await supabase
  .from('ohlc_daily')
  .select('date, open, high, low, close, volume')
  .eq('ticker', ticker)
  .gte('date', rangeStartDate)   // calculated from range param
  .order('date', { ascending: true });

// Shape for Lightweight Charts CandlestickSeries:
const candleData = data.map(row => ({
  time: row.date,          // 'YYYY-MM-DD' string — LWC accepts this directly
  open:  row.open,
  high:  row.high,
  low:   row.low,
  close: row.close,
}));
```

**Chart construction (`components/dashboard/SignalChart.tsx`):**
```ts
'use client';
import { createChart, CandlestickSeries, SeriesMarkerPosition, SeriesMarkerShape } from 'lightweight-charts';
import { useEffect, useRef } from 'react';

// Chart init
const chart = createChart(containerRef.current, {
  ...chartOptions,           // from lib/chartDefaults.ts
  width: container.clientWidth,
  height: 320,
  autoSize: true,
});

// Candlestick series
const candleSeries = chart.addSeries(CandlestickSeries, {
  upColor:          '#1D9E75',
  downColor:        '#E24B4A',
  borderUpColor:    '#1D9E75',
  borderDownColor:  '#E24B4A',
  wickUpColor:      '#1D9E75',
  wickDownColor:    '#E24B4A',
});
candleSeries.setData(candleData);
```

**Triangle markers (SeriesMarker):**

Map each weekly buy signal to a `SeriesMarker` on the candlestick series. Markers sit at the `low` of the candle for that week's signal date.

```ts
// Size mapping — LWC SeriesMarker supports: 0 (tiny) through 4 (large)
// We use 3 visible tiers to preserve the "big triangle at crash" visual
function multToMarkerSize(mult: number): number {
  if (mult === 0) return 0;        // skipped — still rendered as ghost
  if (mult < 1.5)  return 1;       // small  — base amount
  if (mult < 2.5)  return 2;       // medium — moderate dip
  if (mult < 4.0)  return 3;       // large  — strong dip
  return 4;                        // extra large — crash / extreme dip
}

// Colour ramp by size
function multToColor(mult: number, skipped: boolean): string {
  if (skipped)    return 'rgba(180,178,169,0.35)'; // ghost gray
  if (mult < 1.5) return '#9FE1CB';  // teal-light
  if (mult < 2.5) return '#5DCAA5';  // teal-mid
  if (mult < 4.0) return '#1D9E75';  // teal-strong
  return '#0F6E56';                   // teal-dark
}

const markers = signals.map(sig => ({
  time:      sig.date,                          // 'YYYY-MM-DD'
  position:  'belowBar' as SeriesMarkerPosition,
  shape:     'arrowUp' as SeriesMarkerShape,    // LWC built-in upward triangle
  color:     multToColor(sig.mult, sig.skipped),
  size:      multToMarkerSize(sig.mult),
  text:      sig.skipped ? '' : `$${Math.round(baseAmount * sig.mult)}`,
}));

candleSeries.setMarkers(markers);
```

**Tooltip customisation:**
```ts
chart.subscribeCrosshairMove(param => {
  if (!param.time) return;
  const sig = signals.find(s => s.date === param.time);
  if (!sig) return;
  // Show custom tooltip:
  // "Week of [date] · Buy: $[amount] ([mult]× base)" or "Skipped this week"
});
```

**Range toggle behaviour:**
```
1Y: fetch last 365 days of OHLC + signals from Supabase
3Y: fetch last 3 * 365 days
5Y: fetch full 5Y dataset (already in Supabase)

On range change: re-fetch, re-set candleSeries data and markers.
Chart auto-fits to new data via chart.timeScale().fitContent()
```

**Legend (below chart):**
```
Row: flex, gap 16px, flex-wrap
Items (use actual triangle SVGs matching LWC marker colours):
  ▲ large teal-dark    "Large buy — strong dip"
  ▲ medium teal-mid    "Medium buy — moderate signal"
  ▲ small teal-light   "Small buy — base amount"
  △ ghost gray outline "Skipped — unfavourable conditions"
```

**Performance note:** Fetch OHLC + signals server-side in the page Server Component. Pass as serialised props to `<SignalChart />` (Client Component). No client-side Supabase call on initial load — only on range toggle changes.

### 5.6 This week's signal (gated)

**Visible structure (always rendered, then gated):**
```
Card layout: 3-column stat grid + reasoning text below

Stats:
  [Recommended buy]   [Signal strength]   [vs your base]
  $247 (blue)         Moderate            +147% (green)

Reasoning box (bg-secondary, radius-md, padding 10px 12px):
  "Market conditions suggest a buying opportunity this week.
   Your engine recommends deploying above your base amount."
```

**Gate overlay (unregistered + free tier):**
```
Position: absolute inset 0
backdrop-filter: blur(8px)
bg: rgba(128,128,128,0.06)

Content (centered):
  - Lock icon
  - "Subscribe to unlock live signals" (13px, font-weight 500)
  - "Know exactly how much to buy each week" (11px, text-secondary)
  - [Start free trial] → /auth/sign-up?plan=pro   (filled button)
  - [View plans] → /pricing                        (ghost button)
  - "From $29/mo · cancel anytime" (10px, text-tertiary)

Gate shown for: unauthenticated users AND free-tier users
Gate hidden for: Pro and Quant subscribers
```

### 5.7 Supporting stats row

Two cards side-by-side below the signal gate.

```
Card 1: Avg entry price — enhanced
  Value: "$439 vs $495 standard" (16px, green for enhanced figure)
  Sub: "11.3% lower cost basis over 5 years"

Card 2: Capital efficiency
  Value: "$20,101 deployed" (16px)
  Sub: "vs $22,200 standard — same result, less spent"

Both values scale with amount/frequency selector.
```

---

## 6. Dashboard — `/dashboard`

Only accessible to authenticated users. Redirect unauthenticated to `/auth/sign-in`.

### 6.1 Top bar

```
Left:  Logo + "Dashboard"
Right: Asset search input | Notifications icon | User avatar + plan badge
```

### 6.2 Portfolio summary bar

```
4-column stat grid (stat card style):
  [Total invested]   [Current value]   [Total return]   [Alpha vs standard]
  $20,101            $32,670           +62.5%           +18.4%

All values pulled from /api/user/portfolio/summary
```

### 6.3 Aggression slider (single preset — current model)

```
Card with label: "Strategy preset"

Current state: single preset, displayed as "Balanced"
  - Show a disabled 4-stop slider visual (Conservative → Balanced → Aggressive → Max)
  - Only "Balanced" stop is active/selectable
  - Other stops show "Coming soon" tooltip on hover
  - Label below slider: "Balanced — Buys more on dips, less when stretched. Best for most investors."

Signal preview (live, updates on amount change):
  Card with border-left 3px solid (colour maps to signal strength):
    "$130 this Monday"
    "Market conditions favour a modest increase over your base amount."
    "● Our engine sees a mild opportunity — no strong signals either way."
```

**Future state (4 presets — build UI now, data later):**
```
Conservative | Balanced | Aggressive | Max
[    ●    ]  [   ●    ] [    ●     ] [ ● ]

Each preset card:
  - Name (13px, font-weight 500)
  - Description (11px, text-secondary)
  - Performance stat: "+62.5% return · moderate"
  - "Coming soon" badge on Conservative, Aggressive, Max
```

### 6.4 Watchlist / active DCA assets

```
Section header: "Your watchlist — signals this week"
  Right: [+ Add asset] button → opens asset search modal

Asset list table:
  Columns: [Icon/ticker] [Name + preset] [Signal] [This week's buy] [Override] [Actions]

Per row:
  - 32px ticker icon (letter-avatar, bg-secondary)
  - Ticker (13px, font-weight 500) + asset name (11px, text-secondary) + "Balanced" label
  - Signal badge (colour-coded): "Strong dip" / "Mild dip" / "Neutral" / "Overbought"
  - Buy amount (13px, colour matches preset: blue for Balanced)
  - Override pill: "Set override" (ghost) or "Override set" (amber pill)
  - ··· menu: Remove asset, View asset page

Free tier: max 3 assets, show locked row with upgrade prompt at row 4
Pro tier: max 10 assets
Quant: unlimited

Override drawer (opens inline below row):
  - "Asset preset" select: [Use portfolio default] [Conservative*] [Balanced] [Aggressive*] [Max*]
    * = Coming soon, disabled option
  - "Base amount override" select: [Use default ($100)] [$50] [$100] [$200] [$500] [Custom...]
  - [Cancel] [Clear override] buttons
```

### 6.5 This week's total

```
Card below watchlist:
  "This week's total deploy: $620"
  Breakdown: SPY $247 · BTC $183 · ETH $190
  Sub: "Executes Monday at market open"
  [Connect broker to auto-execute →]  (if not connected)
```

---

## 7. Settings page — `/dashboard/settings`

### 7.1 Strategy settings

```
Base amount: number input
Frequency: Weekly / Monthly segmented
Max weekly/monthly spend: number input (hard cap)
Monthly budget guard: number input (never exceed per month total)
```

### 7.2 Broker connection (Pro+)

```
Supported: Alpaca, Interactive Brokers, Coinbase
Each: logo + name + [Connect] button or [Connected ✓] state
Gate for Free users: blurred section + "Upgrade to Pro to enable auto-execution"
```

### 7.3 Notifications

```
Toggles:
  - Weekly signal ready (email)
  - Strong dip detected (push)
  - Multiplier cap hit (email)
  - Trade executed (email + push)
```

---

## 8. Global navigation

### 8.1 Unauthenticated nav

```
Left:  [Logo] [Assets ▾] [How it works] [Pricing]
Right: [Sign in] [Get started →]
```

### 8.2 Authenticated nav

```
Left:  [Logo] [Dashboard] [Assets ▾] [Marketplace*]  (* coming soon)
Right: [Search] [Notifications] [Avatar + plan badge]
```

---

## 9. Conversion gates — full spec

Three distinct gate levels used across the product:

### Gate A — Free sign-up (1Y tile)
```
Trigger: unauthenticated user
Blur: backdrop-filter blur(7px)
CTA: "Free sign-up to unlock" → /auth/sign-up
Sub: "No card required"
Removes when: any authenticated session
```

### Gate B — Subscribe (live signal)
```
Trigger: unauthenticated OR free-tier user
Blur: backdrop-filter blur(8px)
CTA primary: "Start free trial" → /auth/sign-up?plan=pro
CTA secondary: "View plans" → /pricing
Price note: "From $29/mo · cancel anytime"
Removes when: Pro or Quant subscription active
```

### Gate C — Watchlist row 4+ (Free tier)
```
Style: not blurred — greyed out locked row
Lock icon + "Upgrade to Pro to add more assets"
Inline upgrade link → /pricing
Removes when: Pro or Quant
```

---

## 10. API contract (frontend expects)

### Asset data
```
GET /api/dashboard/[ticker]
→ { ticker, name, sector, price, change1d, changePercent1d }

GET /api/dashboard/[ticker]/signals?range=1y|3y|5y&amount=100&frequency=weekly
→ {
    signals: [{ date, price, mult, skipped, buyAmount }],
    ohlc:    [{ date, open, high, low, close }],   // pulled from Supabase ohlc_daily
    summary: {
      stdReturn, enhReturn, alpha,
      stdInvested, enhInvested,
      stdValue, enhValue,
      stdPurchases, enhPurchases, skipped,
      avgEntryStd, avgEntryEnh
    },
    currentSignal: {
      amount, strength, mult, reasoning
    }
  }
```

> **Supabase table:** `ohlc_daily` with columns `ticker, date, open, high, low, close, volume`. The frontend fetches this server-side; the Client Component receives it as props.

### User portfolio
```
GET /api/user/portfolio/summary
→ { totalInvested, currentValue, returnPct, alphaPct }

GET /api/user/watchlist
→ [{ ticker, name, preset, baseAmount, override, signal, thisBuy }]

POST /api/user/watchlist
→ { ticker }

DELETE /api/user/watchlist/[ticker]

PUT /api/user/watchlist/[ticker]/override
→ { preset?, baseAmount? }
```

---

## 11. State management

```
// Zustand store
interface AppStore {
  // Settings (persisted to localStorage)
  frequency: 'weekly' | 'monthly';
  baseAmount: number;
  preset: 'balanced';  // only one now; extend later

  // Asset page
  selectedRange: '1y' | '3y' | '5y';

  // Auth (from Clerk/NextAuth)
  user: User | null;
  plan: 'free' | 'pro' | 'quant' | null;
}
```

---

## 12. Animation & interaction spec

### Page load (asset page)
```
Stagger reveal sequence (Framer Motion):
  0ms:   Header fades in (opacity 0→1, y 10→0, duration 300ms)
  100ms: Settings bar slides in
  200ms: Tile grid fades in (each tile staggered 60ms)
  400ms: Chart renders immediately from SSR props — no animation needed, data is pre-loaded
  600ms: Signal section + supporting stats fade in
```

### Amount/frequency change
```
Tile values: animate number count-up (200ms, easing ease-out)
Chart: re-render with 400ms animation
Alpha callout: pulse green briefly (scale 1→1.02→1, 300ms)
```

### Gate hover
```
Blur overlay: slight scale 1→1.01 on hover (200ms)
CTA button: standard hover state (bg darken, 150ms)
```

### Preset switching (dashboard)
```
Signal preview card: fade out / fade in (150ms each)
Buy amount: count-up animation (200ms)
Border-left colour: transition 300ms
```

---

## 13. Responsive breakpoints

```
Mobile  (< 640px):  Tile grid → 1 column. Stat row → 2 column. Chart height 180px.
Tablet  (640–1024px): Tile grid → 2 column (3Y + 5Y shown, 1Y below). Nav collapses.
Desktop (> 1024px):  Full 3-column tile grid. Side-by-side stat cards.
```

---

## 14. File structure

```
src/
  app/
    dashboard/
      [ticker]/
        page.tsx              ← Asset page — OVERWRITES EXISTING FILE
        loading.tsx           ← Skeleton loaders
      page.tsx                ← Dashboard home
      watchlist/page.tsx
      settings/page.tsx
    auth/
      sign-up/page.tsx
      sign-in/page.tsx

  components/
    ticker/
      AssetHeader.tsx
      BacktestSettings.tsx    ← frequency + amount controls
      BacktestTiles.tsx       ← 1Y/3Y/5Y tile grid
      AlphaBanner.tsx
      SignalChart.tsx          ← TradingView Lightweight Charts + SeriesMarker triangles
      SignalChartLegend.tsx    ← triangle legend below chart
      SignalGate.tsx           ← blurred live signal card
      SupportingStats.tsx

    dashboard/
      PortfolioSummary.tsx
      AggressionSlider.tsx    ← preset selector (1 active, 3 coming soon)
      WatchlistTable.tsx
      OverrideDrawer.tsx
      WeeklyTotal.tsx

    gates/
      FreeSignupGate.tsx      ← Gate A
      SubscribeGate.tsx       ← Gate B
      UpgradeRowGate.tsx      ← Gate C

    ui/
      SegmentedControl.tsx
      StatCard.tsx
      Pill.tsx
      Card.tsx
      Button.tsx
      NumberTicker.tsx        ← animated count-up

  hooks/
    useAssetSignals.ts        ← React Query wrapper — range toggle refetch
    useOHLC.ts                ← React Query wrapper — Supabase OHLC on range change
    usePortfolio.ts
    useWatchlist.ts

  lib/
    chartDefaults.ts          ← TradingView Lightweight Charts global options
    supabase.ts               ← Supabase client + typed OHLC fetch helpers
    signalCalculations.ts     ← tile scaling formulas for amount/freq changes
    formatters.ts             ← currency, percent, date formatters

  store/
    appStore.ts               ← Zustand store

  types/
    index.ts                  ← shared TypeScript interfaces
```

---

## 15. Key implementation notes for Claude Code

1. **Tile scaling is pure JS** — do not re-fetch from API when amount/frequency changes. Scale the base $100/weekly values using the formulas in section 5.3. Only re-fetch when ticker or range changes.

2. **SignalChart is a Client Component** — TradingView Lightweight Charts requires DOM access. Mark `SignalChart.tsx` with `'use client'`. The parent page (`page.tsx`) is a Server Component that fetches OHLC + signals from Supabase and passes them as props. Initial render has zero client-side loading time for the chart data.

3. **TradingView chart cleanup** — always call `chart.remove()` in the `useEffect` cleanup function to prevent memory leaks on unmount or re-render:
   ```ts
   useEffect(() => {
     const chart = createChart(ref.current, options);
     // ... setup
     return () => chart.remove();
   }, []);
   ```

4. **Supabase OHLC date format** — Supabase returns dates as `'YYYY-MM-DD'` strings. TradingView Lightweight Charts accepts this format directly for the `time` field. Do not convert to timestamps.

5. **Markers must be set after data** — always call `candleSeries.setMarkers(markers)` *after* `candleSeries.setData(candleData)`. LWC will silently drop markers set before data.

6. **Range toggle refetch** — on 1Y/3Y/5Y toggle, call `chart.timeScale().fitContent()` after updating data so the chart auto-adjusts to the new date range without jarring jumps.

7. **Gates are always rendered** — the blurred content underneath the gate must be real DOM (not hidden/empty) so the blur has something to obscure. Use `position: relative` on the wrapper and `position: absolute; inset: 0` on the gate overlay.

8. **Preset selector — current model** — only `balanced` returns live data. Build the full 4-button UI. On click of Conservative / Aggressive / Max, show a toast: "Coming soon — we're training this preset now." Do not change any displayed values.

9. **Dark mode** — use `data-theme` attribute on `<html>`. TradingView chart colours must update on theme change — re-apply `chartOptions` or `chartOptionsDark` via `chart.applyOptions()` when the theme attribute changes. Use a `useTheme` hook that watches `document.documentElement.dataset.theme`.

10. **All numbers displayed must be rounded** — use `Intl.NumberFormat` for currency, `.toFixed(1)` for percentages. Never display raw JS float arithmetic results.

11. **Signal strength colour mapping:**
    ```ts
    const signalColor: Record<string, string> = {
      'Strong dip':       '#E24B4A',  // red
      'Moderate dip':     '#BA7517',  // amber
      'Mild dip':         '#639922',  // green
      'Mild opportunity': '#639922',  // green
      'Neutral':          '#888780',  // gray
      'Overbought':       '#BA7517',  // amber
    }
    ```

12. **Skeleton loading states** — every data-dependent component needs a skeleton. Use `bg-secondary` animated pulse blocks matching the component's shape. The chart skeleton should exactly match the 320px chart height.

13. **SEO** — asset pages are publicly accessible and should be server-rendered. Use Next.js `generateMetadata` for each ticker page:
    ```ts
    export async function generateMetadata({ params }: { params: { ticker: string } }) {
      return {
        title: `${params.ticker} — Enhanced DCA Backtest | [Product Name]`,
        description: `See how Enhanced DCA outperformed standard DCA on ${params.ticker} by 18.4% over 5 years.`,
      };
    }
    ```

14. **The signal chart is the hero** — it must feel instant. Fetch OHLC and signal data server-side, pass as props to the Client Component. The chart renders immediately on hydration with no loading state. Only range toggle changes trigger a client-side Supabase refetch.

15. **`/dashboard/[ticker]` overwrites existing file** — do not attempt to merge with the existing `page.tsx`. Replace it entirely with the new implementation.

---

## 16. Out of scope for this build

- Broker integration / auto-execution (UI placeholders only)
- Marketplace page
- Mobile app
- Strategy creator / custom parameter tuning
- API access (Quant tier)
- Conservative / Aggressive / Max preset data (UI built, data returns "coming soon")
- Payment flow (link to Stripe checkout, implement separately)