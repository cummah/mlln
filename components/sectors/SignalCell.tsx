import { FREQ_SETTINGS } from '@/lib/signals/config'
import { dateCompact } from '@/lib/signals/format'

const WEEKLY_BASE = FREQ_SETTINGS.weekly.baseAmount

/** The dollar amount a weekly buy of this multiplier means, on the standard weekly amount. */
export function allocation(mult: number): string {
  return `$${Math.round(mult * WEEKLY_BASE).toLocaleString()}`
}

/**
 * A weekly buy signal: its multiplier, what that means in dollars, and the date it was issued.
 * Any multiplier above zero is a real buy. Below 1x it is a smaller buy than the standard amount.
 * No signal at all means the asset had no weekly buy in the last 26 weeks.
 */
export function SignalCell({ mult, date, showDate = true }: { mult: number | null; date: string | null; showDate?: boolean }) {
  if (mult === null) {
    return <span title="No weekly buy signal in the last 26 weeks" style={{ color: 'var(--text-3)' }}>no recent buy</span>
  }
  return (
    <span title={`Weekly buy signal of ${mult.toFixed(2)}x on ${WEEKLY_BASE} dollars is ${allocation(mult)}`} style={{ display: 'inline-block', lineHeight: 1.3 }}>
      <span style={{ color: mult > 1 ? 'var(--green)' : 'var(--text-2)', fontWeight: 600 }}>
        {mult.toFixed(2)}x · {allocation(mult)}
      </span>
      {showDate && date && <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-3)', fontWeight: 400 }}>{dateCompact(date)}</span>}
    </span>
  )
}
