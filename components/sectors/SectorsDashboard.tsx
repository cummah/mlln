'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { SectorDashboardCard } from '@/lib/sector-queries'
import { colors, spacing } from '@/lib/designSystem'

interface SectorsDashboardProps {
  sectors: SectorDashboardCard[]
}

type SortBy = 'name' | 'performance' | 'buySignals' | 'multiplier' | 'assets'
type FilterBy = 'all' | 'withBuys' | 'strong'

export function SectorsDashboard({ sectors }: SectorsDashboardProps) {
  const [sortBy, setSortBy] = useState<SortBy>('performance')
  const [filterBy, setFilterBy] = useState<FilterBy>('all')
  const [compareMode, setCompareMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    let result = [...sectors]

    // Filter
    if (filterBy === 'withBuys') {
      result = result.filter(s => s.stats.assetsInBuyZone > 0)
    } else if (filterBy === 'strong') {
      result = result.filter(s => s.stats.assetsInBuyZone >= 3)
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'performance':
          return (b.stats.sectorReturn1M ?? -1e9) - (a.stats.sectorReturn1M ?? -1e9)
        case 'buySignals':
          return b.stats.assetsInBuyZone - a.stats.assetsInBuyZone
        case 'multiplier':
          return (b.stats.assetsMildSignal ?? 0) - (a.stats.assetsMildSignal ?? 0)
        case 'assets':
          return b.stats.totalAssets - a.stats.totalAssets
        default:
          return 0
      }
    })

    return result
  }, [sectors, sortBy, filterBy])

  const stats = useMemo(() => {
    const withBuys = sectors.filter(s => s.stats.assetsInBuyZone > 0).length
    const totalSignals = sectors.reduce((sum, s) => sum + s.stats.assetsInBuyZone, 0)
    const avgReturn = sectors.length > 0
      ? sectors.reduce((sum, s) => sum + (s.stats.sectorReturn1M ?? 0), 0) / sectors.length
      : 0

    return { withBuys, totalSignals, avgReturn }
  }, [sectors])

  const handleToggleSelect = (slug: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(slug)) {
      newSelected.delete(slug)
    } else if (newSelected.size < 3) {
      newSelected.add(slug)
    }
    setSelected(newSelected)
  }

  const selectedCards = filtered.filter(s => selected.has(s.slug))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing['5xl'] }}>
      {/* Dashboard Stats Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: spacing.lg,
        padding: spacing['2xl'],
        background: colors.surface,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
      }}>
        <div>
          <div style={{ fontSize: '12px', color: colors.text3, textTransform: 'uppercase', fontWeight: 600, marginBottom: spacing.sm }}>
            Sectors with buys
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: colors.teal }}>
            {stats.withBuys}
          </div>
          <div style={{ fontSize: '12px', color: colors.text3, marginTop: '4px' }}>
            of {sectors.length} total
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: colors.text3, textTransform: 'uppercase', fontWeight: 600, marginBottom: spacing.sm }}>
            Total buy signals
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: colors.teal }}>
            {stats.totalSignals}
          </div>
          <div style={{ fontSize: '12px', color: colors.text3, marginTop: '4px' }}>
            assets at 4x+ today
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: colors.text3, textTransform: 'uppercase', fontWeight: 600, marginBottom: spacing.sm }}>
            Avg sector return (1M)
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: stats.avgReturn > 0 ? colors.green : colors.red }}>
            {stats.avgReturn > 0 ? '+' : ''}{stats.avgReturn.toFixed(2)}%
          </div>
          <div style={{ fontSize: '12px', color: colors.text3, marginTop: '4px' }}>
            equal weighted
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: spacing.lg, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '12px', color: colors.text3, fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Sort by
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="performance">1M Performance</option>
              <option value="buySignals">Buy Signals</option>
              <option value="multiplier">Avg Multiplier</option>
              <option value="assets">Total Assets</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: colors.text3, fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Filter
            </label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as FilterBy)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              <option value="all">All sectors</option>
              <option value="withBuys">Has buy signals</option>
              <option value="strong">Strong buy zone (3+)</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => setCompareMode(!compareMode)}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: `1px solid ${compareMode ? colors.teal : colors.border}`,
            background: compareMode ? colors.teal : colors.surface,
            color: compareMode ? colors.bg : colors.text,
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {compareMode ? `Compare (${selected.size}/3)` : 'Compare sectors'}
        </button>
      </div>

      {/* Sector Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: spacing.lg }}>
        {filtered.map((sector) => {
          const isSelected = selected.has(sector.slug)
          const returnColor = sector.stats.sectorReturn1M === null
            ? colors.text3
            : sector.stats.sectorReturn1M > 0
              ? colors.green
              : colors.red

          return (
            <div
              key={sector.slug}
              onClick={() => compareMode && handleToggleSelect(sector.slug)}
              style={{
                position: 'relative',
                padding: spacing.lg,
                borderRadius: '12px',
                border: `2px solid ${isSelected ? colors.teal : colors.border}`,
                background: isSelected ? 'rgba(0, 196, 167, 0.04)' : colors.surface,
                cursor: compareMode ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                if (!compareMode) {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.borderColor = colors.teal
                  el.style.background = colors.surface2
                }
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                if (!compareMode) {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.borderColor = colors.border
                  el.style.background = colors.surface
                } else {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.borderColor = isSelected ? colors.teal : colors.border
                  el.style.background = isSelected ? 'rgba(0, 196, 167, 0.04)' : colors.surface
                }
              }}
            >
              {compareMode && (
                <div style={{
                  position: 'absolute',
                  top: spacing.md,
                  right: spacing.md,
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: `2px solid ${isSelected ? colors.teal : colors.border}`,
                  background: isSelected ? colors.teal : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.bg,
                  fontSize: '12px',
                  fontWeight: 700,
                }}>
                  {isSelected ? '✓' : ''}
                </div>
              )}

              <Link href={`/sectors/${sector.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ marginBottom: spacing.lg }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: colors.text, margin: 0, marginBottom: '4px' }}>
                    {sector.name}
                  </h3>
                  <p style={{ fontSize: '12px', color: colors.text3, margin: 0 }}>
                    {sector.stats.totalAssets} assets
                  </p>
                </div>
              </Link>

              {/* Key metrics grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md, marginBottom: spacing.lg }}>
                <div>
                  <div style={{ fontSize: '11px', color: colors.text3, textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
                    Buy zone
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: colors.teal }}>
                    {sector.stats.assetsInBuyZone}
                  </div>
                  {sector.stats.assetsMildSignal > 0 && (
                    <div style={{ fontSize: '11px', color: colors.text3, marginTop: '4px' }}>
                      +{sector.stats.assetsMildSignal} mild
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: colors.text3, textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
                    Mild signals
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: colors.text }}>
                    {sector.stats.assetsMildSignal}
                  </div>
                </div>
              </div>

              {/* Performance */}
              <div style={{ paddingTop: spacing.md, borderTop: `1px solid ${colors.border}` }}>
                <div style={{ fontSize: '11px', color: colors.text3, textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
                  1M Performance
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: returnColor }}>
                  {sector.stats.sectorReturn1M !== null
                    ? `${sector.stats.sectorReturn1M > 0 ? '+' : ''}${sector.stats.sectorReturn1M.toFixed(2)}%`
                    : '—'
                  }
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Comparison Panel */}
      {compareMode && selectedCards.length > 0 && (
        <div style={{
          padding: spacing['2xl'],
          background: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.teal}`,
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing.lg }}>
            Comparing {selectedCards.length} sector{selectedCards.length !== 1 ? 's' : ''}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: spacing.lg }}>
            {selectedCards.map((sector) => (
              <div key={sector.slug} style={{
                padding: spacing.lg,
                background: colors.bg,
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: colors.text, margin: 0, marginBottom: spacing.md }}>
                  {sector.name}
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: colors.text3 }}>Total assets:</span>
                    <strong style={{ color: colors.text }}>{sector.stats.totalAssets}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: colors.text3 }}>Buy zone:</span>
                    <strong style={{ color: colors.teal }}>{sector.stats.assetsInBuyZone}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: colors.text3 }}>Mild signals:</span>
                    <strong style={{ color: colors.text }}>{sector.stats.assetsMildSignal}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: colors.text3 }}>1M return:</span>
                    <strong style={{
                      color: sector.stats.sectorReturn1M === null
                        ? colors.text3
                        : sector.stats.sectorReturn1M > 0
                          ? colors.green
                          : colors.red
                    }}>
                      {sector.stats.sectorReturn1M !== null
                        ? `${sector.stats.sectorReturn1M > 0 ? '+' : ''}${sector.stats.sectorReturn1M.toFixed(2)}%`
                        : '—'
                      }
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: colors.text3 }}>Avg RSI:</span>
                    <strong style={{ color: colors.text }}>
                      {sector.stats.avgRsi !== null ? sector.stats.avgRsi : '—'}
                    </strong>
                  </div>

                  <Link
                    href={`/sectors/${sector.slug}`}
                    style={{
                      marginTop: spacing.md,
                      padding: '8px 12px',
                      textAlign: 'center',
                      borderRadius: '6px',
                      border: `1px solid ${colors.teal}`,
                      color: colors.teal,
                      textDecoration: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                      const el = e.currentTarget as HTMLAnchorElement
                      el.style.background = colors.teal
                      el.style.color = colors.bg
                    }}
                    onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                      const el = e.currentTarget as HTMLAnchorElement
                      el.style.background = 'transparent'
                      el.style.color = colors.teal
                    }}
                  >
                    View full analysis →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
