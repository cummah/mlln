# Design System Reference

This document outlines the design system used across mlln.ai. All styling patterns and values are defined in `lib/designSystem.ts` to ensure consistency across pages.

## Quick Start

```typescript
import { colors, spacing, styles, typography } from '@/lib/designSystem';

// Use in components
<div style={styles.card}>
  <h2 style={styles.sectionTitle}>Your Title</h2>
  <p style={{ fontSize: typography.fontSize.base, color: colors.text2 }}>
    Your content
  </p>
</div>
```

## Color Palette

### Primary Colors
- **Teal** (`colors.teal`) - #00c4a7 - Primary accent for active states
- **Green** (`colors.green`) - #28d97e - Success, positive metrics
- **Red** (`colors.red`) - #f05c6e - Errors, negative metrics
- **Amber** (`colors.amber`) - #f0a128 - Warnings

### Backgrounds
- **bg** - #060f1a - Main page background
- **surface** - #0c1d2e - Card/box background
- **surface2** - #112236 - Elevated surface (hover states)

### Text
- **text** - Primary text (heading/labels)
- **text2** - Secondary text (descriptions)
- **text3** - Tertiary text (faint labels)

## Spacing Scale

Use `spacing` object for consistent margins/padding:

```
xs:   2px
sm:   4px
md:   6px
base: 8px
lg:   12px
xl:   14px
2xl:  16px
3xl:  18px
4xl:  20px
5xl:  28px
6xl:  32px
```

### Common Padding Values

- **Card Padding** - `padding.card` (18px 20px)
- **Section Padding** - `padding.section` (16px 20px)
- **Compact** - `padding.compact` (14px 18px)

## Typography

### Font Sizes

```
xs:    10px   // Small labels
sm:    11px   // Section labels
base:  12px   // Body text
md:    12.5px // Buttons
lg:    13px   // Normal text
xl:    13.5px // FAQ questions
2xl:   14px   // Stat values
3xl:   16px   // Section titles
4xl:   18px   // Card titles
5xl:   20px   // Large stats
6xl:   26px   // Alpha value
7xl:   28px   // Large title
```

### Font Weights

- **normal** - 400
- **medium** - 500
- **semibold** - 600
- **bold** - 700
- **extrabold** - 800

### Font Families

- **sans** - DM Sans, sans-serif (default)
- **mono** - DM Mono, monospace (for numbers)

### Letter Spacing

- **tight** - -0.5px (tight tracking)
- **wide** - 0.07em (labels)
- **wider** - 0.08em (section headers)
- **widest** - 0.09em (small labels)

## Pre-built Style Objects

### Section Labels
```typescript
style={styles.sectionLabel}
// Creates: 11px, uppercase, gray text with letter spacing
```

### Section Titles
```typescript
style={styles.sectionTitle}
// Creates: 16px bold title with bottom margin
```

### Card Container
```typescript
style={styles.card}
// Creates: surface background, border, padding, rounded corners
```

### Card Title (inside card)
```typescript
style={styles.cardTitle}
// Creates: styled title with bottom border separator
```

## Common Patterns

### Icon Box
```typescript
<div style={styles.iconBox(colors.greenDim, '28px')}>
  {/* SVG icon */}
</div>
```

### Pill/Badge
```typescript
<div style={styles.pill(colors.tealDim, colors.teal)}>
  Label text
</div>
```

### Flex Row
```typescript
<div style={styles.flexRow(gaps.lg)}>
  {/* Items */}
</div>
```

### Flex Column
```typescript
<div style={styles.flexCol(gaps.xl)}>
  {/* Items */}
</div>
```

### Responsive Grid
```typescript
<div style={styles.gridAuto('300px', gaps.xl)}>
  {/* Grid items */}
</div>
```

### Primary Button
```typescript
<button style={styles.buttonPrimary}>
  Sign up
</button>
```

### Secondary Button
```typescript
<button style={styles.buttonTertiary}>
  Share
</button>
```

## Component Specific Styles

### Stat Box (4-column grid)
```typescript
<div style={componentStyles.statBox}>
  <div style={componentStyles.statLabel}>Total Invested</div>
  <div style={componentStyles.statValue}>$26,000</div>
</div>
```

### Slider Input
```typescript
<input
  type="range"
  min="10"
  max="1000"
  style={componentStyles.slider}
/>
```

### Alpha Banner
```typescript
<div style={componentStyles.alphaBanner}>
  {/* Banner content */}
</div>
```

## Border Radius

- **sm** - 6px
- **base** - 8px (most common)
- **md** - 10px
- **lg** - 12px
- **xl** - 14px (cards)
- **full** - 50% (circles)

## Example: Creating a New Page

```typescript
import { colors, spacing, styles, typography, gaps } from '@/lib/designSystem';

export function MyPage() {
  return (
    <div style={{ padding: spacing['5xl'], background: colors.bg }}>
      {/* Section Label */}
      <div style={styles.sectionLabel}>
        Section Name
      </div>

      {/* Section Title */}
      <h1 style={styles.sectionTitle}>
        Page Title
      </h1>

      {/* Card Container */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Card Title</h2>
        <p style={{ fontSize: typography.fontSize.base, color: colors.text2 }}>
          Card content
        </p>
      </div>

      {/* Button Row */}
      <div style={styles.flexRow(gaps.lg)}>
        <button style={styles.buttonPrimary}>Primary Action</button>
        <button style={styles.buttonTertiary}>Secondary Action</button>
      </div>
    </div>
  );
}
```

## Colors in Light/Dark Mode

All colors use CSS variables defined in `styles/globals.css`, so the design system automatically adapts if dark mode is toggled.

## When to Add to Design System

If you find yourself repeating the same style combination in multiple places, add it as a new entry in:
- `styles` - For common component patterns
- `componentStyles` - For component-specific patterns
- `typography` - For new font size/weight combos

This keeps the codebase DRY and makes future updates easier.
