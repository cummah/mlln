'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ATR_MULTIPLIERS } from '@/lib/signals/config'
import { dateShort, fracPct, mult, NA, num, pct, tone, volLabel } from '@/lib/signals/format'
import type { Freq } from '@/lib/signals/types'

interface Detail { [k: string]: any }

const Row = ({ k, v, color }: { k: string; v: React.ReactNode; color?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px', padding: '4px 0' }}>
    <span style={{ color: 'var(--text-2)' }}>{k}</span>
    <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, color: color ?? 'var(--text)', textAlign: 'right' }}>{v}</span>
  </div>
)

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '18px' }}>
    <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-3)', marginBottom: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>{title}</div>
    {children}
  </div>
)

export function SignalDrawer({ ticker, name, date, freq, onClose }: { ticker: string; name: string; date: string; freq: Freq; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setD(null); setErr(null)
    fetch(`/api/signal-detail?ticker=${encodeURIComponent(ticker)}&freq=${freq}&date=${date}`)
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`); return r.json() })
      .then(j => live && setD(j))
      .catch(e => live && setErr(String(e.message ?? e)))
    return () => { live = false }
  }, [ticker, freq, date])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const product = d ? d.rsi_mult * d.ema_mult * d.regime_adj * d.dd_bonus * d.vix_bonus : null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 90 }} />
      <aside style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 100vw)', background: 'var(--surface-elevated)', borderLeft: '1px solid var(--border-elevated)', zIndex: 100, overflowY: 'auto', padding: '20px 22px', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <Link href={`/asset/${ticker.toLowerCase()}`} style={{ fontSize: '20px', fontWeight: 700, color: 'var(--teal)', textDecoration: 'none' }}>{ticker}</Link>
            <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>{freq} signal on {dateShort(date)}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', color: 'var(--text-2)', cursor: 'pointer' }}>Close</button>
        </div>

        {err && <div style={{ color: '#E24B4A', fontSize: '13px' }}>Could not load the signal: {err}</div>}
        {!d && !err && <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>Loading...</div>}

        {d && (
          <>
            <Section title="How the multiplier was built">
              <Row k="RSI" v={`${num(d.rsi)} → ${mult(d.rsi_mult)}`} />
              <Row k="Distance from trend average" v={`${pct(d.ema_dist_pct)} → ${mult(d.ema_mult)}`} />
              <Row k="Drawdown from 1y high" v={`${num(d.drawdown_pct)}% → ${mult(d.dd_bonus)}`} />
              <Row k="Downtrend penalty" v={mult(d.regime_adj)} />
              <Row k="VIX" v={`${num(d.vix)} → ${mult(d.vix_bonus)}`} />
              <div style={{ borderTop: '1px solid var(--border)', marginTop: '6px', paddingTop: '6px' }}>
                <Row k="Product" v={product === null ? NA : mult(product)} />
                <Row k="Final (capped at 6×)" v={mult(d.mult)} color="var(--teal)" />
              </div>
            </Section>

            <Section title="Indicators on the signal date">
              <Row k="Factor regime" v={fracPct(d.factor_regime)} color={tone(d.factor_regime)} />
              <Row k="Volatility timing" v={volLabel(d.vol_timing)} color={d.vol_timing === 0 ? 'var(--text-3)' : tone(d.vol_timing)} />
              <Row k="Mean reversion" v={fracPct(d.mean_reversion)} color={tone(d.mean_reversion)} />
              <Row k="Reversion half-life" v={d.mr_half_life === null ? 'none measured' : `${num(d.mr_half_life)} days`} />
              <Row k="Volatility (ATR 14)" v={d.atr_pct === null ? NA : `${num(d.atr_pct)}%`} />
              <Row k="Trend strength" v={num(d.trend_strength, 2)} />
              <Row k="5 day momentum" v={pct(d.momentum_5d)} color={tone(d.momentum_5d)} />
              {freq === 'daily' && <Row k="Weekly / monthly buy" v={`${d.weekly_align_days === null ? '-' : d.weekly_align_days + ' d'} / ${d.monthly_align_days === null ? '-' : d.monthly_align_days + ' d'}`} />}
              <Row k="DCA suitability" v={d.dca_suitability_score === null ? NA : Math.round(d.dca_suitability_score)} />
            </Section>

            <Section title="Outcome">
              <Row k="Entry" v={d.entry_price === null ? 'fills next open' : `${num(d.entry_price, 2)} on ${dateShort(d.entry_date)}`} />
              <Row k="Latest close" v={d.latest_price === null ? NA : `${num(d.latest_price, 2)} on ${dateShort(d.price_date)}`} />
              <Row k="Return if held" v={pct(d.performance_pct)} color={tone(d.performance_pct)} />
              {d.exit_open
                ? <Row k="Exit signal" v="none yet" />
                : <>
                    <Row k="Exit signal" v={`${dateShort(d.exit_date)} · score ${num(d.exit_score)}`} />
                    <Row k="Return if sold at close" v={pct(d.exit_return_pct)} color={tone(d.exit_return_pct)} />
                    <Row k="Return if sold next open" v={d.exit_next_open_return_pct === null ? 'not open yet' : pct(d.exit_next_open_return_pct)} color={tone(d.exit_next_open_return_pct)} />
                  </>}
              {freq === 'daily' && d.atr_breach_dates && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '2px' }}>Trailing stop outcomes</div>
                  {ATR_MULTIPLIERS.map((m, i) => (
                    <Row key={m} k={`${m}× ATR`} v={d.atr_breach_dates[i] ? `${dateShort(d.atr_breach_dates[i])} · ${pct(d.atr_breach_returns?.[i])}` : 'not hit'} color={d.atr_breach_dates[i] ? tone(d.atr_breach_returns?.[i]) : undefined} />
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </aside>
    </>
  )
}
