'use client'

import { useState } from 'react'

export type Dir = 'asc' | 'desc'

/** Which column a table is sorted by and which way. Text columns start A to Z, number columns start largest first. */
export function useSort<K extends string>(initialKey: K, initialDir: Dir, textKeys: K[]) {
  const [key, setKey] = useState<K>(initialKey)
  const [dir, setDir] = useState<Dir>(initialDir)
  const toggle = (k: K) => {
    if (k === key) setDir(dir === 'asc' ? 'desc' : 'asc')
    else { setKey(k); setDir(textKeys.includes(k) ? 'asc' : 'desc') }
  }
  return { key, dir, toggle }
}

/** Stable sort. Rows with no value in the sorted column always go last, whichever way it is sorted. */
export function sortBy<T, K extends string>(rows: T[], key: K, dir: Dir, get: (row: T, key: K) => string | number | null): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = get(a, key), y = get(b, key)
    if (x === null && y === null) return 0
    if (x === null) return 1
    if (y === null) return -1
    if (typeof x === 'string' && typeof y === 'string') return x.localeCompare(y) * sign
    return (x < y ? -1 : x > y ? 1 : 0) * sign
  })
}

export function SortTh<K extends string>({
  label, col, sort, align = 'left', title,
}: {
  label: string
  col: K
  sort: { key: K; dir: Dir; toggle: (k: K) => void }
  align?: 'left' | 'right' | 'center'
  title?: string
}) {
  const active = sort.key === col
  return (
    <th
      title={title ?? `Sort by ${label}`}
      onClick={() => sort.toggle(col)}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      style={{ textAlign: align, padding: '12px 8px', fontWeight: 600, color: active ? 'var(--text)' : 'var(--text-2)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label}{active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : <span style={{ color: 'var(--text-3)', opacity: 0.5 }}> ↕</span>}
    </th>
  )
}
