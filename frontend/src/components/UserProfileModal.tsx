import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus, UserCheck, Users } from 'lucide-react';
import { useUser } from '../hooks/useUser';
import defaultAvatar from '@/assets/avatar2.jpg';
import ProfileHover from './ProfileHover';

interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  bio?: string;
  rating?: number;
  avatarUrl?: string;
}

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  userId,
  isOpen,
  onClose,
}) => {
  const { user: currentUser } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const baseURL = import.meta.env.VITE_BASE_URL || 'http://localhost:1313';

  useEffect(() => {
    console.log('=== UserProfileModal useEffect ===');
    console.log('isOpen:', isOpen);
    console.log('userId prop:', userId);
    console.log('userId type:', typeof userId);
    
    // Reset state when modal closes
    if (!isOpen) {
      console.log('Modal closed, resetting state');
      setProfile(null);
      setFollowers([]);
      setFollowing([]);
      setIsFollowing(false);
      return;
    }

    // Only fetch when modal is open and userId is provided
    if (isOpen && userId) {
      // Ensure userId is a valid string
      const targetUserId = String(userId).trim();
      
      if (!targetUserId || targetUserId === 'undefined' || targetUserId === 'null' || targetUserId === '') {
        console.error('❌ Invalid userId in modal:', userId);
        return;
      }
      
      console.log('✅ Modal is open, fetching profile for userId:', targetUserId);
      
      // Reset state first
      setProfile(null);
      setFollowers([]);
      setFollowing([]);
      setIsFollowing(false);
      
      const fetchData = async () => {
        console.log('📡 Starting fetch for targetUserId:', targetUserId);
        await fetchProfileForUser(targetUserId);
        await fetchFollowersForUser(targetUserId);
        await fetchFollowingForUser(targetUserId);
        await checkFollowStatusForUser(targetUserId);
      };
      
      fetchData();
    } else {
      console.log('⚠️ Modal open but no userId provided, or modal not open');
    }
  }, [isOpen, userId]);

  const fetchProfileForUser = async (targetUserId: string) => {
    if (!targetUserId) {
      console.error('fetchProfileForUser: targetUserId is empty');
      return;
    }
    
    // Ensure userId is a valid string
    const userId = String(targetUserId).trim();
    if (!userId || userId === 'undefined' || userId === 'null' || userId === '') {
      console.error('fetchProfileForUser: Invalid userId:', targetUserId);
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = `${baseURL}/user/fetchprofile?userId=${encodeURIComponent(userId)}`;
      console.log('Fetching profile - URL:', url);
      console.log('Fetching profile - userId:', userId);
      
      const response = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Profile data received:', data);
        console.log('Profile ID:', data.profile?.id, 'Expected userId:', userId);
        
        // Verify we got the correct user's profile
        if (data.profile?.id && data.profile.id !== userId) {
          console.warn('Profile ID mismatch! Expected:', userId, 'Got:', data.profile.id);
        }
        
        setProfile({
          id: data.profile?.id || data.id || userId,
          displayName: data.profile?.displayName || data.displayName || 'User',
          email: data.profile?.email || data.email || '',
          bio: data.profile?.bio || data.bio || '',
          rating: data.profile?.rating || data.rating || 1500,
          avatarUrl: data.profile?.avatarUrl || data.avatarUrl || defaultAvatar,
        });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        console.error('Failed to fetch profile:', errorData);
        console.error('Response status:', response.status);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowersForUser = async (targetUserId: string) => {
    if (!targetUserId) return;
    
    setLoadingFollowers(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${baseURL}/users/${targetUserId}/followers`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        const data = await response.json();
        setFollowers(data.followers || []);
      }
    } catch (err) {
      console.error('Error fetching followers:', err);
    } finally {
      setLoadingFollowers(false);
    }
  };

  const fetchFollowingForUser = async (targetUserId: string) => {
    if (!targetUserId) return;
    
    setLoadingFollowing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${baseURL}/users/${targetUserId}/following`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        const data = await response.json();
        setFollowing(data.following || []);
      }
    } catch (err) {
      console.error('Error fetching following:', err);
    } finally {
      setLoadingFollowing(false);
    }
  };

  const checkFollowStatusForUser = async (targetUserId: string) => {
    if (!currentUser?.id || !targetUserId || currentUser.id === targetUserId) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${baseURL}/users/${currentUser.id}/following`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (response.ok) {
        const data = await response.json();
        const following = data.following || [];
        setIsFollowing(following.some((f: any) => (f.id === targetUserId || f._id === targetUserId)));
      }
    } catch (err) {
      console.error('Error checking follow status:', err);
    }
  };


  const handleFollow = async () => {
    if (!currentUser?.id) {
      alert('Please log in to follow users');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const endpoint = isFollowing ? 'DELETE' : 'POST';
      const response = await fetch(`${baseURL}/users/${userId}/follow`, {
        method: endpoint,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isFollowing ? 'unfollow' : 'follow'} user`);
      }

      setIsFollowing(!isFollowing);
      // Refresh followers count
      if (userId) {
        fetchFollowersForUser(userId);
      }
    } catch (err: any) {
      console.error('Error following user:', err);
      alert(err.message || `Failed to ${isFollowing ? 'unfollow' : 'follow'} user`);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : profile ? (
          <div className="space-y-4">
            {/* Profile Header */}
            <div className="flex items-start gap-4">
              <img
                src={profile.avatarUrl || defaultAvatar}
                alt={profile.displayName}
                className="w-20 h-20 rounded-full object-cover border-2 border-primary"
              />
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{profile.displayName}</h2>
                <p className="text-sm text-gray-500">{profile.email}</p>
                {profile.rating && (
                  <p className="text-sm text-gray-600 mt-1">
                    Rating: {Math.round(profile.rating)}
                  </p>
                )}
                {currentUser?.id && currentUser.id !== userId && (
                  <Button
                    variant={isFollowing ? 'outline' : 'default'}
                    size="sm"
                    onClick={handleFollow}
                    className="mt-2"
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div>
                <h3 className="font-semibold mb-2">Bio</h3>
                <p className="text-sm text-gray-700">{profile.bio}</p>
              </div>
            )}

            {/* Followers Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <h3 className="font-semibold">Followers ({followers.length})</h3>
              </div>
              <Card>
                <CardContent className="p-4">
                  {loadingFollowers ? (
                    <div className="text-center py-4 text-sm text-gray-500">
                      Loading...
                    </div>
                  ) : followers.length === 0 ? (
                    <div className="text-center py-4 text-sm text-gray-500">
                      No followers yet
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {followers.map((follower: any) => (
                        <ProfileHover
                          key={follower.id || follower._id}
                          userId={follower.id || follower._id}
                        >
                          <div className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                            <img
                              src={follower.avatarUrl || defaultAvatar}
                              alt={follower.displayName || 'User'}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <span className="text-sm">{follower.displayName || follower.email || 'User'}</span>
                          </div>
                        </ProfileHover>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Following Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <h3 className="font-semibold">Following ({following.length})</h3>
              </div>
              <Card>
                <CardContent className="p-4">
                  {loadingFollowing ? (
                    <div className="text-center py-4 text-sm text-gray-500">
                      Loading...
                    </div>
                  ) : following.length === 0 ? (
                    <div className="text-center py-4 text-sm text-gray-500">
                      Not following anyone yet
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {following.map((followed: any) => (
                        <ProfileHover
                          key={followed.id || followed._id}
                          userId={followed.id || followed._id}
                        >
                          <div className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                            <img
                              src={followed.avatarUrl || defaultAvatar}
                              alt={followed.displayName || 'User'}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <span className="text-sm">{followed.displayName || followed.email || 'User'}</span>
                          </div>
                        </ProfileHover>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Failed to load profile
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileModal;

