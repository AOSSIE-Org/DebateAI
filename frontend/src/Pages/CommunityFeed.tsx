import React, { useState, useEffect, useCallback } from "react";
import { useUser } from "../hooks/useUser";
import CommentTree from "../components/CommentTree";
import ProfileHover from "../components/ProfileHover";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { MessageCircle, Trash2, UserPlus, UserCheck } from "lucide-react";

interface Post {
  id: string;
  transcriptId: string;
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  topic: string;
  debateType: string;
  opponent: string;
  result: string;
  commentCount: number;
  createdAt: string;
  isFollowing?: boolean;
  isOwnPost?: boolean;
  transcript?: TranscriptData;
}

interface TranscriptMessage {
  sender: string;
  text: string;
  phase?: string;
}

interface TranscriptData {
  messages: TranscriptMessage[];
  transcripts?: Record<string, string>;
}

type ObjectIdLike =
  | string
  | {
      $oid?: string;
      hex?: () => string;
      Hex?: string;
      String?: () => string;
    };

interface RawTranscriptMessage {
  sender: string;
  text: string;
  phase?: string;
}

interface RawTranscriptData {
  messages?: RawTranscriptMessage[];
  transcripts?: Record<string, string>;
}

interface RawPost {
  id: ObjectIdLike;
  transcriptId: ObjectIdLike;
  userId: ObjectIdLike;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  topic: string;
  debateType: string;
  opponent: string;
  result: string;
  commentCount?: number;
  createdAt: string;
  transcript?: RawTranscriptData;
  isOwnPost?: boolean;
}

interface FollowResponse {
  following?: Array<{ id: string }>;
}

