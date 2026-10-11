'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import type { TickerSummary } from '@/lib/ticker/summary';
import { formatPercent, formatSignedPercent } from '@/lib/formatters';

interface AlphaBannerProps {
  backtestSummary: TickerSummary;
}

export function AlphaBanner({ backtestSummary }: AlphaBannerProps) {
  const { frequency, baseAmount } = useAppStore();
  const summary = backtestSummary;
  const modelLabel = 'Enhanced';

  const getField = (fieldName: keyof TickerSummary): number => {
    const val = summary[fieldName];
    return typeof val === 'number' ? val : 0;
  };

  const isMonthly = frequency === 'monthly';

  // Only shown when a real five year result exists for this frequency
  if (!summary.available[frequency]['5y']) return null;

  // Real per-share average entry price and returns for the selected frequency —
  // mirrors CustomBacktestTiles' getRealData so both stay in sync when the toggle changes.
  const stdReturn = isMonthly ? getField('monthlyStdReturn5y') : getField('stdReturn5y');
  const enhReturn = isMonthly ? getField('monthlyEnhReturn5y') : getField('enhReturn5y');
  const alpha = isMonthly ? getField('monthlyAlpha5y') : getField('alpha5y');
  const stdAvgEntry = Math.round(isMonthly ? getField('monthlyStdAvgEntry5y') : getField('stdAvgEntry5y'));
  const enhAvgEntry = Math.round(isMonthly ? getField('monthlyEnhAvgEntry5y') : getField('enhAvgEntry5y'));

  const amount = isMonthly ? Math.round(baseAmount * 4.33) : baseAmount;
  const scale = isMonthly ? amount / 433 : amount / 100;
  const stdValue = (isMonthly ? getField('monthlyStdValue5y') : getField('stdValue5y')) * scale;
  const enhValue = (isMonthly ? getField('monthlyEnhValue5y') : getField('enhValue5y')) * scale;
  const extraValue = Math.round(enhValue - stdValue);

  const outperformed = alpha >= 0;
  const lowerEntry = enhAvgEntry <= stdAvgEntry;
  const enhInvested = (isMonthly ? getField('monthlyEnhInvested5y') : getField('enhInvested5y')) * scale;
  const stdInvested = (isMonthly ? getField('monthlyStdInvested5y') : getField('stdInvested5y')) * scale;
  const lessCapital = enhInvested < stdInvested;
  const headline = outperformed
    ? (lessCapital ? 'deployed less capital and achieved higher returns' : 'achieved higher returns on the capital it deployed')
    : (lessCapital ? 'deployed less capital but returned less' : 'deployed more capital for lower returns');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.4 }}
    >
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,196,167,0.08) 0%, rgba(0,196,167,0.03) 100%)',
        border: '1px solid rgba(0,196,167,0.2)',
        borderRadius: '14px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--teal-dim)',
            border: '1px solid var(--teal-mid)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00c4a7" strokeWidth="2.5">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
              Alpha Advantage · 5Y {modelLabel} DCA
            </div>
            <motion.div
              key={alpha}
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 0.3 }}
              style={{
                fontSize: '26px',
                fontWeight: '700',
                fontFamily: 'DM Mono, monospace',
                color: 'var(--teal)',
                letterSpacing: '-0.5px',
                lineHeight: '1.1'
              }}
            >
              {formatSignedPercent(alpha)}
            </motion.div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: '2px' }}>
              {modelLabel} DCA {headline} — {lowerEntry ? 'with a lower average entry price than standard DCA' : 'with a higher average entry price than standard DCA'}
            </div>
          </div>
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            padding: '6px 14px',
            borderRadius: '8px',
            background: 'var(--teal-dim)',
            border: '1px solid var(--teal-mid)',
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--teal)'
          }}>
            <span style={{ color: 'var(--text-2)', fontWeight: '400', marginRight: '4px' }}>Avg entry</span>${enhAvgEntry} <span style={{ color: 'var(--text-3)', fontWeight: '400' }}>vs ${stdAvgEntry}</span>
          </div>
          <div style={{
            padding: '6px 14px',
            borderRadius: '8px',
            background: 'var(--teal-dim)',
            border: '1px solid var(--teal-mid)',
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--teal)'
          }}>
            <span style={{ color: 'var(--text-2)', fontWeight: '400', marginRight: '4px' }}>5Y return</span>{formatPercent(enhReturn)} <span style={{ color: 'var(--text-3)', fontWeight: '400' }}>vs {formatPercent(stdReturn)}</span>
          </div>
          <div style={{
            padding: '6px 14px',
            borderRadius: '8px',
            background: 'var(--teal-dim)',
            border: '1px solid var(--teal-mid)',
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--teal)'
          }}>
            <span style={{ color: 'var(--text-2)', fontWeight: '400', marginRight: '4px' }}>{extraValue >= 0 ? 'Ending value ahead' : 'Ending value behind'}</span>{extraValue >= 0 ? '+' : '-'}${Math.abs(extraValue).toLocaleString()}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
