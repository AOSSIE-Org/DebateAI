// Lightweight Sentry wrapper. Initialization is optional and controlled by Vite env var VITE_SENTRY_DSN.
// This module intentionally avoids throwing when Sentry isn't installed or DNS is missing.
let sentryInitialized = false;

export function initSentry() {
  try {
    // Use dynamic import to avoid forcing the dependency at runtime if not installed
    const dsn = (import.meta as any).env?.VITE_SENTRY_DSN;
    if (!dsn) return false;
    // dynamic import so builds that don't include @sentry won't fail at parse-time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/react');
    const Tracing = require('@sentry/tracing');
    Sentry.init({
      dsn,
      integrations: [new Tracing.BrowserTracing()],
      tracesSampleRate: 0.05,
    });
    sentryInitialized = true;
    return true;
  } catch (e) {
    // If Sentry isn't installed or init fails, we don't want to block the app
    // eslint-disable-next-line no-console
    console.warn('Sentry init skipped or failed', e);
    sentryInitialized = false;
    return false;
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>) {
  try {
    if (!sentryInitialized) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/react');
    Sentry.captureException(err, { extra: context });
  } catch (e) {
    // swallow — reporting must never crash the app
    // eslint-disable-next-line no-console
    console.warn('Sentry capture failed', e);
  }
}

export function isSentryEnabled() {
  return sentryInitialized;
}
