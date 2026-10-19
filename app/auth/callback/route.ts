import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  try {
    if (code) {
      const supabase = await createClient();
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

      if (sessionError) {
        console.error('Session exchange error:', sessionError);
        return NextResponse.redirect(new URL('/login', request.url));
      }

      // Get the user and ensure profile exists
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          console.error('Profile fetch error:', fetchError);
        }

        if (!profile) {
          // Profile doesn't exist, create it
          const { error: insertError } = await supabase.from('profiles').insert([{ user_id: user.id, tier: 0 }]);
          if (insertError) {
            console.error('Profile creation error:', insertError);
          }
        }
      }
    }
  } catch (err) {
    console.error('Callback error:', err);
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL('/account', request.url));
}
