import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, authRateLimiters } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const limitCheck = checkRateLimit(req, authRateLimiters.deleteAccount);
  if (limitCheck) return limitCheck;

  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const [
      { data: profile },
      { data: watchlists },
      { data: portfolios },
      { data: assets },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('user_watchlists')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('user_portfolios')
        .select('*')
        .eq('user_id', user.id),
      supabase
        .from('user_assets')
        .select('*')
        .eq('user_id', user.id),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
      profile: profile || null,
      watchlists: watchlists || [],
      portfolios: portfolios || [],
      assets: assets || [],
    };

    return NextResponse.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="mlln-data-export-${new Date().toISOString().split('T')[0]}.json"`,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.error('Data export error:', err);
    return NextResponse.json(
      { error: 'An error occurred during export' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return NextResponse.json(
    { error: 'Use POST method to export data' },
    { status: 405 }
  );
}
