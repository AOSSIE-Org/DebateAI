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
            setUser({
              id: userData.profile?.id || userData.id,
              email: userData.profile?.email || userData.email,
              displayName: userData.profile?.displayName || userData.displayName || 'User',
              bio: userData.profile?.bio || userData.bio || '',
              rating: userData.profile?.rating || userData.rating || 1500,
              rd: userData.rd || 350,
              volatility: userData.volatility || 0.06,
              lastRatingUpdate: userData.lastRatingUpdate || new Date().toISOString(),
              avatarUrl: userData.profile?.avatarUrl || userData.avatarUrl || 'https://avatar.iran.liara.run/public/10',
              twitter: userData.profile?.twitter || userData.twitter,
              instagram: userData.profile?.instagram || userData.instagram,
              linkedin: userData.profile?.linkedin || userData.linkedin,
              password: '',
              nickname: userData.nickname || 'User',
              isVerified: userData.isVerified || false,
              verificationCode: userData.verificationCode,
              resetPasswordCode: userData.resetPasswordCode,
              createdAt: userData.createdAt || new Date().toISOString(),
              updatedAt: userData.updatedAt || new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('Failed to fetch user data:', error);
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
