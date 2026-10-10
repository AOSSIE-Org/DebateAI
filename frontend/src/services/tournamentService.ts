import config from "../config/config";
import { getAuthToken } from "@/utils/auth";

const API_BASE_URL =
  config.baseUrl?.replace(/\/+$/, "") ?? "http://localhost:1313";

export interface CreateTournamentData {
  title: string;
  description: string;
  moderatorName: string;
  category: "chat_only" | "voice_only" | "voice_video";
  visibility: "public" | "private";
  minParticipants: number;
  maxParticipants: number;
  startType: "direct" | "scheduled";
  scheduleAt?: string;
}

export interface CreatedTournament {
  id: string;
  title: string;
  description: string;
  moderatorName: string;
  category: CreateTournamentData["category"];
  visibility: CreateTournamentData["visibility"];
  status: "upcoming" | "live" | "completed";
  minParticipants: number;
  maxParticipants: number;
  participants: string[];
  inviteCode?: string;
  scheduleAt?: string;
  createdAt: string;
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

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.error || data.message || `Tournament creation failed (${response.status}).`
    );
  }

  return data as CreatedTournament;
};
