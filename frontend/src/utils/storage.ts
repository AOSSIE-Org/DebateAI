export const getLocalString = (key: string, fallback: string | null = null): string | null => {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (err) {
    console.error('Failed to read from localStorage', key, err);
    return fallback;
  }
};

export const getLocalJSON = <T = unknown>(key: string, fallback: T | null = null): T | null => {
  const raw = getLocalString(key, null);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Failed to parse JSON from localStorage key=${key}`, err);
    try {
      localStorage.removeItem(key);
    } catch (e) {
      /* ignore */
    }
    return fallback;
  }
};

export const setLocalJSON = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('Failed to write JSON to localStorage', key, err);
  }
};

export const setLocalString = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.error('Failed to write to localStorage', key, err);
  }
};
