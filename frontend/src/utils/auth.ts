import { setLocalString, getLocalString, setLocalJSON } from './storage';

export const setAuthToken = (token: string) => {
  setLocalString('token', token);
};

export const getAuthToken = (): string | null => {
  return getLocalString('token');
};

export const clearAuthToken = () => {
  try {
    localStorage.removeItem('token');
  } catch {}
};