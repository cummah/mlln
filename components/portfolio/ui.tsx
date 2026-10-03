'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * Shared primitives for the portfolio builder.
 *
 * The portfolio page previously inlined every style, which drifted into ~7 radii,
 * ~7 card paddings and ~7 label sizes across five components. Everything visual
 * lives here now so the panels stay on one scale, and so chart colours resolve
 * from the design tokens in styles/globals.css instead of hardcoded Tailwind hex
 * (which broke [data-theme="light"]).
 */

// Type floor is 11px: anything a user reads as a value or a label. Chart axis
// ticks are the one exception at 10px — Recharts needs the headroom.
export const T = {
  label: '11px',
  body: '12px',
  value: '13px',
  heading: '14px',
  kpi: '26px',
  axis: '10px',
} as const;

export const RADIUS = { sm: '6px', md: '10px', pill: '999px' } as const;
export const PAD = { tight: '10px', panel: '14px' } as const;

export const MONO = 'DM Mono, monospace';

/**
 * Categorical palette. Derived from --teal/--green/--red in globals.css and
 * checked to hold contrast on both --surface (#0c1d2e) and the light theme's
 * surface. Order is chosen so the first five are maximally distinguishable,
 * since most portfolios sit at five assets or fewer.
 */
export const SERIES = [
  '#00c4a7', // teal (brand)
  '#f0a35c', // amber
  '#7aa2f7', // blue
  '#c98bdb', // violet
  '#28d97e', // green (brand)
  '#f05c6e', // red (brand)
  '#5eead4', // teal-light
  '#f7d774', // yellow
  '#8b9dc3', // slate
  '#e8825c', // orange
] as const;

/** Two-series comparison used everywhere Std DCA is put next to Alpha. */
export const STD_COLOR = '#54798a';
export const ALPHA_COLOR = 'var(--text)';
export const ALPHA_HEX = '#3b6178';

/**
 * Colour by ticker, not by position in a sorted list. The sector pie, risk bars
 * and asset table each sorted differently, so the same colour used to mean a
 * different asset in each panel.
 */
export function tickerColors(tickers: string[]): Record<string, string> {
  const sorted = [...tickers].sort();
  return Object.fromEntries(sorted.map((t, i) => [t, SERIES[i % SERIES.length]]));
}

/** Analytics API returns annualised ratios (0.24), not percents. */
export function ratioAsPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

export function signedRatioAsPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(decimals)}%`;
}

export function Panel({
  title,
  hint,
  right,
  children,
  className,
  style,
  bodyStyle,
}: {
  title?: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}) {
  return (
    <section
      className={className}
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: RADIUS.md,
        padding: PAD.panel,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        boxShadow: 'var(--inset-top), var(--shadow-md)',
        ...style,
      }}
    >
      {title && (
        <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: T.label, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-2)' }}>
            {title}
            {hint && (
              <InfoDot text={hint} />
            )}
          </h3>
          {right}
        </header>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', ...bodyStyle }}>{children}</div>
    </section>
  );
}

/**
 * Keyboard- and touch-reachable replacement for the bare `title` attributes the
 * charts used to rely on. Focusable so the explanation is not mouse-only.
 */
export function InfoDot({ text }: { text: string }) {
  return (
    <button
      type="button"
      aria-label={text}
      title={text}
      style={{
        marginLeft: '5px',
        width: '13px',
        height: '13px',
        borderRadius: RADIUS.pill,
        border: '1px solid var(--border-medium, var(--border))',
        background: 'transparent',
        color: 'var(--text-3)',
        fontSize: '9px',
        lineHeight: 1,
        cursor: 'help',
        padding: 0,
        verticalAlign: 'middle',
      }}
    >
      ?
    </button>
  );
}

/** Legend swatch row. Charts previously shipped two unlabelled colour series. */
export function Legend({
  items,
  style,
}: {
  items: Array<{ label: string; color: string }>;
  style?: CSSProperties;
}) {
  return (
    <ul
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 12px',
        margin: '8px 0 0',
        padding: 0,
        listStyle: 'none',
        fontSize: T.label,
        color: 'var(--text-2)',
        ...style,
      }}
    >
      {items.map((item) => (
        <li key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
          <span
            aria-hidden
            style={{ width: '9px', height: '9px', borderRadius: '2px', background: item.color, flexShrink: 0 }}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Shared Recharts tooltip shell so all four charts read the same. */
export function TooltipShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--surface2-elevated)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: RADIUS.sm,
        padding: '7px 9px',
        fontSize: T.label,
        color: 'var(--text)',
        boxShadow: 'var(--inset-top), var(--shadow-md)',
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

export function Skeleton({ height, radius = RADIUS.sm }: { height: number | string; radius?: string }) {
  return (
    <div
      aria-hidden
      style={{
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, var(--surface2) 25%, var(--border-medium, var(--border)) 50%, var(--surface2) 75%)',
        backgroundSize: '200% 100%',
        animation: 'mllnShimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}
