import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);

    // Get the user and ensure profile exists
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        // Profile doesn't exist, create it
        await supabase.from('profiles').insert([{ user_id: user.id, tier: 0 }]);
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL('/account', request.url));
}
