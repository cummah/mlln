'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { dateCompact } from '@/lib/signals/format'
import { SignalCell } from './SignalCell'
import { SortTh, sortBy, useSort } from './sorting'

interface Asset {
  ticker: string
  name: string
  currentPrice: number | null
  signalMult: number | null
  signalDate: string | null
  signalStrength: string
  dcaReturn: number | null
  dcaSuitabilityScore: number | null
}

interface SectorAssetsTableProps {
  assets: Asset[]
}

type SortKey = 'ticker' | 'name' | 'signal' | 'signalDate' | 'dcaReturn' | 'dcaSuitabilityScore'

export function SectorAssetsTable({ assets }: SectorAssetsTableProps) {
  const sort = useSort<SortKey>('ticker', 'asc', ['ticker', 'name'])
  const sortedAssets = useMemo(
    () => sortBy(assets, sort.key, sort.dir, (a, k) =>
      k === 'ticker' ? a.ticker : k === 'name' ? a.name : k === 'signal' ? a.signalMult : k === 'signalDate' ? a.signalDate
        : k === 'dcaReturn' ? a.dcaReturn : a.dcaSuitabilityScore),
    [assets, sort.key, sort.dir],
  )

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <SortTh label="Ticker" col="ticker" sort={sort} />
              <SortTh label="Name" col="name" sort={sort} />
              <SortTh label="Buy Signal" col="signal" sort={sort} align="center" title="Most recent weekly buy signal: multiplier, dollar amount and date. Click to sort by size. Sorting by date is on the Signal Date heading." />
              <SortTh label="Signal Date" col="signalDate" sort={sort} />
              <SortTh label="1Y DCA Return" col="dcaReturn" sort={sort} align="right" />
              <SortTh label="DCA Suitability" col="dcaSuitabilityScore" sort={sort} align="right" />
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
                  <SignalCell mult={asset.signalMult} date={asset.signalDate} showDate={false} />
                </td>
                <td className="py-3 px-2 text-[var(--text-secondary)]">
                  {asset.signalDate ? dateCompact(asset.signalDate) : '-'}
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
