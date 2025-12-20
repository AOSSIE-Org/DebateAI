import { getAuthToken } from '@/utils/auth';

const baseURL = import.meta.env.VITE_BASE_URL;

export type DebateMessage = {
  sender: "User" | "Bot" | "Judge";
  text: string;
  phase?: string; // Optional phase field for DebateRoom compatibility
};

export type PhaseTiming = {
  name: string;
  time: number; // Single time value for both user and bot, in seconds
};

export type DebateRequest = {
  botLevel: string;
  topic: string;
  history: DebateMessage[];
  botName: string;
  stance: string;
  phaseTimings?: PhaseTiming[]; // For createDebate
  context?: string; // Added optional context field
};

export type DebateResponse = {
  debateId: string;
  botName: string;
  botLevel: string;
  topic: string;
  stance: string;
  phaseTimings?: PhaseTiming[]; // Included in response for consistency
};

export type JudgeRequest = {
  history: DebateMessage[];
  userId: string;
};

export type JudgeResponse = {
  result: string;
};

// Function to create a new debate
export const createDebate = async (data: DebateRequest): Promise<DebateResponse> => {
  const token = getAuthToken();
  // Convert phaseTimings to backend-compatible format (userTime and botTime)
  const payload = {
    ...data,
    phaseTimings: data.phaseTimings?.map((pt) => ({
      name: pt.name,
      userTime: pt.time,
      botTime: pt.time,
    })),
  };

  const response = await fetch(`${baseURL}/vsbot/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create debate");
  }

  const result = await response.json();
  // Convert back to single time format for frontend consistency
  return {
    ...result,
    phaseTimings: result.phaseTimings?.map((pt: { name: string; userTime: number; botTime: number }) => ({
      name: pt.name,
      time: pt.userTime, // Assuming userTime and botTime are equal
    })),
  };
};

// Function to send a message in an existing debate
export const sendDebateMessage = async (data: DebateRequest): Promise<{ response: string }> => {
  const token = getAuthToken();
  const response = await fetch(`${baseURL}/vsbot/debate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to send debate message");
  }

  const result = await response.json();
  return { response: result.response }; // Adjusted to return bot's response directly
};

// Function to judge a debate
export const judgeDebate = async (data: JudgeRequest): Promise<JudgeResponse> => {
  const token = getAuthToken();
  const response = await fetch(`${baseURL}/vsbot/judge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to judge debate");
  }

  return response.json();
};
