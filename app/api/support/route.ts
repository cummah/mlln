import { getSupabaseClient } from '@/lib/supabase';
import { checkRateLimit, authRateLimiters } from '@/lib/rate-limit';

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('[support] Turnstile secret not configured');
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (err) {
    console.error('[support] Turnstile verification failed:', err);
    return false;
  }
}

async function sendEmail(email: string, subject: string, message: string): Promise<boolean> {
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@mlln.ai';

  try {
    const supabase = getSupabaseClient();
    await supabase.auth.admin.sendEmail({
      email: supportEmail,
      subject: `Support: ${subject}`,
      html: `
        <p><strong>From:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr />
        <p>${message.replace(/\n/g, '<br />')}</p>
      `,
    });

    return true;
  } catch (err) {
    console.error('[support] Email send failed:', err);
    return false;
  }
}

export async function POST(request: Request) {
  const rateLimitResponse = checkRateLimit(request, authRateLimiters.support);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await request.json();
    const { email, subject, message, captchaToken } = body;

    if (!email || !subject || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (typeof email !== 'string' || typeof subject !== 'string' || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid field types' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (message.length > 5000) {
      return new Response(JSON.stringify({ error: 'Message too long' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (captchaToken) {
      const isValid = await verifyTurnstile(captchaToken);
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'CAPTCHA verification failed' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('support_messages').insert({
      email,
      subject,
      message,
    });

    if (error) {
      console.error('[support] Database insert failed:', error);
      return new Response(JSON.stringify({ error: 'Failed to store message' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await sendEmail(email, subject, message);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[support] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
