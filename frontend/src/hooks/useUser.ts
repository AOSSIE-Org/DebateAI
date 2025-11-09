import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '../state/userAtom';
import { useContext } from 'react';
import { AuthContext } from '../context/authContext';

export const useUser = () => {
  const [user, setUser] = useAtom(userAtom);
  const authContext = useContext(AuthContext);

  // If user is null but we have a token, try to fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user && authContext?.token && !authContext?.loading) {
        try {
          const response = await fetch(`${import.meta.env.VITE_BASE_URL}/user/fetchprofile`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${authContext.token}` },
          });
          
          if (response.ok) {
            const userData = await response.json();
            const profile =
              (userData.profile && typeof userData.profile === 'object'
                ? userData.profile
                : userData) ?? {};
            setUser({
              id: profile.id || userData.id,
              email: profile.email || userData.email,
              displayName: profile.displayName || userData.displayName || 'User',
              bio: profile.bio || userData.bio || '',
              rating: profile.rating || userData.rating || 1500,
              rd: profile.rd || userData.rd || 350,
              volatility: profile.volatility || userData.volatility || 0.06,
              lastRatingUpdate:
                profile.lastRatingUpdate ||
                userData.lastRatingUpdate ||
                new Date().toISOString(),
              avatarUrl:
                profile.avatarUrl ||
                userData.avatarUrl ||
                'https://avatar.iran.liara.run/public/10',
              twitter: profile.twitter || userData.twitter,
              instagram: profile.instagram || userData.instagram,
              linkedin: profile.linkedin || userData.linkedin,
              password: '',
              nickname: profile.nickname || userData.nickname || 'User',
              isVerified: profile.isVerified || userData.isVerified || false,
              verificationCode: profile.verificationCode || userData.verificationCode,
              resetPasswordCode:
                profile.resetPasswordCode || userData.resetPasswordCode,
              createdAt: profile.createdAt || userData.createdAt || new Date().toISOString(),
              updatedAt: profile.updatedAt || userData.updatedAt || new Date().toISOString(),
            });
          }
        } catch (error) {
        }
      }
    };

    fetchUserData();
  }, [user, authContext?.token, authContext?.loading, setUser]);

  return {
    user,
    setUser,
    isLoading: authContext?.loading || (!user && !!authContext?.token),
    isAuthenticated: !!authContext?.token,
  };
};
