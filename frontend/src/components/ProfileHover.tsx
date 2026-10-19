import config from "../config/config";
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent } from '@/components/ui/card';
import { Twitter, Instagram, Linkedin, Github } from 'lucide-react';
import defaultAvatar from '@/assets/avatar2.jpg';
import SocialVerificationBadge from './SocialVerificationBadge';
import {
  parseAndValidateSocialInput,
  getStandardizedSocialDisplay,
  SupportedPlatform,
} from '../utils/socialValidation';

interface ProfilePreview {
  id?: string;
  displayName: string;
  email: string;
  bio?: string;
  rating?: number;
  avatarUrl?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  github?: string;
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
  const baseURL = useMemo(() => config.baseUrl || 'http://localhost:1313', []);

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
            twitter: data.profile?.twitter || data.twitter || '',
            instagram: data.profile?.instagram || data.instagram || '',
            linkedin: data.profile?.linkedin || data.linkedin || '',
            github: data.profile?.github || data.github || '',
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

  const socialPlatforms: Array<{
    platform: SupportedPlatform;
    Icon: React.ComponentType<{ className?: string }>;
    label: string;
  }> = [
    { platform: "twitter", Icon: Twitter, label: "X / Twitter" },
    { platform: "instagram", Icon: Instagram, label: "Instagram" },
    { platform: "linkedin", Icon: Linkedin, label: "LinkedIn" },
    { platform: "github", Icon: Github, label: "GitHub" },
  ];

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

                  {(() => {
                    const verifiedSocials = socialPlatforms
                      .map(({ platform, Icon, label }) => {
                        const handle = profile[platform];
                        if (!handle) return null;
                        const validation = parseAndValidateSocialInput(platform, handle);
                        if (!validation.isValid || !validation.handle) return null;
                        return {
                          platform,
                          Icon,
                          label,
                          url: validation.url,
                          display: getStandardizedSocialDisplay(platform, validation.handle),
                        };
                      })
                      .filter((item): item is NonNullable<typeof item> => item !== null);

                    if (verifiedSocials.length === 0) return null;

                    return (
                      <div className="mt-2.5 pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium mb-1">
                          <span>Verified Socials</span>
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                            ✓ Whitelist Verified
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {verifiedSocials.map((item) => (
                            <a
                              key={item.platform}
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground/85 hover:text-primary bg-muted/60 hover:bg-muted px-2 py-0.5 rounded-full border border-border/50 transition-colors"
                              title={`${item.label}: ${item.display} (Verified)`}
                            >
                              <item.Icon className="w-3 h-3 text-primary shrink-0" />
                              <span className="max-w-[100px] truncate">{item.display}</span>
                              <SocialVerificationBadge verified={true} size="xs" />
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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

