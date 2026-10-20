import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { email, password, display_name } = await req.json();

    if (!email || !password || !display_name) {
      return Response.json(
        { error: 'Email, password, and display name are required' },
        { status: 400 }
      );
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

    // Update profile with display_name
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name })
      .eq('user_id', data.user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      // Don't fail the signup if profile update fails, user can update it later
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
