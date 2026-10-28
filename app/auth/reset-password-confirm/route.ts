import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  if (!code && !(tokenHash && type === 'recovery')) {
    return NextResponse.redirect(new URL('/login?error=invalid_reset_link', origin));
  }

  const response = NextResponse.redirect(new URL('/auth/update-password', origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Password reset exchange failed:', error.message);
      return NextResponse.redirect(new URL('/login?error=invalid_reset_link', origin));
    }
  } else if (tokenHash && type === 'recovery') {
    const { error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    });
    if (error) {
      console.error('Password reset verification failed:', error.message);
      return NextResponse.redirect(new URL('/login?error=invalid_reset_link', origin));
    }
  }

  return response;
}
