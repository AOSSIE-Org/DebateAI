import {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { userAtom } from "@/state/userAtom";
import { normalizeUser } from "@/utils/normalizeUser";

const baseURL = import.meta.env.VITE_BASE_URL;
const USER_CACHE_KEY = "userProfile";

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  handleError: (error: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  signup: (email: string, password: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const setUser = useSetAtom(userAtom);

  const handleError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    setError(message);
    throw error;
  };

  let currentRequest = 0;
  const verifyToken = useCallback(async () => {
    const requestId = ++currentRequest;

    const storedToken = localStorage.getItem("token");
    if (!storedToken) return;

    try {
      const response = await fetch(`${baseURL}/verifyToken`, {
        method: "POST",
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      // ignore if outdated
      if (requestId !== currentRequest) return;

      if (!response.ok) {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
        navigate("/login");
        return;
      }

      setToken(storedToken);

      const userResponse = await fetch(`${baseURL}/user/fetchprofile`, {
        method: "GET",
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      // ignore if outdated
      if (requestId !== currentRequest) return;

      if (userResponse.ok) {
        const responseData = await userResponse.json();

        // ignore if outdated
        if (requestId !== currentRequest) return;

        const userData = responseData.profile;

        const normalizedUser = normalizeUser(userData);

        // final safety check
        if (requestId !== currentRequest) return;

        setUser(normalizedUser);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(normalizedUser));
      }
    } catch (error) {
      console.log("error", error);
      logout();
    }
  }, [setUser]);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${baseURL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Login failed");

      setToken(data.accessToken);
      localStorage.setItem("token", data.accessToken);
      // Set user details in userAtom based on the new User type
     
      const normalizedUser = normalizeUser(data.user, { email });

      setUser(normalizedUser);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(normalizedUser));
      navigate("/");
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${baseURL}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Signup failed");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (email: string, code: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${baseURL}/verifyEmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, confirmationCode: code }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Verification failed");
      }

      const data = await response.json();

      // User is now verified and logged in
      if (data.accessToken) {
        setToken(data.accessToken);
        localStorage.setItem("token", data.accessToken);

        // Set user details

        const normalizedUser = normalizeUser(data.user, {
          email,
          isVerified: true,
          rating: 1200,
          clearVerificationCode: true,
        });
        setUser(normalizedUser);
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(normalizedUser));
        navigate("/");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${baseURL}/forgotPassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Password reset failed");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const confirmForgotPassword = async (
    email: string,
    code: string,
    newPassword: string,
  ) => {
    setLoading(true);
    try {
      const response = await fetch(`${baseURL}/confirmForgotPassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Password update failed");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (idToken: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${baseURL}/googleLogin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Google login failed");

      setToken(data.accessToken);
      localStorage.setItem("token", data.accessToken);
      // Set user details in userAtom based on the new User type
    
      const normalizedUser = normalizeUser(data.user, {
        displayName: "Google User",
        isVerified: true,
        clearVerificationCode: true,
      });
      setUser(normalizedUser);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(normalizedUser));
      console.log("User after Google login:", data.user);
      navigate("/");
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem(USER_CACHE_KEY);
    setUser(null); // Clear userAtom on logout
    navigate("/auth");
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
