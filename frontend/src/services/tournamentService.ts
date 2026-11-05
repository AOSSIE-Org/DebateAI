import config from "../config/config";
import { getAuthToken } from "@/utils/auth";

function tournamentBaseURL(): string {
  const baseURL = config.baseUrl;
  if (!baseURL) throw new Error("No valid backend server is configured.");
  return baseURL.replace(/\/+$/, "");
}

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
  revision: number;
  lobbyOpen: boolean;
  executionState?: "running" | "finished";
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
  joinRequests?: TournamentJoinRequest[];
}

export interface TournamentJoinRequest {
  userId: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface TournamentRequestStatus {
  tournamentId: string;
  status: TournamentJoinRequest["status"];
  requestCreatedAt?: string;
}

export interface TournamentPendingRequests {
  tournamentId: string;
  pendingRequests: TournamentJoinRequest[];
  count: number;
  participants: number;
  maxParticipants: number;
  revision: number;
  lobbyOpen: boolean;
}

export class TournamentRequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = "TournamentRequestError"; }
}

async function tournamentRequest<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const token = getAuthToken();
  if (!token) throw new Error("Please sign in to continue.");
  const response = await fetch(`${tournamentBaseURL()}${path}`, {
    method, signal,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new TournamentRequestError(data?.error || `Tournament request failed (${response.status}).`, response.status);
  if (data === null) throw new Error("Server returned an invalid response.");
  return data as T;
}

export const listTournaments = (status = "", signal?: AbortSignal) =>
  tournamentRequest<CreatedTournament[]>(`/tournaments${status ? `?status=${encodeURIComponent(status)}` : ""}`, "GET", undefined, signal);
export const getTournament = (id: string, signal?: AbortSignal) =>
  tournamentRequest<CreatedTournament>(`/tournaments/${encodeURIComponent(id)}`, "GET", undefined, signal);
export const joinTournament = (id: string) =>
  tournamentRequest<CreatedTournament>(`/tournaments/${encodeURIComponent(id)}/join`, "POST", {});
export const requestTournamentAdmission = (inviteCode: string) =>
  tournamentRequest<TournamentRequestStatus>("/tournaments/join", "POST", { inviteCode });
export const getTournamentRequest = (id: string, signal?: AbortSignal) =>
  tournamentRequest<TournamentRequestStatus>(`/tournaments/${encodeURIComponent(id)}/request`, "GET", undefined, signal);
export const getPendingTournamentRequests = (id: string, signal?: AbortSignal) =>
  tournamentRequest<TournamentPendingRequests>(`/tournaments/${encodeURIComponent(id)}/requests`, "GET", undefined, signal);
export const decideTournamentRequest = (id: string, userId: string, status: "approved" | "rejected", requestCreatedAt: string) =>
  tournamentRequest<CreatedTournament>(`/tournaments/${encodeURIComponent(id)}/request/${encodeURIComponent(userId)}`, "PATCH", { action: status === "approved" ? "approve" : "reject", requestCreatedAt });
export const chooseTournamentStance = (id: string, stance: "for" | "against") =>
  tournamentRequest<CreatedTournament>(`/tournaments/${encodeURIComponent(id)}/stance`, "PATCH", { stance });
export const deleteTournament = (id: string) =>
  tournamentRequest<{message: string}>(`/tournaments/${encodeURIComponent(id)}`, "DELETE");

export type TournamentRound = "opening_statement_for" | "opening_statement_against" | "cross_examination_question_for" | "cross_examination_answer_against" | "cross_examination_question_against" | "cross_examination_answer_for" | "closing_statement_for" | "closing_statement_against";
export interface TournamentSlot {
  userId: string;
  status: "pending" | "submitted" | "missing";
  submittedAt?: string;
}
export interface TournamentOwnSubmission extends TournamentSlot { content?: string; contentHash?: string }
export interface TournamentPhase {
  round: TournamentRound;
  status: "waiting" | "open" | "closed";
  openedAt?: string;
  deadlineAt?: string;
  closedAt?: string;
  slots: TournamentSlot[];
  mySubmission?: TournamentOwnSubmission;
}
export interface TournamentExecution {
  viewerId: string;
  tournamentId: string;
  hostId: string;
  topic: string;
  revision: number;
  serverTime: string;
  state: "lobby" | "running" | "finished";
  runId?: string;
  roster: TournamentParticipant[];
  phaseIndex: number;
  phases: TournamentPhase[];
  startedAt?: string;
  finishedAt?: string;
  evaluationState?: string;
}
export interface TournamentReceipt {
  runId: string;
  round: TournamentRound;
  userId: string;
  status: "submitted";
  contentHash: string;
  submittedAt: string;
}
export const startTournament = (id: string) =>
  tournamentRequest<TournamentExecution>(`/tournaments/${encodeURIComponent(id)}/start`, "POST", {});
export const getTournamentExecution = (id: string, signal?: AbortSignal) =>
  tournamentRequest<TournamentExecution>(`/tournaments/${encodeURIComponent(id)}/execution`, "GET", undefined, signal);
export const submitTournamentTranscript = (id: string, runId: string, round: TournamentRound, content: string) =>
  tournamentRequest<TournamentReceipt>(`/tournaments/${encodeURIComponent(id)}/transcript`, "POST", { runId, round, content });

export interface TournamentCriteria { reasoning: number; relevance: number; phaseSkill: number; clarity: number }
export interface TournamentParticipantScore {
  userId: string;
  score: number;
  criteria: TournamentCriteria;
  explanation: string;
  submissionStatus: "submitted" | "missing";
}
export interface TournamentIndividual { userId: string; totalScore: number }
export interface TournamentSideMean { side: "for" | "against"; totalScore: number; participantCount: number; mean: number }
export interface TournamentEvaluation {
  viewerId: string;
  tournamentId: string;
  topic: string;
  revision: number;
  roster: TournamentParticipant[];
  state: "pending" | "running" | "failed" | "completed" | "not_ready" | "legacy_no_evaluation";
  retrying: boolean;
  retryable: boolean;
  errorCode?: string;
  runId?: string;
  rubricVersion?: string;
  provider?: string;
  model?: string;
  completedAt?: string;
  result?: Record<TournamentRound, { scores: TournamentParticipantScore[] }>;
  winner?: { side: "for" | "against" | "draw"; individual: TournamentIndividual | null; tiedIndividuals: TournamentIndividual[] };
  totals?: TournamentIndividual[];
  sideMeans?: TournamentSideMean[];
}
export const getTournamentEvaluation = (id: string, signal?: AbortSignal) =>
  tournamentRequest<TournamentEvaluation>(`/tournaments/${encodeURIComponent(id)}/evaluation`, "GET", undefined, signal);

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

  const response = await fetch(`${tournamentBaseURL()}/tournaments`, {
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
