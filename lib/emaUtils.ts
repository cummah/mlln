/**
 * Adaptive EMA utilities for assets with limited historical data
 *
 * Newer assets/IPOs don't have 200+ periods of data, so we scale the EMA
 * period based on available data while maintaining signal quality.
 */

export interface AdaptiveEmaConfig {
  emaLength: number;
  isNewAsset: boolean;
  dataQualityScore: number; // 0-100, where 100 = full history
}

/**
 * Calculate adaptive EMA length based on available bar count
 *
 * For a 200-period target:
 * - 200+ bars: use 200 (full history)
 * - 100-200 bars: scale proportionally
 * - <100 bars: use minimum + scaled portion
 *
 * This keeps signals responsive for new assets while stable for established ones
 */
export function getAdaptiveEmaLength(
  barCount: number,
  targetEmaLength: number = 200,
  minEmaLength: number = 20
): number {
  if (barCount >= targetEmaLength) {
    return targetEmaLength;
  }

  // For limited data: use ~1/3 of available bars, minimum of minEmaLength
  // This gives a sweet spot between responsiveness and stability
  const scaledEma = Math.max(minEmaLength, Math.floor(barCount / 3));
  return scaledEma;
}

/**
 * Calculate data quality score (0-100)
 * 100 = has full 200 periods
 * 50 = has 100 periods
 * 0 = has < 20 periods
 */
export function calculateDataQualityScore(
  barCount: number,
  targetEmaLength: number = 200
): number {
  const minBars = 20;
  const maxBars = targetEmaLength;

  if (barCount >= maxBars) return 100;
  if (barCount <= minBars) return Math.max(0, (barCount / minBars) * 10);

  // Scale 20-200 bars to 10-100 score
  return ((barCount - minBars) / (maxBars - minBars)) * 90 + 10;
}

/**
 * Get complete adaptive EMA configuration for a specific frequency
 * Only changes EMA length based on available data; all other filters unchanged
 */
export function getAdaptiveEmaConfig(
  barCount: number,
  frequency: 'daily' | 'weekly' | 'monthly'
): AdaptiveEmaConfig {
  const qualityScore = calculateDataQualityScore(barCount);
  const isNewAsset = barCount < 100; // < ~2 years for daily, ~2 years for weekly

  let emaLength: number;
  let minEmaLength: number;

  switch (frequency) {
    case 'daily':
      minEmaLength = 7;
      emaLength = getAdaptiveEmaLength(barCount, 14, minEmaLength);
      break;

    case 'weekly':
      minEmaLength = 30;
      emaLength = getAdaptiveEmaLength(barCount, 200, minEmaLength);
      break;

    case 'monthly':
      minEmaLength = 20;
      emaLength = getAdaptiveEmaLength(barCount, 200, minEmaLength);
      break;

    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }

  return {
    emaLength,
    isNewAsset,
    dataQualityScore: qualityScore,
  };
}


/**
 * Format data quality for display
 */
export function formatDataQuality(score: number): {
  percent: number;
  label: string;
  icon: string;
  color: string;
} {
  let label: string;
  let icon: string;
  let color: string;

  if (score >= 90) {
    label = 'Full History';
    icon = '✓';
    color = 'var(--green)';
  } else if (score >= 75) {
    label = 'Good';
    icon = '◐';
    color = 'var(--cyan)';
  } else if (score >= 50) {
    label = 'Limited';
    icon = '◑';
    color = 'var(--yellow)';
  } else if (score >= 25) {
    label = 'New Asset';
    icon = '◒';
    color = '#FFC107';
  } else {
    label = 'Minimal Data';
    icon = '○';
    color = '#E24B4A';
  }

  return {
    percent: Math.round(score),
    label,
    icon,
    color,
  };
}
