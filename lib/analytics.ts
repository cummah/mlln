import { getConsentFromCookie } from '@/lib/consent';

const ALLOWED_EVENTS = new Set([
  'signup',
  'activation',
  'upgrade',
  'downgrade',
  'churn',
]);

export async function trackServerEvent(
  userId: string | null | undefined,
  event: string,
  properties?: Record<string, any>
) {
  if (!ALLOWED_EVENTS.has(event)) {
    console.warn(`[analytics] Unknown event: ${event}`);
    return;
  }

  try {
    const response = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, properties, userId }),
    });

    if (!response.ok) {
      console.error(`[analytics] Failed to track ${event}:`, response.status);
    }
  } catch (err) {
    console.error(`[analytics] Error tracking ${event}:`, err);
  }
}

export function track(event: string, properties?: Record<string, any>) {
  if (typeof window === 'undefined') return;

  if (!getConsentFromCookie()) {
    console.debug(`[analytics] Consent not granted, skipping ${event}`);
    return;
  }

  if (!ALLOWED_EVENTS.has(event)) {
    console.warn(`[analytics] Unknown event: ${event}`);
    return;
  }

  try {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, properties }),
    }).catch(err => console.error(`[analytics] Error tracking ${event}:`, err));
  } catch (err) {
    console.error(`[analytics] Error tracking ${event}:`, err);
  }
}
