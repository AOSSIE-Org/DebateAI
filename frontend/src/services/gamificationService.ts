const baseURL = import.meta.env.VITE_BASE_URL || "http://localhost:1313";

export interface GamificationEvent {
  type: "badge_awarded" | "score_updated" | "connected";
  userId: string;
  badgeName?: string;
  points?: number;
  newScore?: number;
  action?: string;
  timestamp: string;
  message?: string;
}

export interface AwardBadgeRequest {
  badgeName: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateScoreRequest {
  points: number;
  action: string;
  metadata?: Record<string, any>;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  score: number;
  rating: number;
  avatarUrl: string;
  currentUser: boolean;
}

export interface LeaderboardResponse {
  debaters: LeaderboardEntry[];
  total: number;
}

export const fetchGamificationLeaderboard = async (token: string): Promise<LeaderboardResponse> => {
  const response = await fetch(`${baseURL}/api/leaderboard`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.status}`);
  }

  return response.json();
};

export const awardBadge = async (token: string, request: AwardBadgeRequest) => {
  const response = await fetch(`${baseURL}/api/award-badge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to award badge: ${response.status}`);
  }

  return response.json();
};

export const updateScore = async (token: string, request: UpdateScoreRequest) => {
  const response = await fetch(`${baseURL}/api/update-score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to update score: ${response.status}`);
  }

  return response.json();
};

export const createGamificationWebSocket = (
  token: string,
  onMessage: (event: GamificationEvent) => void,
  onError?: (error: Event) => void,
  onClose?: () => void
): WebSocket => {
  const target = new URL("/ws/gamification", baseURL);
  target.protocol = target.protocol === "https:" ? "wss:" : "ws:";
  target.searchParams.set("token", token);
  const wsURL = target.toString();
  const ws = new WebSocket(wsURL);

  ws.onopen = () => {
    console.log("Connected to gamification WebSocket");
  };

  ws.onmessage = (event) => {
    try {
      // parse safely
      const raw = event.data;
      let parsed: GamificationEvent | null = null;
      try {
        parsed = JSON.parse(typeof raw === 'string' ? raw : String(raw));
      } catch (err) {
        console.warn('Failed to parse gamification event, ignoring', err);
      }
      if (parsed) onMessage(parsed);
    } catch (error) {
      console.error("Error handling gamification event:", error);
    }
  };

  ws.onerror = (error) => {
    console.error("Gamification WebSocket error:", error);
    if (onError) onError(error);
  };

  ws.onclose = () => {
    console.log("Gamification WebSocket closed");
    if (onClose) onClose();
  };

  return ws;
};

