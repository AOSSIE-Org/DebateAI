import { initSentry, captureException } from './sentry';

// Attempt to initialize Sentry eagerly — if VITE_SENTRY_DSN isn't set this is a noop.
try {
  initSentry();
} catch (e) {
  // ignore
}

export function reportError(error: Error | unknown, errorInfo?: { componentStack?: string } | null) {
  try {
    // eslint-disable-next-line no-console
    console.error('[Frontend Error]', { message: (error as any)?.message || String(error), stack: (error as any)?.stack, componentStack: errorInfo?.componentStack });

    // Include Sentry capture when available
    try {
      captureException(error, { componentStack: errorInfo?.componentStack });
    } catch (_) {
      // swallow
    }

    // Also try to send to your backend errors endpoint (best-effort)
    const payload = {
      message: (error as any)?.message || String(error),
      stack: (error as any)?.stack,
      componentStack: errorInfo?.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      ts: new Date().toISOString(),
    };

    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        navigator.sendBeacon('/api/frontend/errors', new Blob([body], { type: 'application/json' }));
        return;
      } catch (e) {
        // fallthrough
      }
    }
    if (typeof fetch === 'function') {
      try {
        fetch('/api/frontend/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('reportError failed', e);
  }
}
