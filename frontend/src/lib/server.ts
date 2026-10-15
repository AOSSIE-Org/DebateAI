const OFFICIAL = import.meta.env.VITE_BASE_URL;
const KEY = 'debateai:server';
const CONFIRMED_KEY = 'debateai:server_confirmed';

function safeGetItem(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Storage access disabled or quota exceeded
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage access disabled
  }
}

// Clean origin, or null if invalid. https only (http allowed for localhost).
export function normalize(raw: unknown): string | null {
  if (!raw) return null;
  try {
    const u = new URL(String(raw).trim());
    const local = ['localhost', '127.0.0.1'].includes(u.hostname);
    if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export const isOfficial = (): boolean => safeGetItem(KEY) === null;

export const isConfirmed = (): boolean => {
  if (isOfficial()) return true;
  return safeGetItem(CONFIRMED_KEY) === 'true';
};

// Active backend origin, or null when a custom URL is stored but invalid or unconfirmed.
// NEVER falls back to OFFICIAL once a custom value is stored.
export function getServer(): string | null {
  const stored = safeGetItem(KEY);
  if (stored === null) return OFFICIAL ?? null;
  if (!isConfirmed()) return null;
  return normalize(stored);
}

export function serverLabel(): string {
  if (isOfficial()) return 'Official';
  const stored = safeGetItem(KEY);
  if (!isConfirmed()) {
    const host = stored ? (normalize(stored) ? new URL(normalize(stored)!).host : stored) : '';
    return host ? `Unconfirmed server: ${host}` : 'Unconfirmed server';
  }
  const s = getServer();
  return s ? new URL(s).host : 'Invalid server URL';
}

const clearAuth = (): void => {
  safeRemoveItem('token');
  safeRemoveItem('userProfile');
  safeRemoveItem('adminToken');
  safeRemoveItem('admin');
}; // TODO(confirm): use the repo's real auth storage keys: token, userProfile, adminToken, admin

export function setServer(raw: unknown, confirmed = true): void {
  const clean = normalize(raw);
  const next = clean ?? String(raw);
  if (safeGetItem(KEY) !== next) clearAuth(); // tokens belong to one server
  safeSetItem(KEY, next);
  if (confirmed) {
    safeSetItem(CONFIRMED_KEY, 'true');
  } else {
    safeRemoveItem(CONFIRMED_KEY);
  }
}

export function resetServer(): void {
  safeRemoveItem(KEY);
  safeRemoveItem(CONFIRMED_KEY);
  clearAuth();
}

function initServer(): void {
  if (typeof window === 'undefined' || typeof location === 'undefined') return;
  const params = new URLSearchParams(location.search);
  if (!params.has('server')) return;

  const p = params.get('server');
  if (p === 'official') {
    resetServer();
  } else if (p !== null) {
    const clean = normalize(p);
    const target = clean ?? p;
    if (clean && OFFICIAL && clean === normalize(OFFICIAL)) {
      resetServer();
    } else {
      let confirmed = false;
      try {
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
          confirmed = window.confirm(
            `Do you want to connect to the custom server at "${target}"?\n\nWarning: Only connect to servers you trust, as authentication credentials will be sent to this server.`
          );
        }
      } catch {
        confirmed = false;
      }

      setServer(p, confirmed);
    }
  }

  // Clean the address bar. This must never throw, because it runs at import time.
  try {
    const url = new URL(location.href);
    url.searchParams.delete('server');
    const path = url.pathname.replace(/^\/{2,}/, '/'); // "//" would be parsed as a host
    history.replaceState(null, '', path + url.search + url.hash);
  } catch {
    /* cosmetic only: the server choice is already saved above */
  }
}

initServer(); // runs on first import, so nothing reads the URL too early

