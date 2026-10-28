import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, authRateLimiters } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const limitCheck = checkRateLimit(req, authRateLimiters.changeEmail);
  if (limitCheck) return limitCheck;

  try {
    const { newEmail } = await req.json();

    if (!newEmail) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { error } = await supabase.auth.updateUser({
      email: newEmail,
    });

    if (error) {
      console.error('Email change error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Email change confirmation sent to your new email address',
    });
  } catch (err) {
    console.error('Email change error:', err);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
