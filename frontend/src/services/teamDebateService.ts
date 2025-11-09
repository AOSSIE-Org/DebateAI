// Team debate service for API calls
const API_BASE_URL = "http://localhost:1313";

function getAuthToken(): string {
  return localStorage.getItem("token") || "";
}

export interface TeamDebateMember {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  elo: number;
  joinedAt: string;
}

export interface TeamDebate {
  id: string;
  team1Id: string;
  team2Id: string;
  team1Name: string;
  team2Name: string;
  team1Members: TeamDebateMember[];
  team2Members: TeamDebateMember[];
  topic: string;
  team1Stance: string;
  team2Stance: string;
  status: string;
  currentTurn: string;
  currentUserId?: string;
  turnCount: number;
  maxTurns: number;
  team1Elo: number;
  team2Elo: number;
  createdAt: string;
  updatedAt: string;
}

// Create a team debate
export const createTeamDebate = async (
  team1Id: string,
  team2Id: string,
  topic: string
): Promise<TeamDebate> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/team-debates/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ team1Id, team2Id, topic }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create debate");
  }

  return response.json();
};

// Get a team debate by ID
export const getTeamDebate = async (debateId: string): Promise<TeamDebate> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/team-debates/${debateId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get debate");
  }

  return response.json();
};

// Get active debate for a team
export const getActiveTeamDebate = async (teamId: string): Promise<TeamDebate> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/team-debates/team/${teamId}/active`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get active debate");
  }

  return response.json();
};

// Matchmaking functions
export const joinMatchmaking = async (teamId: string): Promise<void> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/matchmaking/${teamId}/join`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to join matchmaking");
  }
};

export const leaveMatchmaking = async (teamId: string): Promise<void> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/matchmaking/${teamId}/leave`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to leave matchmaking");
  }
};

export interface MatchmakingPoolTeam {
  teamId: string;
  teamName: string;
  captainId: string;
  maxSize: number;
  averageElo: number;
  membersCount: number;
  timestamp: string;
}

export interface MatchmakingPoolResponse {
  poolSize: number;
  teams: MatchmakingPoolTeam[];
}

export const getMatchmakingPool = async (): Promise<MatchmakingPoolResponse> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/matchmaking/pool`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get matchmaking pool");
  }

  const data: MatchmakingPoolResponse = await response.json();
  return data;
};

export interface MatchmakingStatusResponse {
  matched: boolean;
  team?: {
    id: string;
    name: string;
    captainId: string;
    captainEmail: string;
    members: TeamDebateMember[];
    maxSize: number;
    averageElo: number;
    createdAt: string;
    updatedAt: string;
  };
  matchId?: string;
}

export const getMatchmakingStatus = async (
  teamId: string
): Promise<MatchmakingStatusResponse> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/matchmaking/${teamId}/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get matchmaking status");
  }

  const data: MatchmakingStatusResponse = await response.json();
  return data;
};

