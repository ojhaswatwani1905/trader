/**
 * Security and origin validation utilities for postMessage communication
 * between Trader and the parent host (BETADRiX).
 */

const ALLOWED_ORIGINS: (string | RegExp)[] = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'https://demo-m4tn.onrender.com',
  // Allow local development ports
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

export function getCustomOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  const envOrigin = process.env.NEXT_PUBLIC_BETADRIX_ORIGIN;
  if (envOrigin && envOrigin.trim() !== '' && envOrigin !== '*') {
    return envOrigin.trim().replace(/\/$/, '');
  }
  return null;
}

/**
 * Validates if an incoming event.origin is an authorized BETADRiX host origin.
 */
export function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;

  const customOrigin = getCustomOrigin();
  if (customOrigin && origin === customOrigin) {
    return true;
  }

  // Also allow same-origin if running in iframe on same domain (e.g. test harness)
  if (typeof window !== 'undefined' && window.location.origin === origin) {
    return true;
  }

  return ALLOWED_ORIGINS.some((allowed) => {
    if (typeof allowed === 'string') {
      return origin === allowed;
    }
    return allowed.test(origin);
  });
}

/**
 * Resolves safe targetOrigin for outbound postMessage.
 * Never returns '*' in production.
 */
export function getSafeTargetOrigin(detectedOrigin?: string | null): string {
  const customOrigin = getCustomOrigin();
  if (customOrigin) return customOrigin;

  if (detectedOrigin && isAllowedOrigin(detectedOrigin)) {
    return detectedOrigin;
  }

  // If inside an iframe, attempt to resolve parent origin from document.referrer
  if (typeof document !== 'undefined' && document.referrer) {
    try {
      const refOrigin = new URL(document.referrer).origin;
      if (isAllowedOrigin(refOrigin)) {
        return refOrigin;
      }
    } catch {}
  }

  // Fallback to trusted production BETADRiX host
  return 'https://demo-m4tn.onrender.com';
}

/**
 * Validates that house edge is a finite numeric value between 0.00% and 50.00%.
 * Rejects negative numbers, NaN, Infinity, strings, booleans, and null/undefined.
 * Normalizes valid numbers to 2 decimal places.
 */
export function validateHouseEdge(val: unknown): { valid: boolean; normalized?: number; error?: string } {
  if (typeof val !== 'number') {
    return { valid: false, error: 'House edge must be a numeric value.' };
  }
  if (Number.isNaN(val)) {
    return { valid: false, error: 'House edge cannot be NaN.' };
  }
  if (!Number.isFinite(val)) {
    return { valid: false, error: 'House edge cannot be Infinity.' };
  }
  if (val < 0 || val > 50) {
    return { valid: false, error: 'House edge must be within safe range [0, 50].' };
  }

  // Normalize to 2 decimal places
  const normalized = Math.round(val * 100) / 100;
  return { valid: true, normalized };
}

/**
 * Validates economics configuration version.
 * Must be a positive integer >= 1.
 */
export function validateEconomicsVersion(val: unknown): { valid: boolean; normalized?: number; error?: string } {
  if (typeof val !== 'number' || !Number.isInteger(val) || val <= 0) {
    return { valid: false, error: 'Economics version must be a positive integer.' };
  }
  return { valid: true, normalized: val };
}