const formatPhaseLabel = (phase: string): string => {
  if (!phase) {
    return "";
  }

  return phase
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const TranscriptPreview: React.FC<{
  transcript?: TranscriptData;
  postId: string;
}> = ({ transcript, postId }) => {
  if (!transcript) {
    return null;
  }

  const messages = transcript.messages ?? [];
  const phaseEntries = transcript.transcripts
    ? Object.entries(transcript.transcripts)
    : [];

  const hasMessages = messages.length > 0;
  const hasPhaseSummaries = phaseEntries.length > 0;

  if (!hasMessages && !hasPhaseSummaries) {
    return null;
  }

  return (
    <div className="mb-4 space-y-4">
      {hasMessages && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Conversation</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {messages.map((message, index) => {
              const isUser = message.sender?.toLowerCase() === "user";
              const isJudge = message.sender?.toLowerCase() === "judge";
              return (
                <div
                  key={`${postId}-message-${index}`}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 text-sm shadow-sm ${
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : isJudge
                        ? "bg-amber-50 text-amber-900 border border-amber-200"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {message.sender || "Unknown"}
                      </span>
                      {message.phase && (
                        <span className="text-xs opacity-80">
                          {formatPhaseLabel(message.phase)}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasPhaseSummaries && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Phase Summaries
          </h3>
          <div className="space-y-3">
            {phaseEntries.map(([phase, transcriptText]) => (
              <div
                key={`${postId}-phase-${phase}`}
                className="border rounded-lg p-3 bg-muted/40"
              >
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  {formatPhaseLabel(phase)}
                </h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {transcriptText}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CommunityFeed: React.FC = () => {
  const { user } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<
    string | null
  >(null);
  const baseURL = import.meta.env.VITE_BASE_URL || "http://localhost:1313";
  const normalizeObjectId = useCallback(
    (value: ObjectIdLike | undefined): string => {
      if (!value) {
        return "";
      }

      if (typeof value === "string") {
        return value;
      }

      if (typeof value === "object") {
        if ("$oid" in value && value.$oid) {
          return value.$oid;
        }
        if ("hex" in value && typeof value.hex === "function") {
          const hexValue = value.hex();
          if (hexValue) {
            return hexValue;
          }
        }
        if ("Hex" in value && value.Hex) {
          return value.Hex;
        }
        if ("String" in value && typeof value.String === "function") {
          const stringValue = value.String();
          if (stringValue) {
            return stringValue;
          }
        }
      }

      return String(value);
    },
    []
  );
  const currentUserId = normalizeObjectId(user?.id as ObjectIdLike | undefined);

  const normalizePost = useCallback(
    (raw: RawPost): Post => {
      const normalizedUserId = normalizeObjectId(raw.userId);
      const normalizedTranscriptId = normalizeObjectId(raw.transcriptId);
      const normalizedId = normalizeObjectId(raw.id);

      const rawTranscript = raw.transcript;
      const transcriptMessages: RawTranscriptMessage[] = Array.isArray(
        rawTranscript?.messages
      )
        ? rawTranscript.messages ?? []
        : [];

      const transcriptData: TranscriptData | undefined = rawTranscript
        ? {
            messages: transcriptMessages.map((message) => ({
              sender: message.sender,
              text: message.text,
              phase: message.phase,
            })),
            transcripts: rawTranscript.transcripts || {},
          }
        : undefined;

      const normalized: Post = {
        id: normalizedId || "",
        transcriptId: normalizedTranscriptId || "",
        userId: normalizedUserId || "",
        email: raw.email ?? "",
        displayName: raw.displayName ?? "",
        avatarUrl: raw.avatarUrl ?? undefined,
        topic: raw.topic ?? "",
        debateType: raw.debateType ?? "",
        opponent: raw.opponent ?? "",
        result: raw.result ?? "",
        commentCount:
          typeof raw.commentCount === "number"
            ? raw.commentCount
            : Number(raw.commentCount ?? 0),
        createdAt: raw.createdAt ?? "",
        transcript: transcriptData,
        isOwnPost: Boolean(raw.isOwnPost),
      };

      return normalized;
    },
    [normalizeObjectId]
  );

  const fetchFeed = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const userId = currentUserId;
      const response = await fetch(`${baseURL}/posts/feed`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch feed");
      }

      const data = (await response.json()) as { posts?: RawPost[] };

      const normalizedPosts: Post[] = Array.isArray(data.posts)
        ? data.posts.map((raw) => normalizePost(raw))
        : [];

      // Fetch follow status for each post if user is logged in
      if (token && normalizedPosts.length > 0 && userId) {
        const postsWithStatus = await Promise.all(
          normalizedPosts.map(async (post) => {
            try {
              // Check follow status - check if current user follows this post author
              // Only check if it's not the current user's post
              let isFollowing = false;
              if (!post.isOwnPost && post.userId !== userId) {
                try {
                  const followResponse = await fetch(
                    `${baseURL}/users/${userId}/following`,
                    {
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                    }
                  );
                  if (followResponse.ok) {
                    const followData =
                      (await followResponse.json()) as FollowResponse;
                    const following = followData.following || [];
                    isFollowing = following.some((f) => f.id === post.userId);
                  }
                } catch (err) {
                  console.error("Error checking follow status:", err);
                }
              }

              return {
                ...post,
                isFollowing,
              };
            } catch (err) {
              console.error("Error fetching post status:", err);
              return post;
            }
          })
        );
        setPosts(postsWithStatus);
      } else {
        setPosts(normalizedPosts);
      }

      setError(null);
    } catch (err) {
      console.error("Error fetching feed:", err);
      setError("Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, [baseURL, currentUserId, normalizePost]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleFollow = async (userId: string, isFollowing: boolean) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in to follow users");
      return;
    }

    const targetPost = posts.find((post) => post.userId === userId);
    if (targetPost?.isOwnPost) {
      return;
    }

    try {
      const endpoint = isFollowing ? "DELETE" : "POST";
      const response = await fetch(`${baseURL}/users/${userId}/follow`, {
        method: endpoint,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(
          errorData.error ||
            `Failed to ${isFollowing ? "unfollow" : "follow"} user`
        );
      }

      // Update follow status in posts
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.userId === userId ? { ...post, isFollowing: !isFollowing } : post
        )
      );
    } catch (err: unknown) {
      console.error("Error following user:", err);
      const message =
        err instanceof Error
          ? err.message
          : `Failed to ${isFollowing ? "unfollow" : "follow"} user`;
      alert(message);
    }
  };

  const handleDeletePost = async (postId: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in to delete posts");
      return;
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this post?"
    );
    if (!confirmDelete) {
      return;
    }

    try {
      const response = await fetch(`${baseURL}/posts/${postId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({} as { error?: string }));
        throw new Error(errorData.error || "Failed to delete post");
      }

      setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
    } catch (err: unknown) {
      console.error("Error deleting post:", err);
      const message =
        err instanceof Error ? err.message : "Failed to delete post";
      alert(message);
    }
  };

  const toggleComments = (transcriptId: string) => {
    if (selectedTranscriptId === transcriptId) {
      setSelectedTranscriptId(null);
    } else {
      setSelectedTranscriptId(transcriptId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Community Feed</h1>
        <p className="text-gray-600">
          See what the community is debating about
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {posts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <MessageCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">No posts yet.</p>
            <p className="text-sm text-gray-400">
              Create a post from your saved transcripts to get started!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const isOwnPost = Boolean(post.isOwnPost);

            return (
              <Card key={post.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <ProfileHover userId={post.userId}>
                          {post.avatarUrl ? (
                            <img
                              src={post.avatarUrl}
                              alt={post.displayName || "User"}
                              className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 cursor-pointer hover:border-primary transition-colors"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                                const parent = target.parentElement;
                                if (parent) {
                                  const fallback =
                                    document.createElement("div");
                                  fallback.className =
                                    "w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium border-2 border-gray-200 cursor-pointer hover:border-primary transition-colors";
                                  fallback.textContent =
                                    post.displayName?.charAt(0).toUpperCase() ||
                                    "U";
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium border-2 border-gray-200 cursor-pointer hover:border-primary transition-colors">
                              {post.displayName?.charAt(0).toUpperCase() || "U"}
                            </div>
                          )}
                        </ProfileHover>
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-1">
                            {post.topic}
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>by {post.displayName}</span>
                            <span>•</span>
                            <span>
                              {new Date(post.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {user && isOwnPost ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeletePost(post.id)}
                            className="flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </Button>
                        ) : (
                          user && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleFollow(
                                  post.userId,
                                  post.isFollowing || false
                                )
                              }
                              className="flex items-center gap-2"
                            >
                              {post.isFollowing ? (
                                <>
                                  <UserCheck className="w-4 h-4" />
                                  <span>Following</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4" />
                                  <span>Follow</span>
                                </>
                              )}
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs rounded-full font-medium ${
                        post.result === "win"
                          ? "bg-green-100 text-green-800"
                          : post.result === "loss"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {post.result}
                    </span>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="mb-4 space-y-2 text-sm">
                    <p>
                      <strong>Type:</strong> {post.debateType}
                    </p>
                    <p>
                      <strong>Opponent:</strong> {post.opponent}
                    </p>
                  </div>

                  <TranscriptPreview
                    transcript={post.transcript}
                    postId={post.id}
                  />

                  <div className="flex items-center gap-4 pt-4 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleComments(post.transcriptId)}
                      className="flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.commentCount}</span>
                    </Button>
                  </div>

                  {selectedTranscriptId === post.transcriptId && (
                    <div className="mt-4 pt-4 border-t">
                      <CommentTree
                        transcriptId={post.transcriptId}
                        onCommentAdded={() => {
                          // Update comment count in local state
                          setPosts((prevPosts) =>
                            prevPosts.map((p) =>
                              p.id === post.id
                                ? { ...p, commentCount: p.commentCount + 1 }
                                : p
                            )
                          );
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommunityFeed;
