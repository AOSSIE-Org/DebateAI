export const safeParse = <T = unknown>(raw: unknown, fallback: T | null = null): T | null => {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return (raw as unknown) as T;
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn('safeParse failed to parse JSON:', err);
    return fallback;
  }
};

export default safeParse;
