'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import type { Frequency } from '@/types';

const QUICK_AMOUNTS = [50, 100, 250, 600];

// Convert slider position (0-300) to amount with variable increments
function sliderToAmount(sliderValue: number): number {
  // 0-100: smooth from $10 to $100
  // 100-200: smooth from $100 to $300
  // 200-300: smooth from $300 to $1000
  if (sliderValue <= 100) {
    return Math.round(10 + (sliderValue / 100) * 90);
  } else if (sliderValue <= 200) {
    return Math.round(100 + ((sliderValue - 100) / 100) * 200);
  } else {
    return Math.round(300 + ((sliderValue - 200) / 100) * 700);
  }
}

// Convert amount to slider position (0-300)
function amountToSlider(amount: number): number {
  if (amount <= 100) {
    return ((amount - 10) / 90) * 100;
  } else if (amount <= 300) {
    return 100 + ((amount - 100) / 200) * 100;
  } else {
    return 200 + ((amount - 300) / 700) * 100;
  }
}

interface BacktestSettingsProps {
  showModelToggle?: boolean;
}

export function BacktestSettings({ showModelToggle = false }: BacktestSettingsProps) {
  const {
    frequency, setFrequency, baseAmount, setBaseAmount, backtestModel, setBacktestModel,
    macroFactorEnabled, setMacroFactorEnabled, macroVolEnabled, setMacroVolEnabled,
    macroMeanReversionEnabled, setMacroMeanReversionEnabled,
  } = useAppStore();

  // Clamp baseAmount between 10 and 1000
  const clampedAmount = Math.max(10, Math.min(1000, baseAmount));
  const displayAmt = frequency === 'monthly' ? Math.round(clampedAmount * 4.33) : clampedAmount;
  const sliderValue = amountToSlider(clampedAmount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-elevated)',
        borderRadius: '14px',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap',
        marginBottom: '12px',
        boxShadow: 'var(--inset-top), var(--shadow-md)'
      }}
    >
      {/* Frequency */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Frequency
        </div>
        <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px' }}>
          {['weekly', 'monthly'].map((f) => (
            <button
              key={f}
              onClick={() => setFrequency(f as Frequency)}
              style={{
                padding: '5px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
                border: 'none',
                background: frequency === f ? 'var(--teal)' : 'transparent',
                color: frequency === f ? '#040e18' : 'var(--text-2)',
                fontWeight: frequency === f ? 600 : 500,
                fontFamily: 'DM Sans, sans-serif',
                transition: 'all 0.15s'
              }}
            >
              {f === 'weekly' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
      </div>

      {/* Model Toggle */}
      {showModelToggle && (
        <>
          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Model
            </div>
            <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '2px' }}>
              {([
                { key: 'enhanced', label: 'Signal-Enhanced' },
                { key: 'macro', label: 'Macro-Scaled' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setBacktestModel(key)}
                  title={key === 'enhanced'
                    ? 'Buys timed and sized by per-asset technical signals'
                    : 'Buys every period, sized by the macro regime’s sector modifier'}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    border: 'none',
                    background: backtestModel === key ? 'var(--teal)' : 'transparent',
                    color: backtestModel === key ? '#040e18' : 'var(--text-2)',
                    fontWeight: backtestModel === key ? 600 : 500,
                    fontFamily: 'DM Sans, sans-serif',
                    transition: 'all 0.15s'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {backtestModel === 'macro' && (
            <>
              <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Macro Components
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }} title="PCA statistical factor tilt (scripts/compute-factor-model.ts)">
                  <input
                    type="checkbox"
                    checked={macroFactorEnabled}
                    onChange={(e) => setMacroFactorEnabled(e.target.checked)}
                    style={{ accentColor: 'var(--teal)', cursor: 'pointer' }}
                  />
                  Factor Tilt
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }} title="EWMA volatility-conditioned dip sizing">
                  <input
                    type="checkbox"
                    checked={macroVolEnabled}
                    onChange={(e) => setMacroVolEnabled(e.target.checked)}
                    style={{ accentColor: 'var(--teal)', cursor: 'pointer' }}
                  />
                  Volatility Timing
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-2)', cursor: 'pointer' }} title="Ornstein-Uhlenbeck (AR(1)) mean-reversion dip sizing">
                  <input
                    type="checkbox"
                    checked={macroMeanReversionEnabled}
                    onChange={(e) => setMacroMeanReversionEnabled(e.target.checked)}
                    style={{ accentColor: 'var(--teal)', cursor: 'pointer' }}
                  />
                  Mean Reversion
                </label>
              </div>
            </>
          )}
        </>
      )}

      {/* Divider */}
      <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

      {/* Amount with Slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '250px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>
          Amount
        </div>
        <input
          type="range"
          min="0"
          max="300"
          value={sliderValue}
          onChange={(e) => setBaseAmount(sliderToAmount(Number(e.target.value)))}
          style={{
            flex: 1,
            height: '6px',
            borderRadius: '3px',
            background: 'var(--bg)',
            outline: 'none',
            WebkitAppearance: 'none',
            cursor: 'pointer',
            accentColor: 'var(--teal)'
          } as any}
        />
        <div style={{ fontSize: '12.5px', fontFamily: 'DM Mono, monospace', color: 'var(--teal)', fontWeight: '600', minWidth: '60px', textAlign: 'right' }}>
          ${displayAmt}
          <div style={{ fontSize: '10px', color: 'var(--text-2)', fontWeight: '500', marginTop: '2px' }}>
            {frequency === 'weekly' ? '/week' : '/month'}
          </div>
        </div>
      </div>

    </motion.div>
  );
}
