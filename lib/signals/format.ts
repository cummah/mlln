// Display formatting. A missing value is always shown as n/a, never as zero.

export const NA = 'n/a'

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return NA
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return NA
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
}

/** A fraction such as 0.034 shown as +3.4%. */
export function fracPct(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined ? NA : pct(v * 100, digits)
}

export function mult(v: number | null | undefined): string {
  return v === null || v === undefined ? NA : `${v.toFixed(2)}×`
}

export function num(v: number | null | undefined, digits = 1): string {
  return v === null || v === undefined || !Number.isFinite(v) ? NA : v.toFixed(digits)
}

export function dateShort(d: string | null | undefined): string {
  if (!d) return NA
  return new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export const GREEN = 'var(--green)'
export const RED = '#E24B4A'

export function tone(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'var(--text-2)'
  return v >= 0 ? GREEN : RED
}

/** Whole days between a date and now, for the staleness warning. */
export function daysAgo(date: string, now = Date.now()): number {
  return Math.floor((now - new Date(date + 'T12:00:00Z').getTime()) / 86400000)
}

export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return NA
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (mins < 90) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 36) return `${hours} h ago`
  return `${Math.round(hours / 24)} days ago`
}
