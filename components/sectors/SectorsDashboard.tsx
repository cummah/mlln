'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { SectorDashboardCard } from '@/lib/sector-queries'
import { colors, spacing } from '@/lib/designSystem'

function PerformanceBar({ value }: { value: number | null }) {
  if (value === null) return <div style={{ height: '4px', background: colors.border, borderRadius: '2px' }} />
  const clamped = Math.max(-30, Math.min(30, value))
  const isPositive = clamped >= 0
  const width = Math.abs(clamped) / 30 * 100
  return (
    <div style={{ height: '4px', background: colors.border, borderRadius: '2px', overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          width: `${width}%`,
          background: isPositive ? colors.green : colors.red,
          transition: 'width 0.3s'
        }}
      />
    </div>
  )
}

function BuyZoneVisual({ count, total }: { count: number; total: number }) {
  const dots = Array.from({ length: Math.min(total, 8) }, (_, i) => i < count)
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {dots.map((filled, i) => (
        <div
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: filled ? colors.teal : colors.border,
            transition: 'background 0.2s'
          }}
        />
      ))}
    </div>
  )
}

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      {/* Compact Stats Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: spacing.md,
        padding: `${spacing.lg} ${spacing['2xl']}`,
        background: colors.surface,
        borderRadius: '10px',
        border: `1px solid ${colors.border}`,
      }}>
        <div>
          <div style={{ fontSize: '10px', color: colors.text3, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '6px' }}>
            With buys
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: colors.teal }}>
              {stats.withBuys}
            </div>
            <div style={{ fontSize: '11px', color: colors.text3 }}>
              /{sectors.length}
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: colors.text3, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '6px' }}>
            Buy signals
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: colors.teal }}>
              {stats.totalSignals}
            </div>
            <div style={{ fontSize: '11px', color: colors.text3 }}>
              4x+
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: colors.text3, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '6px' }}>
            Avg return (1M)
          </div>
          <div style={{
            fontSize: '22px',
            fontWeight: 700,
            color: stats.avgReturn > 0 ? colors.green : stats.avgReturn < 0 ? colors.red : colors.text3,
            marginBottom: '4px'
          }}>
            {stats.avgReturn > 0 ? '+' : ''}{stats.avgReturn.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: spacing.md, alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: spacing.md }}>
          <div>
            <label style={{ fontSize: '10px', color: colors.text3, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Sort
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <option value="performance">1M Perf</option>
              <option value="buySignals">Buy signals</option>
              <option value="multiplier">Mild signals</option>
              <option value="assets">Total assets</option>
              <option value="name">Name</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '10px', color: colors.text3, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
              Filter
            </label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as FilterBy)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <option value="all">All</option>
              <option value="withBuys">Has buys</option>
              <option value="strong">Strong (3+)</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => setCompareMode(!compareMode)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: `1px solid ${compareMode ? colors.teal : colors.border}`,
            background: compareMode ? colors.teal : colors.surface,
            color: compareMode ? colors.bg : colors.text,
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          {compareMode ? `Compare (${selected.size}/3)` : 'Compare'}
        </button>
      </div>

      {/* Sector Grid - Compact cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: spacing.md, maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}>
        {filtered.map((sector) => {
          const isSelected = selected.has(sector.slug)
          const returnColor = sector.stats.sectorReturn1M === null
            ? colors.text3
            : sector.stats.sectorReturn1M > 0
              ? colors.green
              : colors.red
          const bgOpacity = sector.stats.sectorReturn1M === null ? 0 : Math.abs(sector.stats.sectorReturn1M) / 30

          return (
            <div
              key={sector.slug}
              onClick={() => compareMode && handleToggleSelect(sector.slug)}
              style={{
                position: 'relative',
                padding: spacing.md,
                borderRadius: '8px',
                border: `1.5px solid ${isSelected ? colors.teal : colors.border}`,
                background: isSelected
                  ? `rgba(0, 196, 167, 0.1)`
                  : sector.stats.sectorReturn1M === null
                    ? colors.surface
                    : `rgba(${sector.stats.sectorReturn1M > 0 ? '40, 217, 126' : '240, 92, 110'}, ${bgOpacity * 0.15})`,
                cursor: compareMode ? 'pointer' : 'default',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
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
                  el.style.background = sector.stats.sectorReturn1M === null
                    ? colors.surface
                    : `rgba(${sector.stats.sectorReturn1M > 0 ? '40, 217, 126' : '240, 92, 110'}, ${bgOpacity * 0.15})`
                } else {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.borderColor = isSelected ? colors.teal : colors.border
                }
              }}
            >
              {compareMode && (
                <div style={{
                  position: 'absolute',
                  top: spacing.md,
                  right: spacing.md,
                  width: '16px',
                  height: '16px',
                  borderRadius: '3px',
                  border: `1.5px solid ${isSelected ? colors.teal : colors.border}`,
                  background: isSelected ? colors.teal : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: colors.bg,
                  fontSize: '10px',
                  fontWeight: 700,
                }}>
                  {isSelected ? '✓' : ''}
                </div>
              )}

              <Link href={`/sectors/${sector.slug}`} style={{ textDecoration: 'none', color: 'inherit', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: colors.text, margin: 0, marginBottom: '2px', lineHeight: 1.2 }}>
                  {sector.name}
                </h3>
                <p style={{ fontSize: '10px', color: colors.text3, margin: 0, marginBottom: spacing.md }}>
                  {sector.stats.totalAssets} assets
                </p>

                {/* Buy zone indicator - dots */}
                <div style={{ marginBottom: spacing.md }}>
                  <div style={{ fontSize: '9px', color: colors.text3, textTransform: 'uppercase', fontWeight: 700, marginBottom: '3px', letterSpacing: '0.03em' }}>
                    Buy zone
                  </div>
                  <BuyZoneVisual count={sector.stats.assetsInBuyZone} total={sector.stats.totalAssets} />
                  <div style={{ fontSize: '11px', fontWeight: 700, color: colors.teal, marginTop: '3px' }}>
                    {sector.stats.assetsInBuyZone}
                  </div>
                </div>

                {/* Performance bar */}
                <div style={{ marginBottom: spacing.md }}>
                  <div style={{ fontSize: '9px', color: colors.text3, textTransform: 'uppercase', fontWeight: 700, marginBottom: '3px', letterSpacing: '0.03em' }}>
                    1M Return
                  </div>
                  <PerformanceBar value={sector.stats.sectorReturn1M} />
                  <div style={{ fontSize: '11px', fontWeight: 700, color: returnColor, marginTop: '3px' }}>
                    {sector.stats.sectorReturn1M !== null
                      ? `${sector.stats.sectorReturn1M > 0 ? '+' : ''}${sector.stats.sectorReturn1M.toFixed(1)}%`
                      : '—'
                    }
                  </div>
                </div>

                {/* Mild signals as small badge */}
                {sector.stats.assetsMildSignal > 0 && (
                  <div style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    background: colors.amber,
                    color: colors.bg,
                    borderRadius: '4px',
                    fontWeight: 600,
                    textAlign: 'center'
                  }}>
                    +{sector.stats.assetsMildSignal} mild
                  </div>
                )}
              </Link>
            </div>
          )
        })}
      </div>

      {/* Comparison Panel */}
      {compareMode && selectedCards.length > 0 && (
        <div style={{
          padding: `${spacing.lg} ${spacing['2xl']}`,
          background: colors.surface,
          borderRadius: '10px',
          border: `1px solid ${colors.teal}`,
          marginTop: spacing.lg
        }}>
          <h3 style={{ fontSize: '12px', fontWeight: 700, color: colors.teal, margin: 0, marginBottom: spacing.lg, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Comparing {selectedCards.length} sector{selectedCards.length !== 1 ? 's' : ''}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${selectedCards.length}, 1fr)`, gap: spacing.lg }}>
            {selectedCards.map((sector) => (
              <Link key={sector.slug} href={`/sectors/${sector.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  padding: spacing.lg,
                  background: colors.bg,
                  borderRadius: '8px',
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: colors.text, margin: 0, marginBottom: spacing.md }}>
                    {sector.name}
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: colors.text3 }}>Assets</span>
                      <strong style={{ color: colors.text }}>{sector.stats.totalAssets}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: colors.text3 }}>Buy zone</span>
                      <strong style={{ color: colors.teal }}>{sector.stats.assetsInBuyZone}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: colors.text3 }}>Mild</span>
                      <strong style={{ color: colors.amber }}>{sector.stats.assetsMildSignal}</strong>
                    </div>
                    <div style={{ marginTop: '2px', paddingTop: '6px', borderTop: `1px solid ${colors.border}` }}>
                      <div style={{ fontSize: '11px', color: colors.text3, marginBottom: '2px' }}>1M Return</div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: sector.stats.sectorReturn1M === null
                          ? colors.text3
                          : sector.stats.sectorReturn1M > 0
                            ? colors.green
                            : colors.red
                      }}>
                        {sector.stats.sectorReturn1M !== null
                          ? `${sector.stats.sectorReturn1M > 0 ? '+' : ''}${sector.stats.sectorReturn1M.toFixed(1)}%`
                          : '—'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
