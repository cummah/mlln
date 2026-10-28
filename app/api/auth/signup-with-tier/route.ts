import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, authRateLimiters } from '@/lib/rate-limit';

const TIER_URLS: Record<number, string> = {
  1: 'https://checkout.revolut.com/subscription/f92bd163-11be-478a-b099-0f3e9f79f1f6',
  2: 'https://checkout.revolut.com/subscription/f26a5883-3dab-4dce-917f-293d55667f32',
  3: 'https://checkout.revolut.com/subscription/4b2a1e27-98d4-4f4d-98b1-0b6cb9888c4e',
};

export async function POST(req: Request) {
  const limitCheck = checkRateLimit(req, authRateLimiters.signup);
  if (limitCheck) return limitCheck;

  try {
    const { email, password, tier, captchaToken } = await req.json();

    if (!email || !password || !tier || ![1, 2, 3].includes(tier)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    if (captchaToken && process.env.TURNSTILE_SECRET_KEY) {
      try {
        const captchaResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: captchaToken,
          }),
        });

        const captchaData = await captchaResponse.json() as { success: boolean };
        if (!captchaData.success) {
          return NextResponse.json(
            { error: 'CAPTCHA verification failed' },
            { status: 400 }
          );
        }
      } catch (err) {
        console.error('CAPTCHA verification error:', err);
        return NextResponse.json(
          { error: 'CAPTCHA verification failed' },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    // Sign up user
    const { data: authData, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });

    if (signupError || !authData.user?.id) {
      return NextResponse.json({ error: signupError?.message || 'Signup failed' }, { status: 400 });
    }

    // Set pending tier for the newly created user
    // First try to update, if it fails try to insert (in case profile doesn't exist yet)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ pending_tier: tier })
      .eq('user_id', authData.user.id);

    if (updateError) {
      // If update fails, try to create the profile
      const { error: insertError } = await supabase
        .from('profiles')
        .insert([{ user_id: authData.user.id, tier: 0, pending_tier: tier }]);

      if (insertError) {
        console.error('Profile creation error:', insertError);
        return NextResponse.json({ error: 'Failed to create account profile' }, { status: 500 });
      }
    }

    const checkoutUrl = TIER_URLS[tier];

    return NextResponse.json({
      success: true,
      checkoutUrl,
      message: `Account created. Redirecting to ${['Essential', 'Premium', 'Pro'][tier - 1]} checkout...`,
    });
  } catch (err) {
    console.error('Signup with tier error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
