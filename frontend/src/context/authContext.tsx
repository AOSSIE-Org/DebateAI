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
import type { User } from "@/types/user";
import { toast } from "@/hooks/use-toast";

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
    newPassword: string
  ) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const setUser = useSetAtom(userAtom);

  const handleError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    setError(message);
    toast({
      variant: "destructive",
      title: "Authentication Error",
      description: message,
    });
    throw error;
  };

  const verifyToken = useCallback(async () => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) return;
    try {
      const response = await fetch(`${baseURL}/verifyToken`, {
        method: "POST",
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      if (!response.ok) {
        // Token is expired or invalid - clear it and redirect to login
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
        navigate("/login");
        return;
      }
      setToken(storedToken);

      // Fetch user data to populate userAtom
      const userResponse = await fetch(`${baseURL}/user/fetchprofile`, {
        method: "GET",
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        const normalizedUser: User = {
          id: userData.id || userData._id,
          email: userData.email,
          displayName: userData.displayName || "User",
          bio: userData.bio || "",
          rating: userData.rating || 1500,
          rd: userData.rd || 350,
          volatility: userData.volatility || 0.06,
          lastRatingUpdate:
            userData.lastRatingUpdate || new Date().toISOString(),
          avatarUrl:
            userData.avatarUrl || "https://avatar.iran.liara.run/public/10",
          twitter: userData.twitter,
          instagram: userData.instagram,
          linkedin: userData.linkedin,
          password: "",
          nickname: userData.nickname || "User",
          isVerified: userData.isVerified || false,
          verificationCode: userData.verificationCode,
          resetPasswordCode: userData.resetPasswordCode,
          createdAt: userData.createdAt || new Date().toISOString(),
          updatedAt: userData.updatedAt || new Date().toISOString(),
        };
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
      const normalizedUser: User = {
        id: data.user?.id || data.user?._id || undefined,
        email: data.user?.email || email,
        displayName: data.user?.displayName || "User",
        bio: data.user?.bio || "",
        rating: data.user?.rating || 1500,
        rd: data.user?.rd || 350, // Default Glicko-2 RD value
        volatility: data.user?.volatility || 0.06, // Default Glicko-2 volatility
        lastRatingUpdate:
          data.user?.lastRatingUpdate || new Date().toISOString(),
        avatarUrl:
          data.user?.avatarUrl || "https://avatar.iran.liara.run/public/10",
        twitter: data.user?.twitter || undefined,
        instagram: data.user?.instagram || undefined,
        linkedin: data.user?.linkedin || undefined,
        password: "", // Password should not be stored in client-side state
        nickname: data.user?.nickname || "User",
        isVerified: data.user?.isVerified || false,
        verificationCode: data.user?.verificationCode || undefined,
        resetPasswordCode: data.user?.resetPasswordCode || undefined,
        createdAt: data.user?.createdAt || new Date().toISOString(),
        updatedAt: data.user?.updatedAt || new Date().toISOString(),
      };
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
        const normalizedUser: User = {
          id: data.user?.id || data.user?._id || undefined,
          email: data.user?.email || email,
          displayName: data.user?.displayName || "User",
          bio: data.user?.bio || "",
          rating: data.user?.rating || 1200,
          rd: data.user?.rd || 350,
          volatility: data.user?.volatility || 0.06,
          lastRatingUpdate:
            data.user?.lastRatingUpdate || new Date().toISOString(),
          avatarUrl:
            data.user?.avatarUrl || "https://avatar.iran.liara.run/public/10",
          twitter: data.user?.twitter || undefined,
          instagram: data.user?.instagram || undefined,
          linkedin: data.user?.linkedin || undefined,
          password: "",
          nickname: data.user?.nickname || "User",
          isVerified: true,
          verificationCode: undefined,
          resetPasswordCode: undefined,
          createdAt: data.user?.createdAt || new Date().toISOString(),
          updatedAt: data.user?.updatedAt || new Date().toISOString(),
        };
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
    newPassword: string
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
      const normalizedUser: User = {
        id: data.user?.id || data.user?._id || undefined,
        email: data.user?.email || "googleuser@example.com",
        displayName: data.user?.displayName || "Google User",
        bio: data.user?.bio || "",
        rating: data.user?.rating || 1500,
        rd: data.user?.rd || 350,
        volatility: data.user?.volatility || 0.06,
        lastRatingUpdate:
          data.user?.lastRatingUpdate || new Date().toISOString(),
        avatarUrl:
          data.user?.avatarUrl || "https://avatar.iran.liara.run/public/10",
        twitter: data.user?.twitter || undefined,
        instagram: data.user?.instagram || undefined,
        linkedin: data.user?.linkedin || undefined,
        password: "",
        nickname: data.user?.nickname || "Google User",
        isVerified: data.user?.isVerified || true, // Google login often implies verified
        verificationCode: data.user?.verificationCode || undefined,
        resetPasswordCode: data.user?.resetPasswordCode || undefined,
        createdAt: data.user?.createdAt || new Date().toISOString(),
        updatedAt: data.user?.updatedAt || new Date().toISOString(),
      };
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
