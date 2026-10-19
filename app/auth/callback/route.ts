import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  console.log('=== Callback Route ===');
  console.log('Code present:', code ? 'yes' : 'no');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.log('Session error:', error.message);
      return NextResponse.redirect(new URL('/login', request.url));
    }
    console.log('Session exchanged successfully');
  }

  console.log('Redirecting to /account');
  return NextResponse.redirect(new URL('/account', request.url));
}
