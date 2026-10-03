export const chartOptions = {
  layout: {
    background: { color: 'transparent' },
    textColor: '#9c9a92',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 11,
  },
  grid: {
    vertLines: { color: 'rgba(0,0,0,0.05)' },
    horzLines: { color: 'rgba(0,0,0,0.05)' },
  },
  rightPriceScale: {
    borderColor: 'rgba(0,0,0,0.08)',
  },
  timeScale: {
    borderColor: 'rgba(0,0,0,0.08)',
    timeVisible: true,
    secondsVisible: false,
  },
  handleScroll: true,  // Enable scroll (drag to pan)
  handleScale: true,   // Enable scroll wheel zoom
};

export const chartOptionsDark = {
  ...chartOptions,
  layout: {
    ...chartOptions.layout,
  },
  grid: {
    vertLines: { color: 'rgba(255,255,255,0.06)' },
    horzLines: { color: 'rgba(255,255,255,0.06)' },
  },
  rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
  timeScale: { borderColor: 'rgba(255,255,255,0.08)' },
};
