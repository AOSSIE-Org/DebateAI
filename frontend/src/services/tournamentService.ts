import config from "../config/config";
import { getAuthToken } from "@/utils/auth";

const API_BASE_URL =
  config.baseUrl?.replace(/\/+$/, "") ?? "http://localhost:1313";

export interface TournamentParticipant {
  userId: string;
  name: string;
  stance: "for" | "against";
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

interface ApiError {
  error?: string;
  message?: string;
}

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
      throw new Error("Server returned an invalid response. Please try again.");
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