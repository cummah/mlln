export const CONSENT_COOKIE_NAME = 'mlln_consent';

export function getConsentFromCookie(cookieString?: string): boolean {
  if (!cookieString && typeof document !== 'undefined') {
    cookieString = document.cookie;
  }
  if (!cookieString) return false;

  const match = cookieString.match(new RegExp(`${CONSENT_COOKIE_NAME}=([^;]+)`));
  if (!match) return false;

  try {
    const value = decodeURIComponent(match[1]);
    const data = JSON.parse(value);
    return data.analytics === true;
  } catch {
    return false;
  }
}

export function setConsentCookie(analytics: boolean) {
  const value = JSON.stringify({ analytics });
  const encodedValue = encodeURIComponent(value);
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  document.cookie = `${CONSENT_COOKIE_NAME}=${encodedValue}; path=/; expires=${expiryDate.toUTCString()}; SameSite=Lax`;
}

export function getRejectionCookie(cookieString?: string): boolean {
  if (!cookieString && typeof document !== 'undefined') {
    cookieString = document.cookie;
  }
  if (!cookieString) return false;

  const match = cookieString.match(new RegExp(`${CONSENT_COOKIE_NAME}=([^;]+)`));
  return match !== null;
}
