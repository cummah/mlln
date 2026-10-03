import { getSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

  if (!startDateStr) {
    return NextResponse.json({ error: 'startDate parameter required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseClient();

    // Fetch SPY close prices for the date range
    const { data, error } = await supabase
      .from('daily_prices')
      .select('date, close')
      .eq('ticker', 'SPY')
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching SPY data:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length < 2) {
      return NextResponse.json({ spyReturn: null });
    }

    // Calculate return: (end price - start price) / start price
    const startPrice = data[0].close;
    const endPrice = data[data.length - 1].close;
    const returnPercent = ((endPrice - startPrice) / startPrice) * 100;

    return NextResponse.json({ spyReturn: returnPercent });
  } catch (err) {
    console.error('Error calculating SPY return:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
