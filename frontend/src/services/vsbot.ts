import { getAuthToken } from '@/utils/auth';

const baseURL =
  import.meta.env.VITE_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:1313" : undefined);
if (!baseURL) {
  throw new Error("VITE_BASE_URL is not set. Define it in your frontend .env file.");
}

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


// Function to send a message and stream the bot response token-by-token
export const sendDebateMessageStream = async (
  data: DebateRequest,
  onChunk?: (chunk: string, accumulated: string) => void
): Promise<{ response: string; debateId?: string }> => {
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
    throw new Error("Failed to send debate message stream");
  }

  if (!response.body) {
    throw new Error("ReadableStream not supported on response");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let accumulatedText = "";
  let debateId = "";
  let buffer = "";
  let receivedDone = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";

    for (const block of blocks) {
      if (!block.trim()) continue;
      const lines = block.split("\n");
      let eventType = "message";
      let dataStr = "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataStr = line.slice(5).trim();
        }
      }

      if (eventType === "error") {
        let errorMsg = "Stream error";
        if (dataStr) {
          try {
            const parsed = JSON.parse(dataStr);
            errorMsg = parsed.error || parsed.message || dataStr;
          } catch {
            errorMsg = dataStr;
          }
        }
        throw new Error(errorMsg);
      }

      if (dataStr) {
        try {
          const parsed = JSON.parse(dataStr);
          if (eventType === "chunk" && parsed.text) {
            accumulatedText += parsed.text;
            if (onChunk) {
              onChunk(parsed.text, accumulatedText);
            }
          } else if (eventType === "done") {
            receivedDone = true;
            if (parsed.response) {
              accumulatedText = parsed.response;
            }
            if (parsed.debateId) {
              debateId = parsed.debateId;
            }
          }
        } catch (e) {
          console.error("Failed to parse SSE payload:", dataStr, e);
        }
      }
    }
  }

  if (!receivedDone) {
    throw new Error("Stream ended before receiving done event");
  }

  return { response: accumulatedText, debateId };
};


export const concedeDebate = async (debateId: string, history: DebateMessage[] = []): Promise<void> => {
  const token = getAuthToken();
  const response = await fetch(`${baseURL}/vsbot/concede`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    credentials: "include",
    body: JSON.stringify({ debateId, history }),
  });

  if (!response.ok) {
    throw new Error("Failed to concede debate");
  }
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
