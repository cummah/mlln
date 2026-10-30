import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { OHLCData } from '@/types';

// No generated Database type exists, so the schema is `any`. Without it, inserts are typed `never`.
let supabase: SupabaseClient<any, any, any> | null = null;

function getSupabaseClient() {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(`Supabase environment variables not set. URL: ${!!supabaseUrl}, Key: ${!!supabaseServiceRoleKey}`);
    }

    supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      // This is a server-only client hitting a live DB; page-level `revalidate`
      // already controls staleness. Without this, Next's fetch data cache tries
      // to cache every PostgREST response and chokes on anything over 2MB.
      // A per-request timeout is also required: under high concurrency (pages that
      // fan out OHLC fetches across hundreds of tickers), a single stalled request
      // with no timeout can hang the entire page indefinitely.
      global: { fetch: (url, init) => fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) }) },
    });
  }
  return supabase;
}

export { getSupabaseClient };

// PostgREST (and the Supabase JS client) caps any single response at 1000 rows by
// default. Every bulk "all assets" / "all rows matching X" query in this app can
// exceed that once the assets table grows past ~1000 active rows, silently dropping
// whatever falls after the cutoff (in whatever order Postgres happens to return them).
// Always page through with .range() for queries that aren't scoped to a single ticker.
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize: number = 1000
): Promise<T[]> {
  let all: T[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  return all;
}

export async function fetchOHLC(ticker: string, days: number = 365): Promise<OHLCData[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = new Date().toISOString().split('T')[0];

  try {
    let allData: any[] = [];
    const pageSize = 1000;
    let page = 0;

    while (true) {
      const start = page * pageSize;
      const end = start + pageSize - 1;

      const result = await getSupabaseClient()
        .from('daily_prices')
        .select('date, open, high, low, close')
        .eq('ticker', ticker)
        .gte('date', startDateStr)
        .order('date', { ascending: true })
        .range(start, end);

      if (result.error) {
        console.error(`[fetchOHLC] Error fetching ${ticker}:`, result.error.message);
        break;
      }

      if (!result.data || result.data.length === 0) break;
      allData = allData.concat(result.data);
      if (result.data.length < pageSize) break;
      page++;
    }

    const ohlcData = (allData || []).map((row: any) => ({
      time: row.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    return ohlcData;
  } catch (err) {
    console.error(`[fetchOHLC] Error fetching ${ticker}:`, err);
    return [];
  }
}
