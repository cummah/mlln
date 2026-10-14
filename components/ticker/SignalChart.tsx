'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
} from 'lightweight-charts';
import { chartOptions, chartOptionsDark } from '@/lib/chartDefaults';
import { useAppStore } from '@/store/appStore';
import type { OHLCData, Signal } from '@/types';

interface SignalChartProps {
  ohlc: OHLCData[];
  signals: Signal[];
  baseAmount: number;
  height?: number;
  ticker?: string;
}

function multToMarkerSize(mult: number): 0 | 1 | 2 | 3 | 4 {
  if (mult === 0) return 1;
  if (mult < 1.5) return 1;
  if (mult < 2.5) return 2;
  if (mult < 4.0) return 3;
  return 4;
}

function multToColor(mult: number, skipped: boolean): string {
  if (skipped) return 'rgba(180,178,169,0.35)';
  if (mult < 1.5) return '#9FE1CB';
  if (mult < 2.5) return '#5DCAA5';
  if (mult < 4.0) return '#1D9E75';
  return '#0F6E56';
}

export function SignalChart({
  ohlc,
  signals,
  baseAmount,
  height = 320,
  ticker,
}: SignalChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(theme === 'dark');
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Handle empty OHLC data - still create chart but show placeholder
    if (ohlc.length === 0) {
      const container = containerRef.current;
      container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-tertiary)">No chart data available</div>';
      return;
    }

    const chart = createChart(containerRef.current, {
      ...chartOptions,
      width: containerRef.current.clientWidth,
      height: height,
      // Touch only: let a vertical swipe over the chart scroll the page instead of panning the chart.
      handleScroll: { vertTouchDrag: false },
      layout: {
        ...chartOptions.layout,
        ...(isDarkMode ? chartOptionsDark.layout : {}),
      },
      grid: isDarkMode ? chartOptionsDark.grid : chartOptions.grid,
      rightPriceScale: isDarkMode
        ? { borderColor: 'rgba(255,255,255,0.08)' }
        : { borderColor: 'rgba(0,0,0,0.08)' },
      timeScale: isDarkMode
        ? { borderColor: 'rgba(255,255,255,0.08)' }
        : { borderColor: 'rgba(0,0,0,0.08)' },
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#1D9E75',
      downColor: '#E24B4A',
      borderUpColor: '#1D9E75',
      borderDownColor: '#E24B4A',
      wickUpColor: '#1D9E75',
      wickDownColor: '#E24B4A',
    });

    candleSeries.setData(
      ohlc.map((d) => ({
        time: d.time as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    // Filter to only show enhanced DCA signals (skip standard buys where mult === 0)
    const markers = signals
      .filter((sig) => !sig.skipped && sig.mult > 0)
      .map((sig) => ({
        time: sig.date as any,
        position: 'belowBar' as const,
        shape: 'arrowUp' as const,
        color: multToColor(sig.mult, false),
        size: multToMarkerSize(sig.mult),
      }));

    candleSeries.setMarkers(markers);
    chart.timeScale().fitContent();

    // Add accessibility attributes to canvas
    const canvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement;
    if (canvas && ticker) {
      const backtestStartYear = ohlc[0].time.slice(0, 4);
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${ticker} Enhanced DCA buy signal chart showing purchase timing from ${backtestStartYear} to present`);
    }

    // Enable interactivity (zoom and pan)
    chart.timeScale().applyOptions({
      timeVisible: true,
      secondsVisible: false,
    });

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [ohlc, signals, baseAmount, isDarkMode, height]);

  return (
    <div ref={containerRef} className="w-full" style={{ height: `${height}px` }} />
  );
}
