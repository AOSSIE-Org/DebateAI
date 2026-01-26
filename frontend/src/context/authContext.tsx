
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

const baseURL = import.meta.env.VITE_BASE_URL;
const USER_CACHE_KEY = 'userProfile';

/* ---------- Types ---------- */

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  handleError: (error: unknown) => never;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  signup: (email: string, password: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (
    email: string,
    code: string,
    newPassword: string
  ) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

/* ---------- Helpers ---------- */

const safeJson = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return await response.json();
  }
  return null;
};

const normalizeUser = (data: any, fallbackEmail?: string): User => ({
  id: data?.id || data?._id,
  email: data?.email || fallbackEmail || '',
  displayName: data?.displayName || 'User',
  bio: data?.bio || '',
  rating: data?.rating || 1500,
  rd: data?.rd || 350,
  volatility: data?.volatility || 0.06,
  lastRatingUpdate: data?.lastRatingUpdate || new Date().toISOString(),
  avatarUrl:
    data?.avatarUrl || 'https://avatar.iran.liara.run/public/10',
  twitter: data?.twitter,
  instagram: data?.instagram,
  linkedin: data?.linkedin,
  password: '',
  nickname: data?.nickname || 'User',
  isVerified: data?.isVerified || false,
  verificationCode: data?.verificationCode,
  resetPasswordCode: data?.resetPasswordCode,
  createdAt: data?.createdAt || new Date().toISOString(),
  updatedAt: data?.updatedAt || new Date().toISOString(),
});

/* ---------- Provider ---------- */

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const setUser = useSetAtom(userAtom);

  const handleError = (err: unknown): never => {
    const message =
      err instanceof Error ? err.message : 'Something went wrong';
    setError(message);
    throw err;
  };

  /* ---------- Token Verification ---------- */

  const verifyToken = useCallback(async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) return;

    try {
      const res = await fetch(`${baseURL}/verifyToken`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      if (!res.ok) throw new Error('Session expired');

      const userRes = await fetch(`${baseURL}/user/fetchprofile`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      const userData = await safeJson(userRes);
      if (userData) {
        const user = normalizeUser(userData);
        setUser(user);
        setToken(storedToken);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      }
    } catch {
      logout();
    }
  }, []);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  /* ---------- Auth Actions ---------- */

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${baseURL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await safeJson(res);
      // if (!res.ok) throw new Error(data?.message || 'Login failed');

      if (!res.ok) {
        let message = 'Invalid email or password';
      
        try {
          const data = JSON.parse(await res.text());
          message = data.message || data.error || message;
        } catch {}
      
        throw new Error(message);
      }
      
      setToken(data.accessToken);
      localStorage.setItem('token', data.accessToken);

      const user = normalizeUser(data.user, email);
      setUser(user);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      navigate('/');
    } catch (e) {
      handleError(e);
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

      if (!res.ok) {
        let message = 'Signup failed';
      
        try {
          const data = JSON.parse(await res.text());
          message = data.message || data.error || message;
        } catch {
          // response was not JSON
        }
      
        throw new Error(message);
      }      
    } catch (e) {
      handleError(e);
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
      if (!res.ok) throw new Error(data?.error || 'Verification failed');

      setToken(data.accessToken);
      localStorage.setItem('token', data.accessToken);

      const user = normalizeUser(data.user, email);
      setUser(user);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      navigate('/');
    } catch (e) {
      handleError(e);
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

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Password reset failed');
      }
    } catch (e) {
      handleError(e);
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

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Password update failed');
      }
    } catch (e) {
      handleError(e);
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
      if (!res.ok) throw new Error(data?.message || 'Google login failed');

      setToken(data.accessToken);
      localStorage.setItem('token', data.accessToken);

      const user = normalizeUser(data.user);
      setUser(user);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
      navigate('/');
    } catch (e) {
      handleError(e);
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
        handleError,
        login,
        logout,
        signup,
        verifyEmail,
        forgotPassword,
        confirmForgotPassword,
        googleLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
