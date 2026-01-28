import {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { userAtom } from '@/state/userAtom';
import type { User } from '@/types/user';

type ApiErrorPayload = {
  message?: string;
  error?: string;
};

type AuthPayload = {
  accessToken?: string;
  user?: User;
};

const safeJson = async (response: Response): Promise<unknown | null> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const baseURL = import.meta.env.VITE_BASE_URL;
const USER_CACHE_KEY = 'userProfile';

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<{ success: boolean }>;
  signup: (email: string, password: string) => Promise<{ success: boolean }>;
  verifyEmail: (email: string, code: string) => Promise<{ success: boolean }>;
  forgotPassword: (email: string) => Promise<{ success: boolean }>;
  confirmForgotPassword: (
    email: string,
    code: string,
    newPassword: string
  ) => Promise<{ success: boolean }>;
  googleLogin: (idToken: string) => Promise<{ success: boolean }>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const setUser = useSetAtom(userAtom);

  const setApiError = (data: unknown, fallback: string): never => {
    const payload = data as ApiErrorPayload | null;
    throw new Error(payload?.message || payload?.error || fallback);
  };

  const verifyToken = useCallback(async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;

    try {
      const res = await fetch(`${baseURL}/verifyToken`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      const data = await safeJson(res);
      if (!res.ok) setApiError(data, 'Token verification failed');

      const profileRes = await fetch(`${baseURL}/user/fetchprofile`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      const profileData = await safeJson(profileRes);
      if (!profileRes.ok) setApiError(profileData, 'Failed to fetch profile');

      const user = profileData as User;
      if (!user?.email || (!user.id && !(user as any)._id)) {
        throw new Error('Invalid user payload');
      }

      setToken(storedToken);
      setUser(user);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } catch {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      navigate('/login');
    }
  }, [navigate, setUser]);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${baseURL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await safeJson(res);
      if (!res.ok) setApiError(data, 'Login failed');

      const payload = data as AuthPayload;
      if (!payload.accessToken || !payload.user?.email) {
        throw new Error('Invalid auth payload');
      }

      setToken(payload.accessToken);
      localStorage.setItem('token', payload.accessToken);
      setUser(payload.user);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(payload.user));
      navigate('/');

      return { success: true };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${baseURL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await safeJson(res);
      if (!res.ok) setApiError(data, 'Signup failed');

      return { success: true };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (email: string, code: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${baseURL}/verifyEmail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, confirmationCode: code }),
      });

      const data = await safeJson(res);
      if (!res.ok) setApiError(data, 'Verification failed');

      return { success: true };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${baseURL}/forgotPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await safeJson(res);
      if (!res.ok) setApiError(data, 'Password reset failed');

      return { success: true };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const confirmForgotPassword = async (
    email: string,
    code: string,
    newPassword: string
  ) => {
    setLoading(true);
    try {
      const res = await fetch(`${baseURL}/confirmForgotPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
      });

      const data = await safeJson(res);
      if (!res.ok) setApiError(data, 'Password update failed');

      return { success: true };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password update failed');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (idToken: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${baseURL}/googleLogin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const data = await safeJson(res);
      if (!res.ok) setApiError(data, 'Google login failed');

      const payload = data as AuthPayload;
      if (!payload.accessToken || !payload.user?.email) {
        throw new Error('Invalid auth payload');
      }

      setToken(payload.accessToken);
      localStorage.setItem('token', payload.accessToken);
      setUser(payload.user);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(payload.user));
      navigate('/');

      return { success: true };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem(USER_CACHE_KEY);
    navigate('/auth');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
        loading,
        error,
        login,
        signup,
        verifyEmail,
        forgotPassword,
        confirmForgotPassword,
        googleLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
