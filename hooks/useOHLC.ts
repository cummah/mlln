'use client';

import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import type { OHLCData, Period } from '@/types';

function getDateRangeStart(range: Period): string {
  const now = new Date();
  const days = range === '1y' ? 365 : range === '3y' ? 1095 : 1825;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return start.toISOString().split('T')[0];
}

export function useOHLC(ticker: string, range: Period) {
  const [data, setData] = useState<OHLCData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchOHLC() {
      setLoading(true);
      try {
        const startDate = getDateRangeStart(range);
        const { data: ohlcData, error: dbError } = await getSupabaseClient()
          .from('ohlc_daily')
          .select('date, open, high, low, close')
          .eq('ticker', ticker)
          .gte('date', startDate)
          .order('date', { ascending: true });

        if (dbError) throw dbError;

        const transformed = (ohlcData || []).map((row: any) => ({
          time: row.date,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
        })) as OHLCData[];

        setData(transformed);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch OHLC data'));
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchOHLC();
  }, [ticker, range]);

  return { data, loading, error };
}
