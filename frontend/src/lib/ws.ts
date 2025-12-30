export const WS_BASE = import.meta.env.VITE_WS_URL || (() => {
  const base = import.meta.env.VITE_BASE_URL || window.location.origin;
  return base.replace(/^https?/, (m: string) => (m === 'https' ? 'wss' : 'ws'));
})();

export function buildWsUrl(path: string, query?: Record<string, string | undefined>) {
  const url = new URL(path, WS_BASE);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}
