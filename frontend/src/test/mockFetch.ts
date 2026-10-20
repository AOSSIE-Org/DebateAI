import { vi } from 'vitest';

type Route = {
  match: string | RegExp;
  method?: string;
  status?: number;
  /** A value, or a function called per request (for responses that change). */
  body?: unknown | (() => unknown);
};

/**
 * Stubs global fetch with a small route table. The first route whose
 * pattern matches the URL (and method, if given) answers the request;
 * anything else returns 404.
 */
export function mockFetch(routes: Route[]) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const route = routes.find(
      (r) =>
        (typeof r.match === 'string' ? url.includes(r.match) : r.match.test(url)) &&
        (!r.method || r.method.toUpperCase() === method)
    );
    const status = route ? route.status ?? 200 : 404;
    const raw = route ? route.body ?? {} : { error: 'not found' };
    const body = typeof raw === 'function' ? (raw as () => unknown)() : raw;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
