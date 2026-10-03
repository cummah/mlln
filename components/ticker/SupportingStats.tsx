'use client';

import { motion } from 'framer-motion';
import { NumberTicker } from '@/components/ui/NumberTicker';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import type { BacktestSummary } from '@/lib/backtest-summary';

interface SupportingStatsProps {
  backtestSummary: BacktestSummary;
}

export function SupportingStats({ backtestSummary }: SupportingStatsProps) {
  const stdInvested = backtestSummary.stdInvested5y;
  const enhValue = backtestSummary.enhValue5y;
  const stdAvgEntry = backtestSummary.stdAvgEntry5y;
  const enhAvgEntry = backtestSummary.enhAvgEntry5y;
  const alpha = backtestSummary.alpha5y;
  const stdValue = backtestSummary.stdValue5y;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.6 }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px'
      }}
    >
      <div style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-elevated)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: 'var(--inset-top), var(--shadow-md)'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
          Total Invested (5Y)
        </div>
        <div style={{ fontSize: '20px', fontWeight: '700', fontFamily: 'DM Mono, monospace', color: 'var(--text)' }}>
          <NumberTicker value={stdInvested} format={(n) => formatCurrency(n)} />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '3px' }}>
          $100/week · {backtestSummary.stdPurchases5y} purchases
        </div>
      </div>

      <div style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-elevated)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: 'var(--inset-top), var(--shadow-md)'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
          Enhanced Value (5Y)
        </div>
        <div style={{ fontSize: '20px', fontWeight: '700', fontFamily: 'DM Mono, monospace', color: 'var(--teal)' }}>
          <NumberTicker value={enhValue} format={(n) => formatCurrency(n)} />
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '3px' }}>
          {backtestSummary.enhPurchases5y} targeted purchases
        </div>
      </div>

      <div style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-elevated)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: 'var(--inset-top), var(--shadow-md)'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
          Avg Entry · Enhanced
        </div>
        <div style={{ fontSize: '20px', fontWeight: '700', fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>
          ${Math.round(enhAvgEntry)}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '3px' }}>
          vs ${Math.round(stdAvgEntry)} standard · −${Math.round(stdAvgEntry - enhAvgEntry)}/share
        </div>
      </div>

      <div style={{
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-elevated)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: 'var(--inset-top), var(--shadow-md)'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
          Alpha vs Standard
        </div>
        <div style={{ fontSize: '20px', fontWeight: '700', fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>
          +{formatPercent(alpha)}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '3px' }}>
          +${Math.round((enhValue - stdValue) / 1000) * 1000} in portfolio value
        </div>
      </div>
    </motion.div>
  );
}
