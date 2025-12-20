import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import defaultAvatar from '@/assets/avatar2.jpg';

interface ProfilePreview {
  id?: string;
  displayName: string;
  email: string;
  bio?: string;
  rating?: number;
  avatarUrl?: string;
}

interface ProfileHoverProps {
  userId: string;
  children: React.ReactNode;
  className?: string;
}

const ProfileHover: React.FC<ProfileHoverProps> = ({
  userId,
  children,
  className = '',
}) => {
  const [profile, setProfile] = useState<ProfilePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const userIdRef = useRef<string>(userId);
  const baseURL = useMemo(() => import.meta.env.VITE_BASE_URL || 'http://localhost:1313', []);

  // Reset profile when userId changes
  useEffect(() => {
    if (userId !== userIdRef.current) {
      userIdRef.current = userId;
      setProfile(null);
    }
  }, [userId]);

  const fetchProfile = useCallback(async () => {
    const currentUserId = userIdRef.current;
    if (!currentUserId || currentUserId === 'undefined' || currentUserId === 'null') return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const normalizedUserId = String(currentUserId).trim();
      console.log('[ProfileHover] Fetching profile for userId:', normalizedUserId);
      
      const url = `${baseURL}/user/fetchprofile?userId=${normalizedUserId}`;
      console.log('[ProfileHover] Fetching from URL:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[ProfileHover] Profile response:', data);
        // Verify the returned profile matches the requested userId
        const returnedUserId = String(data.profile?.id || data.id || '').trim();
        const requestedUserId = normalizedUserId;
        
        // Only update if userId hasn't changed during fetch
        if (userIdRef.current === currentUserId && returnedUserId === requestedUserId) {
          console.log('[ProfileHover] Profile matches! Setting profile for userId:', requestedUserId);
          setProfile({
            id: returnedUserId,
            displayName: data.profile?.displayName || data.displayName || 'User',
            email: data.profile?.email || data.email || '',
            bio: data.profile?.bio || data.bio || '',
            rating: data.profile?.rating || data.rating || 1500,
            avatarUrl: data.profile?.avatarUrl || data.avatarUrl || defaultAvatar,
          });
        } else if (returnedUserId !== requestedUserId) {
          console.error('[ProfileHover] Profile userId MISMATCH!', { 
            requested: requestedUserId, 
            returned: returnedUserId,
            fullResponse: data 
          });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[ProfileHover] Failed to fetch profile:', response.status, errorData);
      }
    } catch (err) {
      console.error('[ProfileHover] Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }, [baseURL]);

  useEffect(() => {
    if (open && !profile && !loading && userId) {
      fetchProfile();
    }
  }, [open, profile, loading, userId, fetchProfile]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild className={className}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {loading ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        ) : profile ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <img
                  src={profile.avatarUrl || defaultAvatar}
                  alt={profile.displayName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{profile.displayName}</h3>
                  <p className="text-xs text-gray-500 truncate">{profile.email}</p>
                  {profile.rating && (
                    <p className="text-xs text-gray-600 mt-1">
                      Rating: {Math.round(profile.rating)}
                    </p>
                  )}
                  {profile.bio && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">{profile.bio}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Failed to load profile</p>
            </CardContent>
          </Card>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ProfileHover;

