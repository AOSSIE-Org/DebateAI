const OFFICIAL = import.meta.env.VITE_BASE_URL;
const LOCAL_BACKEND = 'http://localhost:1313';
const KEY = 'debateai:server';

// Clean origin, or null if invalid.
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

export const isOfficial = (): boolean => localStorage.getItem(KEY) === null;

// Active backend origin, or null when a custom URL is stored but invalid.
// NEVER falls back to OFFICIAL once a custom value is stored.

export function getServer(): string | null {
  const stored = localStorage.getItem(KEY);

  // If a custom server is selected, use it without falling back.
  if (stored !== null) return normalize(stored);

  // Use the configured official backend if valid.
  const official = normalize(OFFICIAL);
  if (official) return official;

  // Fall back to localhost during development.
  if (import.meta.env.DEV) return LOCAL_BACKEND;

  // No backend configured in production.
  return null;
}


export function serverLabel(): string {
  if (isOfficial()) return 'Official';
  const s = getServer();
  return s ? new URL(s).host : 'Invalid server URL';
}

const clearAuth = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('userProfile');
  localStorage.removeItem('adminToken');
  localStorage.removeItem('admin');
}; // TODO(confirm): use the repo's real auth storage keys: token, userProfile, adminToken, admin

export function setServer(raw: unknown): void {
  const clean = normalize(raw);
  const next = clean ?? String(raw);
  if (localStorage.getItem(KEY) !== next) clearAuth(); // tokens belong to one server
  localStorage.setItem(KEY, next);
}

export function resetServer(): void {
  localStorage.removeItem(KEY);
  clearAuth();
}

function initServer(): void {
  if (typeof window === 'undefined' || typeof location === 'undefined') return;
  const params = new URLSearchParams(location.search);
  if (!params.has('server')) return;

  const p = params.get('server');
  if (p === 'official') resetServer();
  else if (p !== null) setServer(p); // invalid values are stored too, which blocks requests

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
