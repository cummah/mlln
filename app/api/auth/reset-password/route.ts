import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, authRateLimiters } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const limitCheck = checkRateLimit(req, authRateLimiters.passwordReset);
  if (limitCheck) return limitCheck;

  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/reset-password-confirm`,
    });

    if (error) {
      console.error('Password reset error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Password reset link sent to your email',
    });
  } catch (err) {
    console.error('Password reset error:', err);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
