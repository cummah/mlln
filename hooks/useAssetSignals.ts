'use client';

import { useState, useEffect } from 'react';
import type { Signal } from '@/types';

export function useAssetSignals(ticker: string) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchSignals() {
      setLoading(true);
      try {
        const res = await fetch(`/api/signal/${ticker}`);
        if (!res.ok) throw new Error('Failed to fetch signals');
        const data = await res.json();
        setSignals(data.signals || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setSignals([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSignals();
  }, [ticker]);

  return { signals, loading, error };
}
