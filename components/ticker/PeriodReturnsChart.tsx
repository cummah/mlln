'use client';

interface SignalRow {
  ticker: string;
  name: string;
  sector: string;
  signalDate: string | null;
  signalMult: number | null;
  invested: number | null;
  performance: number | null;
  currentValue: number | null;
  dcaSuitabilityScore: number | null;
  exitDate: string | null;
  exitReturn: number | null;
  exitScore: number | null;
  exitOpen: boolean;
}

interface PeriodReturn {
  period: string;
  return: number;
  signalCount: number;
  totalInvested: number;
  totalCurrentValue: number;
}

interface PeriodReturnsChartProps {
  filteredData?: SignalRow[];
  allData?: PeriodReturn[];
  frequency: 'weekly' | 'monthly' | 'daily';
}

function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.floor((d.getTime() - yearStart.getTime()) / 604800000) + 1).padStart(2, '0')}`;
}

function getYearMonth(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getLast12Periods(frequency: 'weekly' | 'monthly' | 'daily'): string[] {
  const periods: string[] = [];
  const now = new Date();

  if (frequency === 'weekly') {
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i * 7);
      periods.push(getWeekNumber(date));
    }
  } else if (frequency === 'daily') {
    let count = 0;
    while (count < 12) {
      const dayOfWeek = now.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip Sunday and Saturday
        periods.unshift(now.toISOString().slice(0, 10));
        count++;
      }
      now.setUTCDate(now.getUTCDate() - 1);
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push(getYearMonth(date));
    }
  }

  return Array.from(new Set(periods));
}

function calculatePeriodsFromFiltered(
  data: SignalRow[],
  frequency: 'weekly' | 'monthly' | 'daily'
): PeriodReturn[] {
  const periodMap = new Map<string, { totalInvested: number; totalCurrentValue: number; signalCount: number }>();
  const last12Periods = getLast12Periods(frequency);

  // Initialize all periods
  last12Periods.forEach(period => {
    periodMap.set(period, { totalInvested: 0, totalCurrentValue: 0, signalCount: 0 });
  });

  // Calculate totals for each period
  for (const row of data) {
    if (!row.signalDate || !row.invested) continue;

    const period = frequency === 'weekly'
      ? getWeekNumber(new Date(row.signalDate))
      : frequency === 'daily'
      ? row.signalDate
      : getYearMonth(new Date(row.signalDate));

    // Skip if outside last 12 periods
    if (!last12Periods.includes(period)) continue;

    const periodData = periodMap.get(period);
    if (periodData) {
      periodData.totalInvested += row.invested;
      periodData.totalCurrentValue += (row.currentValue || row.invested);
      periodData.signalCount++;
    }
  }

  // Build result
  return last12Periods.map(period => {
    const data = periodMap.get(period);
    const totalInvested = data?.totalInvested || 0;
    const totalCurrentValue = data?.totalCurrentValue || 0;
    const signalCount = data?.signalCount || 0;

    const actualReturn = totalInvested > 0
      ? ((totalCurrentValue - totalInvested) / totalInvested) * 100
      : 0;

    return {
      period,
      return: Math.round(actualReturn * 10) / 10,
      signalCount,
      totalInvested,
      totalCurrentValue
    };
  });
}

export function PeriodReturnsChart({ filteredData, allData, frequency }: PeriodReturnsChartProps) {
  // Use filtered data if provided, otherwise use pre-calculated data
  const data = filteredData
    ? calculatePeriodsFromFiltered(filteredData, frequency)
    : allData || [];

  if (!data || data.length === 0) {
    return null;
  }

  const maxAbsReturn = Math.max(...data.map(d => Math.abs(d.return)), 10);
  const formatLabel = (period: string, frequency: string) => {
    if (frequency === 'weekly') {
      const match = period.match(/(\d{4})-W(\d+)/);
      if (match) {
        const year = parseInt(match[1]);
        const week = parseInt(match[2]);
        // ISO week to date: Thursday of week = Jan 4 + (week-1)*7 days
        const jan4 = new Date(year, 0, 4);
        const thursday = new Date(jan4);
        thursday.setDate(jan4.getDate() + (week - 1) * 7 - ((jan4.getDay() + 6) % 7) + 3);
        // Monday is 3 days before Thursday
        const monday = new Date(thursday);
        monday.setDate(thursday.getDate() - 3);
        return monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      return period;
    }
    if (frequency === 'daily') {
      const date = new Date(period + 'T00:00:00Z');
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    const date = new Date(period + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
    <div style={{
      background: 'var(--surface-elevated)',
      border: '1px solid var(--border-elevated)',
      borderRadius: '14px',
      padding: '24px 28px',
      marginBottom: '20px',
      boxShadow: 'var(--inset-top), var(--shadow-md)'
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{
          fontSize: '14px',
          fontWeight: '700',
          color: 'var(--text)',
          margin: '0 0 4px 0',
          letterSpacing: '-0.3px'
        }}>
          {frequency === 'weekly' ? 'Last 12 Weeks' : frequency === 'daily' ? 'Last 12 Days' : 'Last 12 Months'} — Signal Performance
        </h3>
        <p style={{
          fontSize: '12px',
          color: 'var(--text-3)',
          margin: 0,
          lineHeight: '1.5'
        }}>
          Total return of signals issued in each period · label shows number of signals
        </p>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '6px',
        height: '120px',
        paddingBottom: '12px'
      }}>
        {data.map((item, idx) => {
          const returnPercent = item.return;
          const isPositive = returnPercent >= 0;
          const barHeightPercent = (Math.abs(returnPercent) / maxAbsReturn) * 100;
          const barHeight = Math.max(4, (barHeightPercent / 100) * 100);

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px'
              }}
              title={`${item.period}: ${returnPercent.toFixed(1)}% (${item.signalCount} signals)`}
            >
              <div style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                minHeight: '100px',
                position: 'relative'
              }}>
                {/* Bar */}
                <div
                  style={{
                    width: '100%',
                    height: `${barHeight}px`,
                    background: isPositive ? 'var(--green)' : '#E24B4A',
                    borderRadius: '4px 4px 0 0',
                    transition: 'all 0.2s',
                    opacity: 0.8,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingBottom: '4px',
                    boxSizing: 'border-box',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.opacity = '0.8';
                  }}
                >
                  {/* Signal count label inside bar */}
                  {barHeight > 20 && (
                    <div style={{
                      fontSize: '9px',
                      fontWeight: '700',
                      color: '#fff',
                      textAlign: 'center',
                      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      lineHeight: '1'
                    }}>
                      {item.signalCount}×
                    </div>
                  )}
                </div>

                {/* Signal count label above bar (if bar is too small) */}
                {barHeight <= 20 && item.signalCount > 0 && (
                  <div style={{
                    fontSize: '9px',
                    fontWeight: '700',
                    color: isPositive ? 'var(--green)' : '#E24B4A',
                    textAlign: 'center',
                    marginBottom: '2px',
                    opacity: 0.7
                  }}>
                    {item.signalCount}×
                  </div>
                )}
              </div>

              {/* Label */}
              <div style={{
                fontSize: '11px',
                fontWeight: '600',
                color: 'var(--text-2)',
                textAlign: 'center',
                whiteSpace: 'nowrap'
              }}>
                {formatLabel(item.period, frequency)}
              </div>

              {/* Value */}
              <div style={{
                fontSize: '10px',
                fontWeight: '600',
                color: isPositive ? 'var(--green)' : '#E24B4A',
                textAlign: 'center'
              }}>
                {isPositive ? '+' : ''}{returnPercent.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
