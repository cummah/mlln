import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: 'CAPTCHA token is required' },
        { status: 400 }
      );
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: token,
      }),
    });

    const data = await response.json() as {
      success: boolean;
      challenge_ts?: string;
      hostname?: string;
      error_codes?: string[];
    };

    if (!data.success) {
      console.error('CAPTCHA verification failed:', data.error_codes);
      return NextResponse.json(
        { error: 'CAPTCHA verification failed. Please try again.' },
        { status: 400 }
      );
    }

    // Verify hostname matches
    const expectedHostname = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').hostname;
    if (data.hostname && !data.hostname.includes(expectedHostname)) {
      console.error('CAPTCHA hostname mismatch:', data.hostname, expectedHostname);
      return NextResponse.json(
        { error: 'CAPTCHA verification failed. Hostname mismatch.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('CAPTCHA verification error:', err);
    return NextResponse.json(
      { error: 'An error occurred during CAPTCHA verification' },
      { status: 500 }
    );
  }
}
