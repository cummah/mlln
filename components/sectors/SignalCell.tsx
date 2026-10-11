/** A weekly buy multiplier. Above 1x is a larger buy than standard, at or below 1x is a smaller one. No signal shows a dash. */
export function SignalCell({ mult }: { mult: number | null }) {
  if (mult === null) return <span title="No weekly buy signal in the last 26 weeks" style={{ color: 'var(--text-3)' }}>-</span>
  return <span style={{ color: mult > 1 ? 'var(--green)' : 'var(--text-2)', fontWeight: 600 }}>{mult.toFixed(2)}x</span>
}
