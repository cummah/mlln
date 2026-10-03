/**
 * Design System - Reusable styling patterns and constants
 * Used across all pages for consistency
 */

// Colors (CSS Variables)
export const colors = {
  // Backgrounds
  bg: 'var(--bg)',           // #060f1a
  surface: 'var(--surface)',   // #0c1d2e
  surface2: 'var(--surface2)',  // #112236

  // Text
  text: 'var(--text)',         // Primary text
  text2: 'var(--text-2)',      // Secondary text
  text3: 'var(--text-3)',      // Tertiary text (faint)

  // Accents
  teal: 'var(--teal)',         // #00c4a7 - Primary accent
  tealDim: 'var(--teal-dim)',   // Dimmed teal background
  tealMid: 'var(--teal-mid)',   // Medium teal for borders
  green: 'var(--green)',       // #28d97e - Success
  greenDim: 'var(--green-dim)',
  red: 'var(--red)',           // #f05c6e - Error
  redDim: 'var(--red-dim)',
  amber: 'var(--amber)',       // #f0a128 - Warning
  amber10: 'rgba(240,161,40,0.1)',

  // Borders
  border: 'var(--border)',
};

// Spacing Scale (in pixels)
export const spacing = {
  xs: '2px',
  sm: '4px',
  md: '6px',
  base: '8px',
  lg: '12px',
  xl: '14px',
  '2xl': '16px',
  '3xl': '18px',
  '4xl': '20px',
  '5xl': '28px',
  '6xl': '32px',
};

// Gap values (for flex/grid)
export const gaps = {
  sm: '4px',
  md: '6px',
  base: '8px',
  lg: '10px',
  xl: '12px',
  '2xl': '14px',
  '3xl': '16px',
  '4xl': '20px',
};

// Padding values
export const padding = {
  card: '18px 20px',        // Main card padding
  section: '16px 20px',     // Section padding
  compact: '14px 18px',     // Compact spacing
  tight: '12px 16px',       // Tight spacing
  loose: '20px 24px',       // Loose spacing
};

// Border Radius
export const borderRadius = {
  sm: '6px',
  base: '8px',
  md: '10px',
  lg: '12px',
  xl: '14px',
  full: '50%',
};

// Typography
export const typography = {
  // Font sizes
  fontSize: {
    xs: '10px',       // Labels, small text
    sm: '11px',       // Section labels
    smMd: '11.5px',   // Description text
    base: '12px',     // Body text
    md: '12.5px',     // Button text
    lg: '13px',       // Normal text
    xl: '13.5px',     // FAQ questions
    '2xl': '14px',    // Stat values
    '3xl': '16px',    // Section titles
    '4xl': '18px',    // Card titles
    '5xl': '20px',    // Stat values (large)
    '6xl': '26px',    // Alpha value
    '7xl': '28px',    // Large title
  },

  // Font weights
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  // Letter spacing
  tracking: {
    tight: '-0.5px',
    normal: '0px',
    wide: '0.07em',    // Uppercase labels
    wider: '0.08em',
    widest: '0.09em',  // Section labels
  },

  // Font families
  family: {
    sans: 'DM Sans, sans-serif',
    mono: 'DM Mono, monospace',
  },
};

// Common inline style combinations
export const styles = {
  // Section label (uppercase, small, muted)
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.09em',
    color: colors.text3,
    marginBottom: '2px',
  },

  // Section title (large, bold)
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 700,
    marginBottom: '12px',
    color: colors.text,
  },

  // Card container (surface with border and padding)
  card: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.xl,
    padding: padding.card,
  },

  // Card title (inside card)
  cardTitle: {
    fontSize: '13px',
    fontWeight: 700,
    color: colors.text,
    marginBottom: '14px',
    paddingBottom: '14px',
    borderBottom: `1px solid ${colors.border}`,
  },

  // Icon box (colored background)
  iconBox: (bgColor: string = colors.tealDim, size: string = '28px') => ({
    width: size,
    height: size,
    borderRadius: borderRadius.base,
    background: bgColor,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  }),

  // Pill/badge styling
  pill: (bgColor: string = colors.tealDim, textColor: string = colors.teal) => ({
    padding: `${spacing.md} ${spacing.xl}`,
    borderRadius: borderRadius.full,
    background: bgColor,
    color: textColor,
    fontSize: typography.fontSize.sm,
    fontWeight: 600,
    border: `1px solid ${colors.tealMid}`,
  }),

  // Flex row with gap
  flexRow: (gap: string = gaps.lg) => ({
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: gap,
  }),

  // Flex column with gap
  flexCol: (gap: string = gaps.lg) => ({
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: gap,
  }),

  // Grid layout (auto-fit responsive)
  gridAuto: (minWidth: string = '300px', gap: string = gaps.xl) => ({
    display: 'grid' as const,
    gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))`,
    gap: gap,
  }),

  // Button styling (tertiary - outline)
  buttonTertiary: {
    background: colors.surface2,
    border: `1px solid ${colors.border}`,
    color: colors.text2,
    borderRadius: borderRadius.base,
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: '12.5px',
    fontWeight: 500,
    cursor: 'pointer' as const,
    fontFamily: 'DM Sans, sans-serif',
    transition: 'all 0.15s',
  },

  // Button styling (primary - teal)
  buttonPrimary: {
    background: colors.teal,
    color: '#040e18',
    border: `1px solid ${colors.teal}`,
    fontSize: '12.5px',
    fontWeight: 600,
    borderRadius: borderRadius.base,
    padding: `${spacing.md} ${spacing.xl}`,
    cursor: 'pointer' as const,
    fontFamily: 'DM Sans, sans-serif',
    transition: 'opacity 0.15s',
  },
};

// Common style patterns for specific components
export const componentStyles = {
  // Slider input
  slider: {
    flex: 1,
    height: '6px',
    borderRadius: '3px',
    background: colors.bg,
    outline: 'none',
    WebkitAppearance: 'none',
    cursor: 'pointer' as const,
    accentColor: colors.teal,
  } as any,

  // Stat box (4-column grid item)
  statBox: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: borderRadius.lg,
    padding: spacing['2xl'],
  },

  // Stat label
  statLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.weight.semibold,
    color: colors.text3,
    textTransform: 'uppercase' as const,
    letterSpacing: typography.tracking.wide,
    marginBottom: spacing.md,
  },

  // Stat value
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.weight.bold,
    fontFamily: typography.family.mono,
    color: colors.text,
  },

  // Alpha banner
  alphaBanner: {
    background: 'linear-gradient(135deg, rgba(0,196,167,0.08) 0%, rgba(0,196,167,0.03) 100%)',
    border: '1px solid rgba(0,196,167,0.2)',
    borderRadius: borderRadius.xl,
    padding: padding.section,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    flexWrap: 'wrap' as const,
    gap: gaps.lg,
  },
};

export default {
  colors,
  spacing,
  gaps,
  padding,
  borderRadius,
  typography,
  styles,
  componentStyles,
};
