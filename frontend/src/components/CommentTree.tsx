import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import { useUser } from '../hooks/useUser';
import ProfileHover from './ProfileHover';
import UserProfileModal from './UserProfileModal';
import {
  commentsByTranscriptAtom,
  getCommentsForTranscriptAtom,
  setCommentsForTranscriptAtom,
  addCommentToTranscriptAtom,
  removeCommentFromTranscriptAtom,
  type Comment,
} from '../state/commentsAtom';

// Component to display comment author's avatar
interface CommentAuthorAvatarProps {
  userId: string;
}

const CommentAuthorAvatar: React.FC<CommentAuthorAvatarProps> = ({ userId }) => {
  const [profile, setProfile] = useState<{ displayName?: string; avatarUrl?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string>(userId);
  const baseURL = useMemo(() => import.meta.env.VITE_BASE_URL || 'http://localhost:1313', []);

  // Reset profile when userId changes
  useEffect(() => {
    if (userId !== userIdRef.current) {
      userIdRef.current = userId;
      setProfile(null);
      setLoading(true);
    }
  }, [userId]);

  const fetchProfile = useCallback(async () => {
    const currentUserId = userIdRef.current;
    if (!currentUserId || currentUserId === 'undefined' || currentUserId === 'null') {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const normalizedUserId = String(currentUserId).trim();
      console.log('[CommentAuthorAvatar] Fetching profile for userId:', normalizedUserId);
      
      const url = `${baseURL}/user/fetchprofile?userId=${normalizedUserId}`;
      console.log('[CommentAuthorAvatar] Fetching from URL:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[CommentAuthorAvatar] Profile response:', data);
        // Verify the returned profile matches the requested userId
        const returnedUserId = String(data.profile?.id || data.id || '').trim();
        const requestedUserId = normalizedUserId;
        
        // Only update if userId hasn't changed during fetch
        if (userIdRef.current === currentUserId && returnedUserId === requestedUserId) {
          console.log('[CommentAuthorAvatar] Profile matches! Setting profile for userId:', requestedUserId);
          setProfile({
            displayName: data.profile?.displayName || data.displayName,
            avatarUrl: data.profile?.avatarUrl || data.avatarUrl,
          });
        } else if (returnedUserId !== requestedUserId) {
          console.error('[CommentAuthorAvatar] Profile userId MISMATCH!', { 
            requested: requestedUserId, 
            returned: returnedUserId,
            fullResponse: data 
          });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[CommentAuthorAvatar] Failed to fetch profile:', response.status, errorData);
      }
    } catch (err) {
      console.error('[CommentAuthorAvatar] Error fetching comment author profile:', err);
    } finally {
      setLoading(false);
    }
  }, [baseURL]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const displayName = profile?.displayName || 'Anonymous';
  const avatarUrl = profile?.avatarUrl;

  return (
    <ProfileHover userId={String(userId)}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-8 h-8 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-primary transition-all"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent && !parent.querySelector('.avatar-fallback')) {
              const fallback = document.createElement('div');
              fallback.className = 'avatar-fallback w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium cursor-pointer hover:ring-2 hover:ring-primary transition-all';
              fallback.textContent = displayName.charAt(0).toUpperCase();
              parent.appendChild(fallback);
            }
          }}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium cursor-pointer hover:ring-2 hover:ring-primary transition-all">
          {loading ? '...' : displayName.charAt(0).toUpperCase()}
        </div>
      )}
    </ProfileHover>
  );
};

// Component to display comment author's name
interface CommentAuthorNameProps {
  userId: string;
  onClick?: (e: React.MouseEvent) => void;
}

