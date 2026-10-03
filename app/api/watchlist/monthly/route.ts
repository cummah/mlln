import { getSupabaseClient } from '@/lib/supabase';

interface SignalRow {
  ticker: string;
  signalDate: string | null;
  signalMult: number | null;
  performance: number | null;
  finalConvictionScore: number | null;
  exitScore: number | null;
  exitOpen: boolean;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tickers = url.searchParams.get('tickers')?.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean) || [];

    if (tickers.length === 0) {
      return Response.json([], { status: 400 });
    }

    // Fetch monthly signal enrichment to get latest signals per ticker
    const { data: enrichment, error: enrichError } = await getSupabaseClient()
      .from('monthly_signal_enrichment')
      .select('ticker, signals')
      .in('ticker', tickers);

    if (enrichError) {
      console.error('Supabase enrichment error:', enrichError);
      return Response.json({ error: 'Failed to fetch signals' }, { status: 500 });
    }

    // Extract the latest signal for each ticker
    const signals: SignalRow[] = [];
    (enrichment as any[] || []).forEach((row: any) => {
      const ticker = row.ticker.toUpperCase();
      const signalsList = row.signals || [];
      // Get the most recent signal (first in the list, as they're ordered by date desc)
      if (signalsList.length > 0) {
        const latestSignal = signalsList[0];
        signals.push({
          ticker,
          signalDate: latestSignal.date || null,
          signalMult: latestSignal.finalMult || null,
          performance: latestSignal.performance || null,
          finalConvictionScore: latestSignal.finalConvictionScore || null,
          exitScore: latestSignal.exitScore || null,
          exitOpen: latestSignal.exitOpen ?? true,
        });
      }
    });

    return Response.json(signals);
  } catch (err) {
    console.error('Error in watchlist monthly signals:', err);
    return Response.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
