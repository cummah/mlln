/**
 * Mock data for testing the monthly dashboard without Supabase
 * Remove this file when real data is available
 */

export function generateMockMonthlySignals() {
  const signals = [];
  const tickers = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'NFLX'];
  const baseDate = new Date();

  // Generate 12 months of signals
  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
    const signalDate = new Date(baseDate);
    signalDate.setMonth(signalDate.getMonth() - monthsAgo);

    // 5-15 signals per month
    const countThisMonth = Math.floor(Math.random() * 11) + 5;

    for (let i = 0; i < countThisMonth; i++) {
      const ticker = tickers[Math.floor(Math.random() * tickers.length)];
      const multiplier = Math.random() * 2 + 0.5; // 0.5x to 2.5x
      const invested = 433 * multiplier; // $433/month baseline
      const performance = (Math.random() * 60) - 10; // -10% to +50%
      const currentValue = invested * (1 + performance / 100);
      const isOpen = Math.random() > 0.3; // 70% open, 30% closed
      const exitScore = isOpen ? null : Math.random() * 8 + 1; // 1-9

      signals.push({
        ticker,
        name: ticker,
        sector: ['Technology', 'Healthcare', 'Finance', 'Consumer'][Math.floor(Math.random() * 4)],
        signalDate: signalDate.toISOString().split('T')[0],
        signalMult: multiplier,
        invested,
        performance: isOpen ? performance : performance * 0.8,
        currentValue,
        exitAdjustedPerformance: isOpen ? null : performance * 0.8,
        exitAdjustedValue: isOpen ? null : invested * (1 + (performance * 0.8) / 100),
        dcaSuitabilityScore: Math.random() * 100,
        fundamentalQualityScore: Math.random() * 100,
        finalConvictionScore: Math.random() * 100,
        macroRegimeState: 'Growth',
        factorRegimeScore: (Math.random() - 0.5) * 40,
        factorRegimeLabel: null,
        volTimingScore: (Math.random() - 0.5) * 30,
        volTimingLabel: null,
        meanReversionScore: (Math.random() - 0.5) * 30,
        meanReversionLabel: null,
        tags: null,
        exitDate: isOpen ? null : new Date(signalDate.getTime() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        exitReturn: isOpen ? null : performance * 0.8,
        exitScore: exitScore,
        exitDateNextOpen: null,
        exitReturnNextOpen: null,
        exitOpen: isOpen,
        tickerAlpha5y: Math.random() * 20 - 5,
        cohortPeriod: signalDate.toISOString().slice(0, 7),
      });
    }
  }

  return signals;
}
