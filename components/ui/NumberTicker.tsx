'use client';

import { useState, useEffect } from 'react';

interface NumberTickerProps {
  value: number;
  format: (n: number) => string;
  className?: string;
}

export function NumberTicker({ value, format, className = '' }: NumberTickerProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const start = displayValue;
    const diff = value - start;
    const duration = 200;
    const steps = 30;
    const stepDuration = duration / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      const current = start + diff * progress;
      setDisplayValue(current);

      if (step >= steps) {
        clearInterval(interval);
        setDisplayValue(value);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [value, displayValue]);

  return <span className={className}>{format(Math.round(displayValue))}</span>;
}
