export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initSentry } = await import('./sentry.config');
    initSentry();
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const { initSentry } = await import('./sentry.config');
    initSentry();
  }
}