const CommentAuthorName: React.FC<CommentAuthorNameProps> = ({ userId, onClick }) => {
  const [profile, setProfile] = useState<{ displayName?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string>(userId);
  const baseURL = useMemo(() => import.meta.env.VITE_BASE_URL || 'http://localhost:1313', []);

  // Reset profile when userId changes
  useEffect(() => {
    if (userId !== userIdRef.current) {
      userIdRef.current = userId;
      setProfile(null);
      setLoading(true);
    }
  }, [userId]);

  const fetchProfile = useCallback(async () => {
    const currentUserId = userIdRef.current;
    if (!currentUserId || currentUserId === 'undefined' || currentUserId === 'null') {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const normalizedUserId = String(currentUserId).trim();
      console.log('[CommentAuthorName] Fetching profile for userId:', normalizedUserId);
      
      const url = `${baseURL}/user/fetchprofile?userId=${normalizedUserId}`;
      console.log('[CommentAuthorName] Fetching from URL:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[CommentAuthorName] Profile response:', data);
        // Verify the returned profile matches the requested userId
        const returnedUserId = String(data.profile?.id || data.id || '').trim();
        const requestedUserId = normalizedUserId;
        
        // Only update if userId hasn't changed during fetch
        if (userIdRef.current === currentUserId && returnedUserId === requestedUserId) {
          console.log('[CommentAuthorName] Profile matches! Setting profile for userId:', requestedUserId);
          setProfile({
            displayName: data.profile?.displayName || data.displayName,
          });
        } else if (returnedUserId !== requestedUserId) {
          console.error('[CommentAuthorName] Profile userId MISMATCH!', { 
            requested: requestedUserId, 
            returned: returnedUserId,
            fullResponse: data 
          });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[CommentAuthorName] Failed to fetch profile:', response.status, errorData);
      }
    } catch (err) {
      console.error('[CommentAuthorName] Error fetching comment author profile:', err);
    } finally {
      setLoading(false);
    }
  }, [baseURL]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const displayName = profile?.displayName || (loading ? 'Loading...' : 'Anonymous');

  return (
    <ProfileHover userId={String(userId)}>
      <span
        className="font-medium text-sm text-gray-900 hover:text-primary cursor-pointer transition-colors"
        onClick={onClick}
      >
        {displayName}
      </span>
    </ProfileHover>
  );
};

interface CommentTreeProps {
  transcriptId: string;
  onCommentAdded?: () => void;
  className?: string;
}

const CommentTree: React.FC<CommentTreeProps> = ({
  transcriptId,
  onCommentAdded,
  className = '',
}) => {
  const { user } = useUser();
  const [commentsAtom] = useAtom(getCommentsForTranscriptAtom(transcriptId));
  const [, setCommentsAtom] = useAtom(setCommentsForTranscriptAtom(transcriptId));
  const [, addCommentAtom] = useAtom(addCommentToTranscriptAtom(transcriptId));
  const [, removeCommentAtom] = useAtom(removeCommentFromTranscriptAtom(transcriptId));
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const baseURL = import.meta.env.VITE_BASE_URL || 'http://localhost:1313';

  // Sync atom comments to local state for tree building
  useEffect(() => {
    const flatComments = commentsAtom;
    const buildTree = (flatComments: Comment[]): Comment[] => {
      const commentMap = new Map<string, Comment>();
      const rootComments: Comment[] = [];

      flatComments.forEach((comment) => {
        commentMap.set(comment.id, { ...comment, children: [] });
      });

      flatComments.forEach((comment) => {
        const node = commentMap.get(comment.id)!;
        if (comment.parentId && commentMap.has(comment.parentId)) {
          const parent = commentMap.get(comment.parentId)!;
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        } else {
          rootComments.push(node);
        }
      });

      rootComments.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const sortChildren = (comment: Comment) => {
        if (comment.children) {
          comment.children.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          comment.children.forEach(sortChildren);
        }
      };
      rootComments.forEach(sortChildren);

      return rootComments;
    };

    setComments(buildTree(flatComments));
  }, [commentsAtom]);

  const fetchComments = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${baseURL}/comments/${transcriptId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      const rawComments = data.comments || [];
      
      // Ensure userId is a string for all comments
      const flatComments: Comment[] = rawComments.map((comment: any) => {
        // Convert userId to string if needed
        const userId = typeof comment.userId === 'string' 
          ? comment.userId 
          : (comment.userId?.$oid || comment.userId?.toString() || String(comment.userId || ''));
        
        console.log('Processing comment - original userId:', comment.userId, 'type:', typeof comment.userId, 'converted:', userId);
        
        // Always clear displayName and avatarUrl to force fetching from the correct user profile
        // This prevents showing the logged-in user's profile for other users' comments
        // We'll fetch the profile dynamically using the comment's userId
        const processedComment = {
          ...comment,
          userId: userId,
          id: String(comment.id || comment._id || ''),
          transcriptId: String(comment.transcriptId || ''),
          // Clear displayName and avatarUrl - they will be fetched dynamically based on userId
          displayName: undefined,
          avatarUrl: undefined,
        };
        
        // Profile data will be fetched dynamically using ProfileHover and CommentAuthorAvatar components
        // This ensures we always show the correct comment author's profile, not the logged-in user's
        
        return processedComment;
      });
      
      console.log('Processed comments:', flatComments);
      
      // Update atom with flat comments
      setCommentsAtom(flatComments);
      setError(null);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
    // Only fetch once on mount, no polling - updates come from atoms
  }, [transcriptId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSubmit = async (parentId: string | null = null) => {
    if (!replyContent.trim() || !user) {
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to comment');
        return;
      }

      const response = await fetch(`${baseURL}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transcriptId,
          parentId: parentId || undefined,
          content: replyContent.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to post comment');
      }

      const result = await response.json();
      const newComment: Comment = result.comment;
      
      // Fetch updated comments (including the new one) and update atom
      await fetchComments();
      
      setReplyContent('');
      setReplyingTo(null);
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (err: any) {
      console.error('Error submitting comment:', err);
      setError(err.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const renderComment = (comment: Comment, depth: number = 0): React.ReactNode => {
    const maxDepth = 5;
    if (depth > maxDepth) return null;

    const isOwnComment = user?.id === String(comment.userId);
    const marginLeft = depth * 24;

    return (
      <div
        key={comment.id}
        className="comment-item"
        style={{
          marginLeft: `${marginLeft}px`,
          borderLeft: depth > 0 ? '2px solid #e5e7eb' : 'none',
          paddingLeft: depth > 0 ? '12px' : '0',
          marginTop: '12px',
        }}
      >
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
          <div className="flex-shrink-0">
            <CommentAuthorAvatar userId={String(comment.userId)} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CommentAuthorName
                userId={String(comment.userId)}
                onClick={(e) => {
                  e.stopPropagation();
                  // Ensure userId is a valid string - handle both string and object formats
                  let clickedUserId: string;
                  
                  if (typeof comment.userId === 'string') {
                    clickedUserId = comment.userId.trim();
                  } else if (comment.userId && typeof comment.userId === 'object') {
                    // Handle ObjectID-like objects
                    clickedUserId = String((comment.userId as any).$oid || (comment.userId as any).toString() || comment.userId).trim();
                  } else {
                    clickedUserId = String(comment.userId || '').trim();
                  }
                  
                  if (!clickedUserId || clickedUserId === 'undefined' || clickedUserId === 'null' || clickedUserId === '') {
                    console.error('❌ Invalid userId:', clickedUserId);
                    alert('Unable to load profile: Invalid user ID');
                    return;
                  }
                  
                  // Set userId first, then open modal
                  setSelectedUserId(clickedUserId);
                  
                  // Small delay to ensure state is set before opening modal
                  setTimeout(() => {
                    setIsProfileModalOpen(true);
                  }, 0);
                }}
              />
              <span className="text-xs text-gray-500">
                {new Date(comment.createdAt).toLocaleDateString()}{' '}
                {new Date(comment.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mb-2">
              {comment.content}
            </p>

            <div className="flex items-center gap-4">
              {depth < maxDepth && (
                <button
                  onClick={() => {
                    setReplyingTo(replyingTo === comment.id ? null : comment.id);
                    if (replyingTo !== comment.id) {
                      setReplyContent('');
                    }
                  }}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {replyingTo === comment.id ? 'Cancel' : 'Reply'}
                </button>
              )}
              {isOwnComment && (
                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to delete this comment?')) {
                      const token = localStorage.getItem('token');
                      try {
                        const response = await fetch(`${baseURL}/comments/${comment.id}`, {
                          method: 'DELETE',
                          headers: {
                            Authorization: `Bearer ${token}`,
                          },
                        });
                        if (response.ok) {
                          // Remove from atom
                          removeCommentAtom(comment.id);
                          // Also refresh to ensure consistency
                          await fetchComments();
                        }
                      } catch (err) {
                        console.error('Error deleting comment:', err);
                      }
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
                >
                  Delete
                </button>
              )}
            </div>

            {replyingTo === comment.id && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="w-full p-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyContent('');
                    }}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSubmit(comment.id)}
                    disabled={!replyContent.trim() || submitting}
                    className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? 'Posting...' : 'Post Reply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {comment.children && comment.children.length > 0 && (
          <div className="mt-2">
            {comment.children.map((child) => renderComment(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderNewCommentForm = () => {
    if (!user) {
      return (
        <div className="p-4 text-center text-gray-500 text-sm border border-gray-200 rounded-lg">
          Please log in to post comments
        </div>
      );
    }

    return (
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg">
        <textarea
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="Write a comment..."
          className="w-full p-3 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          rows={4}
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={() => handleSubmit(null)}
            disabled={!replyContent.trim() || submitting}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-gray-600">Loading comments...</span>
      </div>
    );
  }

  if (error && comments.length === 0) {
    return (
      <div className={`p-4 text-center text-red-600 ${className}`}>
        {error}
        <button
          onClick={fetchComments}
          className="ml-2 text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`comment-tree ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Comments</h3>
        {error && (
          <div className="p-2 mb-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            {error}
            <button
              onClick={fetchComments}
              className="ml-2 text-yellow-900 hover:underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {renderNewCommentForm()}

      <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map((comment) => renderComment(comment))}
          </div>
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* User Profile Modal */}
      {selectedUserId && (
        <UserProfileModal
          key={selectedUserId} // Force re-render when userId changes
          userId={selectedUserId}
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            setSelectedUserId(null);
          }}
        />
      )}
    </div>
  );
};

export default CommentTree;
