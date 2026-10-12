import { colors, componentStyles, spacing } from '@/lib/designSystem'
import type { SectorStats } from '@/lib/sector-queries'

const sub = { fontSize: '12px', color: colors.text2, marginTop: spacing.sm } as const

/** The three headline tiles: a strength breakdown bar, a share ring and the 1M return. */
export function SectorStatTiles({ stats }: { stats: SectorStats }) {
  const total = stats.totalAssets
  const strong = stats.assetsInBuyZone
  const mild = stats.assetsMildSignal
  const none = Math.max(total - strong - mild, 0)
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)
  const share = total > 0 ? strong / total : 0

  const R = 26
  const C = 2 * Math.PI * R
  const ret = stats.sectorReturn1M
  const tint = ret === null || ret === 0 ? colors.surface : `color-mix(in srgb, ${ret > 0 ? colors.green : colors.red} 8%, ${colors.surface})`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: spacing.lg }}>
      <div style={componentStyles.statBox}>
        <div style={componentStyles.statLabel}>Total Assets</div>
        <div style={componentStyles.statValue}>{total}</div>
        <div
          role="img"
          aria-label={`${strong} at 4x or more, ${mild} mild, ${none} with no buy signal`}
          style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: colors.border, marginTop: spacing.md }}
        >
          <div style={{ width: `${pct(strong)}%`, background: colors.green }} />
          <div style={{ width: `${pct(mild)}%`, background: colors.teal, opacity: 0.5 }} />
        </div>
        <div style={sub}>{strong} at 4×+ · {mild} mild · {none} none today</div>
      </div>

      <div style={{ ...componentStyles.statBox, display: 'flex', alignItems: 'center', gap: spacing.xl }}>
        <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${strong} of ${total} assets at 4x or more`}>
          <circle cx="32" cy="32" r={R} fill="none" stroke={colors.border} strokeWidth="7" />
          <circle
            cx="32" cy="32" r={R} fill="none" stroke={colors.green} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${C * share} ${C}`} transform="rotate(-90 32 32)"
          />
        </svg>
        <div>
          <div style={componentStyles.statLabel}>In Buy Zone</div>
          <div style={{ ...componentStyles.statValue, color: colors.green }}>
            {strong}<span style={{ fontSize: '14px', color: colors.text2, fontWeight: 400 }}> of {total}</span>
          </div>
          <div style={sub}>weekly multiplier 4× or more today</div>
        </div>
      </div>

      <div style={{ ...componentStyles.statBox, background: tint }}>
        <div style={componentStyles.statLabel}>1M Sector Return</div>
        <div style={{ ...componentStyles.statValue, color: ret === null ? colors.text2 : ret > 0 ? colors.green : colors.red }}>
          {ret === null ? 'n/a' : `${ret > 0 ? '▲ +' : ret < 0 ? '▼ ' : ''}${ret.toFixed(2)}%`}
        </div>
        <div style={sub}>equal-weighted, all {total} assets</div>
      </div>
    </div>
  )
}
