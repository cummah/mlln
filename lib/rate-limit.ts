const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function getRateLimiter(windowMs: number = 60000, maxRequests: number = 10) {
  return function rateLimit(identifier: string): { remaining: number; retryAfter?: number } {
    const now = Date.now();
    const key = `${identifier}`;
    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      rateLimitStore.set(key, record);
    }

    record.count++;

    if (record.count > maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return { remaining: 0, retryAfter };
    }

    return { remaining: maxRequests - record.count };
  };
}

export function checkRateLimit(
  request: Request,
  limiter: ReturnType<typeof getRateLimiter>
): Response | null {
  const ip = request.headers.get('x-forwarded-for') ||
             request.headers.get('x-real-ip') ||
             'unknown';

  const result = limiter(ip);

  if (result.remaining === 0) {
    return new Response(
      JSON.stringify({ error: 'Too many requests' }),
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter || 60),
          'Content-Type': 'application/json',
        },
      }
    );
  }

  return null;
}

export const authRateLimiters = {
  signup: getRateLimiter(3600000, 5),           // 5 per hour
  passwordReset: getRateLimiter(86400000, 3),  // 3 per day
  changeEmail: getRateLimiter(86400000, 5),    // 5 per day
  deleteAccount: getRateLimiter(3600000, 1),   // 1 per hour
  login: getRateLimiter(900000, 10),           // 10 per 15 min
};
