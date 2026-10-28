import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, authRateLimiters } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const limitCheck = checkRateLimit(req, authRateLimiters.signup);
  if (limitCheck) return limitCheck;

  try {
    const { email, password, display_name, captchaToken } = await req.json();

    if (!email || !password) {
      return Response.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
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
          return Response.json(
            { error: 'CAPTCHA verification failed' },
            { status: 400 }
          );
        }
      } catch (err) {
        console.error('CAPTCHA verification error:', err);
        return Response.json(
          { error: 'CAPTCHA verification failed' },
          { status: 400 }
        );
      }
    }

    if (password.length < 6) {
      return Response.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Sign up user
    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        data: {
          display_name,
        },
      },
    });

    if (signupError) {
      console.error('Signup error:', signupError);
      return Response.json(
        { error: signupError.message || 'Signup failed' },
        { status: 400 }
      );
    }

    if (!data.user) {
      return Response.json(
        { error: 'User creation failed' },
        { status: 500 }
      );
    }

    // Upsert profile with display_name (handles both create and update)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: data.user.id,
          display_name,
          tier: 0
        },
        { onConflict: 'user_id' }
      );

    if (profileError) {
      console.error('Profile upsert error:', profileError);
      // Log but don't fail - user can update display_name on account page
    }

    return Response.json({
      message: 'Signup successful! Check your email for verification.',
      user: data.user,
    });
  } catch (err) {
    console.error('Signup error:', err);
    return Response.json(
      { error: 'An error occurred during signup' },
      { status: 500 }
    );
  }
}
