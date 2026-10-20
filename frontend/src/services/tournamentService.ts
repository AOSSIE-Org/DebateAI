import config from "../config/config";
import { getAuthToken } from "@/utils/auth";

const API_BASE_URL =
  config.baseUrl?.replace(/\/+$/, "") ?? "http://localhost:1313";

export interface TournamentParticipant {
  userId: string;
  name: string;
  stance: "for" | "against" | "";
}

export interface CreateTournamentData {
  topic: string;
  description: string;
  moderatorName: string;
  visibility: "public" | "private";
  stance: "for" | "against";
  minParticipants: number;
  maxParticipants: number;
  startType: "direct" | "scheduled";
  scheduleAt?: string;
}

export interface CreatedTournament {
  id: string;
  hostId: string;
  moderatorName: string;
  topic: string;
  description: string;
  visibility: "public" | "private";
  status: "upcoming" | "live" | "completed";
  minParticipants: number;
  maxParticipants: number;
  participants: TournamentParticipant[];
  inviteCode?: string;
  scheduleAt?: string;
  createdAt: string;
}

export type Tournament = CreatedTournament;

export interface JoinTournamentResponse {
  message: string;
  tournamentId: string;
  userId: string;
}

interface ApiError {
  error?: string;
  message?: string;
}

const getApiError = async (
  response: Response,
  fallback: string
): Promise<string> => {
  const data = await response.json().catch(() => ({} as ApiError));

  return data.error || data.message || fallback;
};

export const createTournament = async (
  tournament: CreateTournamentData
): Promise<CreatedTournament> => {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in before creating a tournament.");
  }

  const response = await fetch(`${API_BASE_URL}/tournaments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(tournament),
  });

  let data: ApiError | CreatedTournament;

  if (response.ok) {
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Server returned an invalid response. Please try again."
      );
    }
  } else {
    data = await response.json().catch(() => ({} as ApiError));

    const errorData = data as ApiError;

    throw new Error(
      errorData.error ||
        errorData.message ||
        `Tournament creation failed (${response.status}).`
    );
  }

  return data as CreatedTournament;
};

/** Fetches tournaments visible to the authenticated user. */
export const getTournaments = async (): Promise<Tournament[]> => {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in before viewing tournaments.");
  }

  const response = await fetch(`${API_BASE_URL}/tournaments`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      await getApiError(response, "Failed to fetch tournaments.")
    );
  }

  const data = (await response.json()) as Tournament[];

  return data.map((tournament) => ({
    ...tournament,
    participants: tournament.participants ?? [],
  }));
};

/** Fetches a tournament by its persisted backend ID. */
export const getTournamentById = async (
  tournamentId: string
): Promise<Tournament> => {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in before viewing a tournament.");
  }

  const response = await fetch(
    `${API_BASE_URL}/tournaments/${encodeURIComponent(tournamentId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      await getApiError(response, "Failed to fetch tournament.")
    );
  }

  const data = (await response.json()) as Tournament;

  return {
    ...data,
    participants: data.participants ?? [],
  };
};

/** Joins the authenticated user to a public tournament. */
export const joinPublicTournament = async (
  tournamentId: string
): Promise<JoinTournamentResponse> => {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in before joining a tournament.");
  }

  const response = await fetch(
    `${API_BASE_URL}/tournaments/${encodeURIComponent(tournamentId)}/join`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      await getApiError(response, "Failed to join tournament.")
    );
  }

  return response.json();
};
