import { useEffect, useContext } from "react";
import { useAtom } from "jotai";
import { userAtom } from "../state/userAtom";
import { AuthContext } from "../context/authContext";

const USER_CACHE_KEY = "userProfile";
const DEFAULT_AVATAR = "https://avatar.iran.liara.run/public/10";
const DEFAULT_RATING = 1500;
const DEFAULT_RD = 350;
const DEFAULT_VOLATILITY = 0.06;

export const useUser = () => {
  const [user, setUser] = useAtom(userAtom);
  const authContext = useContext(AuthContext);

  // Hydrate from localStorage if available
  useEffect(() => {
    if (!user) {
      const cachedUser = localStorage.getItem(USER_CACHE_KEY);
      if (cachedUser) {
        try {
          const parsedUser = JSON.parse(cachedUser);
          setUser(parsedUser);
        } catch (error) {
          console.error("Failed to parse cached user profile:", error);
          localStorage.removeItem(USER_CACHE_KEY);
        }
      }
    }
  }, [user, setUser]);

  useEffect(() => {
    const fetchUserData = async () => {
      const token = authContext?.token || localStorage.getItem("token");
      if (!token || authContext?.loading) return;
      if (user?.email) return;

      try {
        const baseUrl = import.meta.env.VITE_BASE_URL || "http://localhost:1313";
        const response = await fetch(`${baseUrl}/user/fetchprofile`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(`Fetch profile failed with status ${response.status}`);
        }

        const userData = await response.json();
        const profile = userData.profile || {};

        const normalizedUser = {
          id:
            profile.id ||
            profile._id ||
            userData.id ||
            userData._id ||
            "",
          email: profile.email || userData.email || "",
          displayName:
            profile.displayName ||
            userData.displayName ||
            "User",
          bio: profile.bio || userData.bio || "",
          rating:
            profile.rating ||
            userData.rating ||
            DEFAULT_RATING,
          rd: userData.rd || DEFAULT_RD,
          volatility: userData.volatility || DEFAULT_VOLATILITY,
          lastRatingUpdate:
            userData.lastRatingUpdate || new Date().toISOString(),
          avatarUrl:
            profile.avatarUrl ||
            userData.avatarUrl ||
            DEFAULT_AVATAR,
          twitter: profile.twitter || userData.twitter,
          instagram: profile.instagram || userData.instagram,
          linkedin: profile.linkedin || userData.linkedin,
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
      } catch (error) {
        console.error("Failed to fetch user data:", error);
      }
    };

    fetchUserData();
  }, [
    user,
    setUser,
    authContext?.token,
    authContext?.loading,
  ]);

  return {
    user,
    setUser,
    isLoading:
      authContext?.loading ||
      (!user && !!(authContext?.token || localStorage.getItem("token"))),
    isAuthenticated: !!(authContext?.token || localStorage.getItem("token")),
  };
};
