import { getAuthToken } from '@/utils/auth';

const API_BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1313';

export interface SavedDebateTranscript {
  id: string;
  userId: string;
  email: string;
  debateType: 'user_vs_bot' | 'user_vs_user';
  topic: string;
  opponent: string;
  result: 'win' | 'loss' | 'draw' | 'pending';
  messages: Array<{
    sender: string;
    text: string;
    phase?: string;
  }>;
  transcripts?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalityProfileData {
  id: string;
  debateId: string;
  participantId: string;
  argument_style: string;
  tone: string;
  evidence_usage: number;
  clarity: number;
  responsiveness: number;
  summary: string;
}

export interface SaveTranscriptRequest {
  debateType: 'user_vs_bot' | 'user_vs_user';
  topic: string;
  opponent: string;
  result?: string;
  messages: Array<{
    sender: string;
    text: string;
    phase?: string;
  }>;
  transcripts?: Record<string, string>;
}

export interface DebateStats {
  totalDebates: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  recentDebates: Array<{
    topic: string;
    result: 'win' | 'loss' | 'draw' | 'pending';
    opponent: string;
    debateType: 'user_vs_bot' | 'user_vs_user';
    date: string;
    eloChange?: number; // We'll need to add this to the backend
  }>;
}

export const transcriptService = {
  // Save a debate transcript
  async saveTranscript(
    data: SaveTranscriptRequest
  ): Promise<{ message: string }> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(`${API_BASE_URL}/save-transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let msg = 'Request failed';
      try {
        const errorData = await response.json();
        msg =
          errorData.error || errorData.message || response.statusText || msg;
      } catch {
        msg = response.statusText || msg;
      }
      throw new Error(msg);
    }

    return response.json();
  },

  // Get all saved transcripts for the current user
  async getUserTranscripts(): Promise<SavedDebateTranscript[]> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(`${API_BASE_URL}/transcripts`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch transcripts');
    }

    const data = await response.json();
    return data.transcripts || [];
  },

  // Get a specific transcript by ID
  async getTranscriptById(id: string): Promise<SavedDebateTranscript> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(`${API_BASE_URL}/transcript/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch transcript');
    }

    const data = await response.json();
    return data.transcript;
  },

  // Delete a transcript
  async deleteTranscript(id: string): Promise<{ message: string }> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(`${API_BASE_URL}/transcript/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete transcript');
    }

    return response.json();
  },

  // Create a test transcript for debugging
  async createTestTranscript(): Promise<{ message: string }> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(`${API_BASE_URL}/create-test-transcript`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create test transcript');
    }

    return response.json();
  },

  // Create a test bot debate transcript for debugging
  async createTestBotDebate(): Promise<{ message: string }> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(`${API_BASE_URL}/create-test-bot-debate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create test bot debate');
    }

    return response.json();
  },

  // Get debate statistics from saved transcripts
  async getDebateStats(): Promise<DebateStats> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(`${API_BASE_URL}/debate-stats`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch debate stats');
    }

    const data = await response.json();
    return data.stats;
  },

  // Get personality profiles for a debate
  async getPersonalityProfiles(
    debateId: string
  ): Promise<PersonalityProfileData[]> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/debates/${debateId}/personality`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch personality profiles');
    }

    const data = await response.json();
    return data.profiles || [];
  },

  // Generate personality profiles for a debate
  async generatePersonalityProfiles(
    debateId: string
  ): Promise<PersonalityProfileData[]> {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await fetch(
      `${API_BASE_URL}/api/debates/${debateId}/personality`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || 'Failed to generate personality profiles'
      );
    }

    const data = await response.json();
    return data.profiles || [];
  },
};
