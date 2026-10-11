'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface Asset {
  ticker: string
  name: string
  currentPrice: number | null
  signalMult: number | null
  signalStrength: string
  dcaReturn: number | null
  dcaSuitabilityScore: number | null
}

interface SectorAssetsTableProps {
  assets: Asset[]
}

type SortKey = 'ticker' | 'name' | 'dcaReturn' | 'dcaSuitabilityScore'
type SortDirection = 'asc' | 'desc'

export function SectorAssetsTable({ assets }: SectorAssetsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('ticker')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const sortedAssets = useMemo(() => {
    let sorted = [...assets]

    sorted.sort((a, b) => {
      let aVal = a[sortKey]
      let bVal = b[sortKey]

      // Assets with no value for this column always sort last, whichever way the column is sorted
      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1

      if (typeof aVal === 'string') {
        aVal = (aVal as string).toLowerCase()
        bVal = (bVal as string).toLowerCase()
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [assets, sortKey, sortDirection])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'buy':
        return 'bg-green-500'
      case 'watch':
        return 'bg-amber-500'
      default:
        return 'bg-neutral-500'
    }
  }

  const SortIcon = ({ isActive, direction }: { isActive: boolean; direction: SortDirection }) => {
    if (!isActive) return <span className="text-transparent">↕</span>
    return direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
  }

  const SortHeader = ({
    label,
    column,
    align = 'left',
  }: {
    label: string
    column: SortKey
    align?: 'left' | 'right' | 'center'
  }) => (
    <th
      className={`py-3 px-2 font-medium text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors text-${align}`}
      onClick={() => toggleSort(column)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        {label}
        <SortIcon isActive={sortKey === column} direction={sortDirection} />
      </div>
    </th>
  )

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <SortHeader label="Ticker" column="ticker" />
              <SortHeader label="Name" column="name" />
              <th className="py-3 px-2 font-medium text-[var(--text-secondary)] text-center">
                Buy Signal
              </th>
              <SortHeader label="1Y DCA Return" column="dcaReturn" align="right" />
              <SortHeader label="DCA Suitability" column="dcaSuitabilityScore" align="right" />
            </tr>
          </thead>
          <tbody>
            {sortedAssets.map((asset) => (
              <tr
                key={asset.ticker}
                className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <td className="py-3 px-2">
                  <Link
                    href={`/asset/${asset.ticker.toLowerCase()}`}
                    className="font-medium text-[var(--accent)] hover:underline transition-colors"
                  >
                    {asset.ticker}
                  </Link>
                </td>
                <td className="py-3 px-2">
                  <Link
                    href={`/asset/${asset.ticker.toLowerCase()}`}
                    className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                  >
                    {asset.name}
                  </Link>
                </td>
                <td className="text-center py-3 px-2">
                  {asset.signalMult !== null && asset.signalMult > 1.0 ? (
                    <span className="text-green-500 font-medium">
                      buy {asset.signalMult.toFixed(1)}x
                    </span>
                  ) : (
                    <span className="text-[var(--text-secondary)]">-</span>
                  )}
                </td>
                <td
                  className={`text-right py-3 px-2 font-medium ${
                    asset.dcaReturn === null ? 'text-[var(--text-secondary)]' : asset.dcaReturn > 0 ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {asset.dcaReturn === null ? 'n/a' : `${asset.dcaReturn > 0 ? '+' : ''}${asset.dcaReturn.toFixed(2)}%`}
                </td>
                <td className="text-right py-3 px-2 font-medium text-[var(--text-primary)]">
                  {asset.dcaSuitabilityScore === null ? 'n/a' : asset.dcaSuitabilityScore.toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
