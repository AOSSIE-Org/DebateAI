// Team service for API calls
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:1313";

export interface Team {
  id: string;
  name: string;
  code: string;
  captainId: string;
  captainEmail: string;
  members: TeamMember[];
  maxSize: number;
  averageElo: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
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
  topic: string;
  team1Stance: string;
  team2Stance: string;
  status: "waiting" | "active" | "finished";
  result?: string;
  messages: any[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeamData {
  name: string;
  maxSize?: number; // Optional, defaults to 4
}

export interface CreateTeamDebateData {
  team1Id: string;
  team2Id: string;
  topic: string;
  team1Stance: string;
  team2Stance: string;
}

// Get auth token from local storage
const getAuthToken = () => {
  return localStorage.getItem("token");
};

// Create a new team
export const createTeam = async (data: CreateTeamData): Promise<Team> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/teams/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create team");
  }

  return response.json();
};

// Get a team by ID
export const getTeam = async (teamId: string): Promise<Team> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/teams/${teamId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get team");
  }

  return response.json();
};

// Join a team
export const joinTeam = async (teamId: string): Promise<void> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/teams/${teamId}/join`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to join team");
  }
};

// Leave a team
export const leaveTeam = async (teamId: string): Promise<void> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/teams/${teamId}/leave`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to leave team");
  }
};

// Get user's teams
export const getUserTeams = async (): Promise<Team[]> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/teams/user/teams`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get user teams");
  }

  return response.json();
};

// Get available teams
export const getAvailableTeams = async (): Promise<Team[]> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/teams/available`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get available teams");
  }

  return response.json();
};

// Create a team debate
export const createTeamDebate = async (
  data: CreateTeamDebateData
): Promise<TeamDebate> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/team-debates/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create team debate");
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
    throw new Error("Failed to get team debate");
  }

  return response.json();
};

// Get team debates for a team
export const getTeamDebates = async (
  teamId: string
): Promise<TeamDebate[]> => {
  const token = getAuthToken();
  const response = await fetch(
    `${API_BASE_URL}/team-debates/team/${teamId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get team debates");
  }

  return response.json();
};

// Add team message
export const addTeamMessage = async (
  debateId: string,
  message: string,
  phase: string
): Promise<void> => {
  const token = getAuthToken();
  const response = await fetch(
    `${API_BASE_URL}/team-debates/${debateId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, phase }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to add team message");
  }
};

// Add team chat message
export const addTeamChatMessage = async (
  teamId: string,
  message: string
): Promise<void> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/team-chat/${teamId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error("Failed to add team chat message");
  }
};

// Get team chat messages
export const getTeamChatMessages = async (teamId: string): Promise<any[]> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/team-chat/${teamId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get team chat messages");
  }

  return response.json();
};

// Remove member from team
export const removeMember = async (teamId: string, memberId: string): Promise<void> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/teams/${teamId}/members/${memberId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to remove member");
  }
};

// Delete team
export const deleteTeam = async (teamId: string): Promise<void> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/teams/${teamId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete team");
  }
};

// Get team member profile
export const getTeamMemberProfile = async (memberId: string): Promise<any> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/teams/members/${memberId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get member profile");
  }

  return response.json();
};

// Update team name
export const updateTeamName = async (teamId: string, newName: string): Promise<void> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/teams/${teamId}/name`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: newName }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update team name");
  }
};

// Get team by code
export const getTeamByCode = async (code: string): Promise<Team> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/teams/code/${code}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get team by code");
  }

  return response.json();
};

// Update team size
export const updateTeamSize = async (teamId: string, maxSize: number): Promise<void> => {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}/teams/${teamId}/size`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ maxSize }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update team size");
  }
};

