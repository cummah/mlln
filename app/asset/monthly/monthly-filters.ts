interface SignalRow {
  ticker: string;
  name: string;
  sector: string;
  signalDate: string | null;
  signalMult: number | null;
  dcaSuitabilityScore: number | null;
  finalConvictionScore: number | null;
  fundamentalQualityScore: number | null;
  factorRegimeScore: number | null;
  volTimingScore: number | null;
  meanReversionScore: number | null;
  displayPerformance?: number | null;
  exitOpen: boolean;
}

type ReturnFilter = 'all' | 'positive' | 'negative';
type DateRangeFilter = 'all' | 'lastMonth' | 'last3Months' | 'last6Months' | 'lastYear';
type StatusFilter = 'all' | 'open' | 'closed';
type HistoricalYear = 'none' | '2025' | '2024' | '2023' | '2022' | '2021';

const SCORE_SLIDER_MAX = 100;
const MULTIPLIER_SLIDER_MAX = 6;
const FACTOR_REGIME_SLIDER_MAX = 40;
const VOL_TIMING_SLIDER_MAX = 30;
const MEAN_REVERSION_SLIDER_MAX = 30;

function getDaysAgo(date: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getHistoricalYearDateRange(year: HistoricalYear): { start: Date; end: Date } | null {
  if (year === 'none') return null;
  const yearNum = parseInt(year);
  const start = new Date(yearNum, 0, 1);
  const end = new Date(yearNum, 11, 31);
  return { start, end };
}

export function applyMonthlyFilters(
  data: SignalRow[],
  tickerSearch: string,
  returnFilter: ReturnFilter,
  dateRangeFilter: DateRangeFilter,
  sectorFilters: string[],
  minScoreFilter: number,
  minMultiplierFilter: number,
  minConvictionFilter: number = 0,
  minFundamentalFilter: number = 0,
  statusFilter: StatusFilter = 'all',
  maxScoreFilter: number = SCORE_SLIDER_MAX,
  maxMultiplierFilter: number = MULTIPLIER_SLIDER_MAX,
  maxConvictionFilter: number = SCORE_SLIDER_MAX,
  maxFundamentalFilter: number = SCORE_SLIDER_MAX,
  minFactorRegime: number = -FACTOR_REGIME_SLIDER_MAX,
  maxFactorRegime: number = FACTOR_REGIME_SLIDER_MAX,
  minVolTiming: number = -VOL_TIMING_SLIDER_MAX,
  maxVolTiming: number = VOL_TIMING_SLIDER_MAX,
  minMeanReversion: number = -MEAN_REVERSION_SLIDER_MAX,
  maxMeanReversion: number = MEAN_REVERSION_SLIDER_MAX,
  historicalYear: HistoricalYear = 'none'
): SignalRow[] {
  const search = tickerSearch.trim().toUpperCase();

  return data.filter((row) => {
    if (search && !row.ticker.toUpperCase().includes(search) && !row.name.toUpperCase().includes(search)) return false;

    const perf = row.displayPerformance;
    if (returnFilter === 'positive' && (perf === null || perf === undefined || perf < 0)) return false;
    if (returnFilter === 'negative' && (perf === null || perf === undefined || perf >= 0)) return false;

    if (dateRangeFilter !== 'all' && row.signalDate) {
      const signalDate = new Date(row.signalDate);
      const daysAgo = getDaysAgo(signalDate);

      switch (dateRangeFilter) {
        case 'lastMonth':
          if (daysAgo > 30) return false;
          break;
        case 'last3Months':
          if (daysAgo > 90) return false;
          break;
        case 'last6Months':
          if (daysAgo > 180) return false;
          break;
        case 'lastYear':
          if (daysAgo > 365) return false;
          break;
      }
    }

    if (historicalYear !== 'none' && row.signalDate) {
      const yearRange = getHistoricalYearDateRange(historicalYear);
      if (yearRange) {
        const signalDate = new Date(row.signalDate);
        if (signalDate < yearRange.start || signalDate > yearRange.end) {
          return false;
        }
      }
    }

    if (sectorFilters.length > 0 && !sectorFilters.includes(row.sector)) return false;

    if (minScoreFilter > 0 && (row.dcaSuitabilityScore === null || row.dcaSuitabilityScore < minScoreFilter)) return false;
    if (maxScoreFilter < SCORE_SLIDER_MAX && (row.dcaSuitabilityScore === null || row.dcaSuitabilityScore > maxScoreFilter)) return false;

    if (minMultiplierFilter > 0 && (row.signalMult === null || row.signalMult < minMultiplierFilter)) return false;
    if (maxMultiplierFilter < MULTIPLIER_SLIDER_MAX && (row.signalMult === null || row.signalMult > maxMultiplierFilter)) return false;

    if (minConvictionFilter > 0 && (row.finalConvictionScore === null || row.finalConvictionScore < minConvictionFilter)) return false;
    if (maxConvictionFilter < SCORE_SLIDER_MAX && (row.finalConvictionScore === null || row.finalConvictionScore > maxConvictionFilter)) return false;

    if (minFundamentalFilter > 0 && (row.fundamentalQualityScore === null || row.fundamentalQualityScore < minFundamentalFilter)) return false;
    if (maxFundamentalFilter < SCORE_SLIDER_MAX && (row.fundamentalQualityScore === null || row.fundamentalQualityScore > maxFundamentalFilter)) return false;

    if (statusFilter === 'open' && !row.exitOpen) return false;
    if (statusFilter === 'closed' && row.exitOpen) return false;

    const factorPct = row.factorRegimeScore !== null ? row.factorRegimeScore * 100 : null;
    if (minFactorRegime > -FACTOR_REGIME_SLIDER_MAX && (factorPct === null || factorPct < minFactorRegime)) return false;
    if (maxFactorRegime < FACTOR_REGIME_SLIDER_MAX && (factorPct === null || factorPct > maxFactorRegime)) return false;

    const volPct = row.volTimingScore !== null ? row.volTimingScore * 100 : null;
    if (minVolTiming > -VOL_TIMING_SLIDER_MAX && (volPct === null || volPct < minVolTiming)) return false;
    if (maxVolTiming < VOL_TIMING_SLIDER_MAX && (volPct === null || volPct > maxVolTiming)) return false;

    const mrPct = row.meanReversionScore !== null ? row.meanReversionScore * 100 : null;
    if (minMeanReversion > -MEAN_REVERSION_SLIDER_MAX && (mrPct === null || mrPct < minMeanReversion)) return false;
    if (maxMeanReversion < MEAN_REVERSION_SLIDER_MAX && (mrPct === null || mrPct > maxMeanReversion)) return false;

    return true;
  });
}
