import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";

import JudgmentPopup from "@/components/JudgementPopup";
import SpeechTranscripts from "@/components/SpeechTranscripts";
import { useUser } from "@/hooks/useUser";
import { getAuthToken } from "@/utils/auth";
import ReconnectingWebSocket from "reconnecting-websocket";
import { useAtom } from "jotai";
import {
  presenceAtom,
  questionsAtom,
  pollStateAtom,
  PollInfo,
} from "@/atoms/debateAtoms";
import { useDebateWS } from "@/hooks/useDebateWS";

// Define debate phases as an enum
enum DebatePhase {
  Setup = "setup",
  OpeningFor = "openingFor",
  OpeningAgainst = "openingAgainst",
  CrossForQuestion = "crossForQuestion",
  CrossAgainstAnswer = "crossAgainstAnswer",
  CrossAgainstQuestion = "crossAgainstQuestion",
  CrossForAnswer = "crossForAnswer",
  ClosingFor = "closingFor",
  ClosingAgainst = "closingAgainst",
  Finished = "finished",
}

// Define debate roles
type DebateRole = "for" | "against";

type JudgmentData = {
  opening_statement: {
    for: { score: number; reason: string };
    against: { score: number; reason: string };
  };
  cross_examination_questions: {
    for: { score: number; reason: string };
    against: { score: number; reason: string };
  };
  cross_examination_answers: {
    for: { score: number; reason: string };
    against: { score: number; reason: string };
  };
  closing: {
    for: { score: number; reason: string };
    against: { score: number; reason: string };
  };
  total: { for: number; against: number };
  verdict: {
    winner: string;
    reason: string;
    congratulations: string;
    opponent_analysis: string;
  };
};

type RatingSummary = {
  for: { rating: number; change: number };
  against: { rating: number; change: number };
};

// Define user details interface
interface UserDetails {
  id: string;
  username: string;
  elo: number;
  avatarUrl?: string;
  displayName?: string;
  email?: string;
}

// Define WebSocket message structure
interface WSMessage {
  type: string;
  topic?: string;
  role?: DebateRole;
  ready?: boolean;
  phase?: DebatePhase;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  message?: string;
  userDetails?: UserDetails;
  roomParticipants?: UserDetails[];
  // Enhanced chat fields
  userId?: string;
  username?: string;
  timestamp?: number;
  mode?: "type" | "speak";
  isTyping?: boolean;
  isSpeaking?: boolean;
  partialText?: string;
  // Automatic muting fields
  isMuted?: boolean;
  currentTurn?: string;
  speechText?: string;
  liveTranscript?: string;
  requestId?: string;
  connectionId?: string;
  targetUserId?: string;
  spectatorCount?: number;
  spectator?: {
    connectionId: string;
    spectatorUserId?: string;
    spectatorDisplayName?: string;
  };
}

// Define phase durations in seconds
const phaseDurations: { [key in DebatePhase]?: number } = {
  [DebatePhase.OpeningFor]: 30,
  [DebatePhase.OpeningAgainst]: 30,
  [DebatePhase.CrossForQuestion]: 30,
  [DebatePhase.CrossAgainstAnswer]: 30,
  [DebatePhase.CrossAgainstQuestion]: 30,
  [DebatePhase.CrossForAnswer]: 30,
  [DebatePhase.ClosingFor]: 30,
  [DebatePhase.ClosingAgainst]: 30,
};

// Function to extract JSON from response
const extractJSON = (response: string): string => {
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = fenceRegex.exec(response);
  if (match && match[1]) return match[1].trim();
  return response;
};
const BASE_URL = import.meta.env.VITE_BASE_URL || window.location.origin;

const WS_BASE_URL = BASE_URL.replace(
  /^https?/,
  (match: string) => (match === "https" ? "wss" : "ws")
);


const OnlineDebateRoom = (): JSX.Element => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user: currentUser } = useUser();
  const currentUserId = currentUser?.id ?? null;
  useDebateWS(roomId ?? null);
  const [audienceQuestions] = useAtom(questionsAtom);
  const [spectatorPresence] = useAtom(presenceAtom);
  const [pollState] = useAtom(pollStateAtom);
  const recentQuestions = useMemo(
    () =>
      audienceQuestions
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10),
    [audienceQuestions]
  );
  const audiencePolls = useMemo(() => Object.values(pollState), [pollState]);

  // User state management
  const [localUser, setLocalUser] = useState<UserDetails | null>(null);
  const [opponentUser, setOpponentUser] = useState<UserDetails | null>(null);
  const [roomParticipants, setRoomParticipants] = useState<UserDetails[]>([]);
  const [roomOwnerId, setRoomOwnerId] = useState<string | null>(null);

  const isRoomOwner = Boolean(roomOwnerId && currentUserId === roomOwnerId);

  // Refs for WebSocket, PeerConnection, and media elements
  const wsRef = useRef<ReconnectingWebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const spectatorPCsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const spectatorOfferQueueRef = useRef<
    { connectionId: string; requestId?: string }[]
  >([]);
  const spectatorPendingCandidatesRef = useRef<
    Map<string, RTCIceCandidateInit[]>
  >(new Map());
  const spectatorBaseIdRef = useRef<Map<string, Set<string>>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const localRoleRef = useRef<DebateRole | null>(null);
  const currentUserIdRef = useRef<string | null>(currentUserId);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const judgePollRef = useRef<NodeJS.Timeout | null>(null);
  const submissionStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (judgePollRef.current) {
        clearInterval(judgePollRef.current);
        judgePollRef.current = null;
      }
    };
  }, []);

  // State for debate setup and signaling
  const [topic, setTopic] = useState("");
  const [localRole, setLocalRole] = useState<DebateRole | null>(null);
  const [peerRole, setPeerRole] = useState<DebateRole | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [peerReady, setPeerReady] = useState(false);
  const [debatePhase, setDebatePhase] = useState<DebatePhase>(
    DebatePhase.Setup
  );

  // State for media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // State for automatic muting
  const [isAutoMuted, setIsAutoMuted] = useState(false);
  const [speechTranscripts, setSpeechTranscripts] = useState<{
    [key: string]: string;
  }>({});

  // Timer state
  const [timer, setTimer] = useState<number>(0);

  // Audio recording state
  const [, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isManualRecording, setIsManualRecording] = useState(false);

  // Speech recognition state
  const [isListening, setIsListening] = useState(false);
  const [, setCurrentTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [, setSpeechError] = useState<string | null>(null);
  const retryCountRef = useRef<number>(0);
  const manualRecordingRef = useRef(false);

  const cleanupSpectatorConnection = useCallback((connectionId: string) => {
    const pc = spectatorPCsRef.current.get(connectionId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // Ignore close errors
      }
      spectatorPCsRef.current.delete(connectionId);
      spectatorPendingCandidatesRef.current.delete(connectionId);
    }
    spectatorBaseIdRef.current.forEach((set, baseId) => {
      if (set.has(connectionId)) {
        set.delete(connectionId);
        if (set.size === 0) {
          spectatorBaseIdRef.current.delete(baseId);
        }
      }
    });
  }, []);

  const cleanupSpectatorConnectionsByBase = useCallback(
    (baseConnectionId: string) => {
      const connectionIdsToCleanup: string[] = [];
      spectatorPCsRef.current.forEach((_, key) => {
        if (
          key === baseConnectionId ||
          key.startsWith(`${baseConnectionId}:`)
        ) {
          connectionIdsToCleanup.push(key);
        }
      });

      connectionIdsToCleanup.forEach((id) => cleanupSpectatorConnection(id));
      spectatorBaseIdRef.current.delete(baseConnectionId);
      spectatorOfferQueueRef.current = spectatorOfferQueueRef.current.filter(
        (queued) => queued.connectionId !== baseConnectionId
      );
    },
    [cleanupSpectatorConnection]
  );

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    localRoleRef.current = localRole;
  }, [localRole]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const startSpectatorOffer = useCallback(
    async (baseConnectionId: string, requestId?: string) => {
      const ws = wsRef.current;
      const stream = localStreamRef.current;
      const userId = currentUserIdRef.current;
      const role = localRoleRef.current;

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      if (!stream || !userId) {
        return;
      }

      const normalizedBaseId =
        baseConnectionId && baseConnectionId.length > 0
          ? baseConnectionId
          : `spectator-${Math.random().toString(36).slice(2)}`;
      const connectionId = `${normalizedBaseId}:${userId}`;

      if (spectatorPCsRef.current.has(connectionId)) {
        cleanupSpectatorConnection(connectionId);
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      spectatorPCsRef.current.set(connectionId, pc);
      spectatorPendingCandidatesRef.current.set(connectionId, []);
      const existingSet =
        spectatorBaseIdRef.current.get(normalizedBaseId) ?? new Set<string>();
      existingSet.add(connectionId);
      spectatorBaseIdRef.current.set(normalizedBaseId, existingSet);

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "candidate",
              candidate: event.candidate,
              userId,
              connectionId,
            })
          );
        }
      };

      const handleConnectionStateChange = () => {
        const state = pc.connectionState ?? pc.iceConnectionState;
        if (
          state === "failed" ||
          state === "disconnected" ||
          state === "closed"
        ) {
          cleanupSpectatorConnection(connectionId);
        }
      };

      pc.oniceconnectionstatechange = handleConnectionStateChange;
      pc.onconnectionstatechange = handleConnectionStateChange;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(
          JSON.stringify({
            type: "offer",
            offer,
            userId,
            connectionId,
            requestId,
            role,
          })
        );
      } catch (error) {
        cleanupSpectatorConnection(connectionId);
      }
    },
    [cleanupSpectatorConnection]
  );

  const flushSpectatorOfferQueue = useCallback(() => {
    const streamReady = Boolean(localStreamRef.current);
    const userReady = Boolean(currentUserIdRef.current);
    const wsReady =
      wsRef.current && wsRef.current.readyState === WebSocket.OPEN;

    if (!streamReady || !userReady || !wsReady) {
      return;
    }

    const queue = spectatorOfferQueueRef.current;
    if (queue.length === 0) {
      return;
    }

    spectatorOfferQueueRef.current = [];
    queue.forEach(({ connectionId, requestId }) => {
      startSpectatorOffer(connectionId, requestId);
    });
  }, [startSpectatorOffer]);

  const queueSpectatorOffer = useCallback(
    (connectionId: string, requestId?: string) => {
      if (!connectionId) {
        const generatedId =
          typeof window !== "undefined" && window.crypto?.randomUUID
            ? window.crypto.randomUUID()
            : `spectator-${Math.random().toString(36).slice(2)}`;
        connectionId = generatedId;
      }

      spectatorOfferQueueRef.current = spectatorOfferQueueRef.current.filter(
        (queued) => queued.connectionId !== connectionId
      );
      spectatorOfferQueueRef.current.push({ connectionId, requestId });
      flushSpectatorOfferQueue();
    },
    [flushSpectatorOfferQueue]
  );

  const processSpectatorOfferRequest = useCallback(
    (message: WSMessage) => {
      const connectionId = message.connectionId ?? "";
      queueSpectatorOffer(connectionId, message.requestId);
    },
    [queueSpectatorOffer]
  );

  useEffect(() => {
    flushSpectatorOfferQueue();
  }, [localStream, currentUserId, flushSpectatorOfferQueue]);

  useEffect(() => {
    flushSpectatorOfferQueue();
  }, [localRole, flushSpectatorOfferQueue]);

  // Popup and countdown state
  const [showSetupPopup, setShowSetupPopup] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Predefined debate topics
  const predefinedTopics = [
    "Should social media platforms be regulated more strictly?",
    "Is remote work better than office work?",
    "Should college education be free for everyone?",
    "Are video games beneficial for children?",
    "Should there be a universal basic income?",
    "Is artificial intelligence a threat to humanity?",
    "Should the voting age be lowered to 16?",
    "Are electric vehicles better than traditional cars?",
    "Should junk food be banned in schools?",
    "Is online learning as effective as traditional education?",
  ];

  // Judgment states
  const [popup, setPopup] = useState<{
    show: boolean;
    message: string;
    isJudging?: boolean;
  }>({ show: false, message: "" });
  const [judgmentData, setJudgmentData] = useState<JudgmentData | null>(null);
  const [showJudgment, setShowJudgment] = useState(false);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(
    null
  );

  // Ordered list of debate phases
  const phaseOrder = useMemo<DebatePhase[]>(
    () => [
      DebatePhase.OpeningFor,
      DebatePhase.OpeningAgainst,
      DebatePhase.CrossForQuestion,
      DebatePhase.CrossAgainstAnswer,
      DebatePhase.CrossAgainstQuestion,
      DebatePhase.CrossForAnswer,
      DebatePhase.ClosingFor,
      DebatePhase.ClosingAgainst,
      DebatePhase.Finished,
    ],
    []
  );

  // Determine if it's the local user's turn to speak
  const isMyTurn =
    localRole ===
    (debatePhase.includes("For")
      ? "for"
      : debatePhase.includes("Against")
      ? "against"
      : null);

  const startJudgmentPolling = useCallback(
    (role: DebateRole) => {
      const token = getAuthToken();
      if (!token) {
        setPopup({
          show: true,
          message: "Session expired. Please sign in again.",
          isJudging: false,
        });
        submissionStartedRef.current = false;
        return;
      }

      if (judgePollRef.current) {
        return;
      }

      judgePollRef.current = setInterval(async () => {
        try {
          const pollResponse = await fetch(
            `${BASE_URL}/submit-transcripts`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ roomId, role, transcripts: {} }),
            }
          );

          if (!pollResponse.ok) {
            if (pollResponse.status === 401) {
              setPopup({
                show: true,
                message: "Session expired. Please sign in again.",
                isJudging: false,
              });
            }
            if (judgePollRef.current) {
              clearInterval(judgePollRef.current);
              judgePollRef.current = null;
            }
            submissionStartedRef.current = false;
            return;
          }

          const pollData = await pollResponse.json();
          if (pollData.ratingSummary) {
            setRatingSummary(pollData.ratingSummary as RatingSummary);
          }
          if (
            pollData.message === "Debate judged" ||
            pollData.message === "Debate already judged"
          ) {
            if (judgePollRef.current) {
              clearInterval(judgePollRef.current);
              judgePollRef.current = null;
            }
            const jsonString = extractJSON(pollData.result);
            const judgment: JudgmentData = JSON.parse(jsonString);
            setJudgmentData(judgment);
            setPopup({ show: false, message: "" });
            setShowJudgment(true);
            submissionStartedRef.current = false;
          }
        } catch (error) {
          if (judgePollRef.current) {
            clearInterval(judgePollRef.current);
            judgePollRef.current = null;
          }
          submissionStartedRef.current = false;
          console.error("Error retrieving judgment:", error);
          setPopup({
            show: true,
            message:
              "Error occurred while retrieving judgment. Please try again.",
            isJudging: false,
          });
        }
      }, 2000);
    },
    [roomId, setPopup, setRatingSummary]
  );

  // Function to send transcripts to backend
  const sendTranscriptsToBackend = useCallback(
    async (
      roomId: string,
      role: DebateRole,
      transcripts: { [key in DebatePhase]?: string },
      opponentRole: DebateRole,
      opponentId: string | null,
      opponentEmail: string | null,
      opponentTranscripts: { [key in DebatePhase]?: string }
    ) => {
      if (!isRoomOwner) {
        return null;
      }

      const token = getAuthToken();
      if (!token) {
        throw new Error("No auth token found. Please sign in again.");
      }

      try {
        const response = await fetch(
          `${BASE_URL}/submit-transcripts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              roomId,
              role,
              transcripts,
              opponentRole,
              opponentId,
              opponentEmail,
              opponentTranscripts,
            }),
          }
        );

        if (!response.ok) {
          if (response.status === 401) {
            setPopup({
              show: true,
              message: "Session expired. Please sign in again.",
              isJudging: false,
            });
          }
          throw new Error(
            `Failed to send transcripts: ${response.status} ${response.statusText}`
          );
        }

        const result = await response.json();
        if (result.ratingSummary) {
          setRatingSummary(result.ratingSummary as RatingSummary);
        }

        if (result.message === "Waiting for opponent submission") {
          if (judgePollRef.current) {
            clearInterval(judgePollRef.current);
            judgePollRef.current = null;
          }
          startJudgmentPolling(role);
          return null;
        }

        if (
          result.message === "Debate judged" ||
          result.message === "Debate already judged"
        ) {
          const jsonString = extractJSON(result.result);
          const judgment: JudgmentData = JSON.parse(jsonString);
          return judgment;
        }
      } catch (error) {
        if (judgePollRef.current) {
          clearInterval(judgePollRef.current);
          judgePollRef.current = null;
        }
        throw error;
      }

      return null;
    },
    [isRoomOwner, setPopup, setRatingSummary, startJudgmentPolling]
  );

  // Log message history, collect transcripts, and send to backend
  const logMessageHistory = useCallback(async () => {
    if (submissionStartedRef.current) {
      return;
    }

    if (!localRole) {
      setPopup({
        show: true,
        message: "Please select a role before the debate ends.",
        isJudging: false,
      });
      return;
    }

    if (!isRoomOwner) {
      submissionStartedRef.current = true;
      setPopup({
        show: true,
        message: "Waiting for debate judgment...",
        isJudging: true,
      });
      startJudgmentPolling(localRole);
      return;
    }

    submissionStartedRef.current = true;

    const gatherTranscriptsForRole = (role: DebateRole) => {
      const rolePhases =
        role === "for"
          ? [
              DebatePhase.OpeningFor,
              DebatePhase.CrossForQuestion,
              DebatePhase.CrossForAnswer,
              DebatePhase.ClosingFor,
            ]
          : [
              DebatePhase.OpeningAgainst,
              DebatePhase.CrossAgainstAnswer,
              DebatePhase.CrossAgainstQuestion,
              DebatePhase.ClosingAgainst,
            ];

      return rolePhases.reduce((acc, phase) => {
        const storageKey = `${roomId}_${phase}_${role}`;
        const stored = storageKey ? localStorage.getItem(storageKey) : null;
        const fromState = speechTranscripts[phase] ?? "";
        const combined =
          (typeof fromState === "string" && fromState.trim().length > 0
            ? fromState
            : stored || "") || "";
        acc[phase] = combined.trim().length > 0 ? combined : "No response";
        return acc;
      }, {} as { [key in DebatePhase]?: string });
    };

    const ownerTranscripts = gatherTranscriptsForRole(localRole);
    const opponentRole: DebateRole = localRole === "for" ? "against" : "for";
    const opponentTranscripts = gatherTranscriptsForRole(opponentRole);

    const opponentDetails =
      opponentUser ||
      roomParticipants.find(
        (participant) => participant.id !== currentUser?.id
      ) ||
      null;

    const opponentId = opponentDetails?.id ?? null;
    const opponentEmail =
      (opponentDetails as UserDetails & { email?: string })?.email ?? null;

    setRatingSummary(null);
    setPopup({
      show: true,
      message: "Submitting transcripts and awaiting judgment...",
      isJudging: true,
    });

    if (roomId && localRole) {
      try {
        const judgment = await sendTranscriptsToBackend(
          roomId,
          localRole,
          ownerTranscripts,
          opponentRole,
          opponentId,
          opponentEmail,
          opponentTranscripts
        );
        if (judgment) {
          setJudgmentData(judgment);
          setPopup({ show: false, message: "" });
          setShowJudgment(true);
        } else {
          // Let manual judging kick in later
          submissionStartedRef.current = false;
        }
      } catch (error) {
        console.error(
          `Failed to send transcripts to backend for ${localRole}:`,
          error
        );
        submissionStartedRef.current = false;
        setPopup({
          show: false,
          message: "Error occurred while judging. Please try again.",
        });
      }
    } else {
      submissionStartedRef.current = false;
      console.warn(
        `Cannot send transcripts. roomId: ${roomId}, localRole: ${localRole}`
      );
      setPopup({ show: false, message: "" });
    }
  }, [
    localRole,
    roomId,
    isRoomOwner,
    speechTranscripts,
    opponentUser,
    roomParticipants,
    currentUser,
    sendTranscriptsToBackend,
    startJudgmentPolling,
  ]);

  const handleConcede = useCallback(() => {
    if (window.confirm("Are you sure you want to concede? This will count as a loss.")) {
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: "concede",
          room: roomId,
          userId: currentUserId,
          username: currentUser?.displayName || "User"
        }));
      }
      setDebatePhase(DebatePhase.Finished);
      setPopup({
        show: true,
        message: "You have conceded the debate.",
        isJudging: false,
      });
    }
  }, [roomId, currentUserId, currentUser, setDebatePhase, setPopup]);

  const handlePhaseDone = useCallback(() => {
    const currentIndex = phaseOrder.indexOf(debatePhase);
    console.debug(
      `handlePhaseDone called for ${localRole}. Current phase: ${debatePhase}, Index: ${currentIndex}`
    );
    if (currentIndex >= 0 && currentIndex < phaseOrder.length - 1) {
      const nextPhase = phaseOrder[currentIndex + 1];
      console.debug(
        `Transitioning to next phase: ${nextPhase} for role: ${localRole}`
      );
      setDebatePhase(nextPhase);
      wsRef.current?.send(
        JSON.stringify({ type: "phaseChange", phase: nextPhase })
      );
    } else if (!localRole || !peerRole) {
      setPopup({
        show: true,
        message: "Both debaters must select roles to finish the debate.",
      });
    }
  }, [debatePhase, localRole, peerRole, phaseOrder, setDebatePhase, setPopup]);

  // Set timer based on phase duration
  useEffect(() => {
    if (phaseDurations[debatePhase]) {
      setTimer(phaseDurations[debatePhase]!);
    } else {
      setTimer(0);
    }
  }, [debatePhase]);

  // Timer countdown and phase transition
  useEffect(() => {
    if (timer > 0 && debatePhase !== DebatePhase.Finished) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            if (isMyTurn && localRole) {
              // Save any existing transcript for this phase
              const existingTranscript =
                speechTranscripts[debatePhase] || "No response";
              localStorage.setItem(
                `${roomId}_${debatePhase}_${localRole}`,
                existingTranscript
              );
              console.debug(
                `Timer expired for ${localRole} in ${debatePhase}. Transcript saved:`,
                existingTranscript
              );
            }
            handlePhaseDone();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    timer,
    debatePhase,
    isMyTurn,
    speechTranscripts,
    localRole,
    roomId,
    handlePhaseDone,
  ]);

  // Function to create a room if it doesn't exist
  const createRoomIfNeeded = useCallback(async () => {
    if (!roomId || !currentUser) return;

    try {
      const token = getAuthToken();
      const response = await fetch(`${BASE_URL}/rooms`, {

        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "public",
          roomId: roomId,
        }),
      });

      if (response.ok) {
        if (currentUser?.id) {
          setRoomOwnerId(currentUser.id);
        }
        return true;
      }
    } catch (error) {
      console.error("Failed to create room:", error);
    }
    return false;
  }, [roomId, currentUser, setRoomOwnerId]);

  // Function to fetch room participants
  const fetchRoomParticipants = useCallback(
    async (retryCount = 0) => {
      if (!roomId) return;

      setIsLoading(true);
      try {
        const token = getAuthToken();
        const response = await fetch(
          `${BASE_URL}/rooms/${roomId}/participants`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const participants: UserDetails[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.participants)
            ? data.participants
            : [];
          const ownerIdFromServer: string | null = Array.isArray(data)
            ? null
            : data?.ownerId ?? null;

          setRoomParticipants(participants);

          setRoomOwnerId((prev) => {
            if (ownerIdFromServer) {
              return ownerIdFromServer;
            }
            const fallbackOwner =
              participants.length > 0 ? participants[0].id : null;
            if (!fallbackOwner) {
              return prev;
            }
            return prev === fallbackOwner ? prev : fallbackOwner;
          });

          // Set local and opponent user details
          if (currentUser && participants.length >= 1) {
            const localParticipant = participants.find(
              (p: UserDetails) =>
                p.id === currentUser.id || p.email === currentUser.email
            );
            const opponentParticipant = participants.find(
              (p: UserDetails) =>
                (p.id !== currentUser.id || !p.id) &&
                p.email !== currentUser.email
            );

            if (localParticipant) {
              const localUserData = {
                ...localParticipant,
                avatarUrl:
                  currentUser.avatarUrl ||
                  localParticipant.avatarUrl ||
                  "https://avatar.iran.liara.run/public/40",
                displayName:
                  currentUser.displayName ||
                  localParticipant.displayName ||
                  currentUser.email ||
                  "You",
              };
              setLocalUser(localUserData);
              localStorage.setItem("userAvatar", localUserData.avatarUrl || "");
            } else {
              // Fallback to current user data if not found in participants
              const fallbackLocal: UserDetails = {
                id: currentUser.id || "unknown",
                username: currentUser.displayName || "User",
                displayName: currentUser.displayName || "User",
                elo: currentUser.rating || 1500,
                avatarUrl:
                  currentUser.avatarUrl ||
                  "https://avatar.iran.liara.run/public/40",
                email: currentUser.email || "",
              };
              setLocalUser(fallbackLocal);
              localStorage.setItem("userAvatar", fallbackLocal.avatarUrl || "");
            }

            if (opponentParticipant) {
              const opponentData = {
                ...opponentParticipant,
                avatarUrl:
                  opponentParticipant.avatarUrl ||
                  "https://avatar.iran.liara.run/public/31",
              };
              setOpponentUser(opponentData);
              localStorage.setItem(
                "opponentAvatar",
                opponentData.avatarUrl || ""
              );
            } else {
              setOpponentUser(null);
            }
          } else {
            // Fallback to current user data
            if (currentUser) {
              setLocalUser({
                id: currentUser.id || "unknown",
                username: currentUser.displayName || "User",
                displayName: currentUser.displayName || "User",
                elo: currentUser.rating || 1500,
                avatarUrl: currentUser.avatarUrl,
              });
            }
          }
        } else {
          console.error(
            "API response not ok:",
            response.status,
            response.statusText
          );

          // If room not found (404), it might still be being created
          if (response.status === 404 && retryCount < 5) {
            console.warn(
              `Room not found, might still be creating. Retry ${
                retryCount + 1
              }/5 in 2 seconds...`
            );

            // Try to create the room if it's the first retry
            if (retryCount === 0) {
              await createRoomIfNeeded();
            }

            setTimeout(() => {
              fetchRoomParticipants(retryCount + 1);
            }, 2000);
            return;
          }

          // Fallback: use current user as local user and create a placeholder opponent
          if (currentUser) {
            const fallbackLocalUser = {
              id: currentUser.id || "",
              username: currentUser.displayName || "You",
              elo: currentUser.rating || 1500,
              avatarUrl:
                currentUser.avatarUrl ||
                "https://avatar.iran.liara.run/public/40",
              displayName: currentUser.displayName || "You",
            };
            setLocalUser(fallbackLocalUser);
            setRoomOwnerId((prev) => prev ?? currentUser.id ?? null);
          }
        }
      } catch (error) {
        console.error("Failed to fetch room participants:", error);
        // Fallback: use current user as local user and create a placeholder opponent
        if (currentUser) {
          const errorFallbackLocalUser = {
            id: currentUser.id || "",
            username: currentUser.displayName || "You",
            elo: currentUser.rating || 1500,
            avatarUrl: currentUser.avatarUrl,
            displayName: currentUser.displayName,
          };
          console.warn(
            "Setting error fallback local user:",
            errorFallbackLocalUser
          );
          setLocalUser(errorFallbackLocalUser);
          setRoomOwnerId((prev) => prev ?? currentUser.id ?? null);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      roomId,
      currentUser,
      createRoomIfNeeded,
      setIsLoading,
      setLocalUser,
      setOpponentUser,
      setRoomOwnerId,
      setRoomParticipants,
    ]
  );

  // Initialize WebSocket, RTCPeerConnection, and media
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const token = getAuthToken();
    if (!token || !roomId) return;

   const wsUrl = `${WS_BASE_URL}/ws?room=${roomId}&token=${token}`;

    const rws = new ReconnectingWebSocket(wsUrl, [], {
      connectionTimeout: 4000,
      maxRetries: Infinity,
      maxReconnectionDelay: 10000,
      minReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1.3,
    });
    wsRef.current = rws;

    rws.onopen = () => {
      rws.send(JSON.stringify({ type: "join", room: roomId }));
      // Wait a bit before fetching participants to ensure room is fully created
      setTimeout(() => {
        fetchRoomParticipants();
      }, 1000);
      getMedia();
      flushSpectatorOfferQueue();
    };

    rws.onmessage = async (event) => {
      const data: WSMessage = JSON.parse(event.data);
      switch (data.type) {
        case "topicChange":
          if (data.topic !== undefined) setTopic(data.topic);
          break;
        case "roleSelection":
          if (data.role) setPeerRole(data.role);
          break;
        case "ready":
          if (data.ready !== undefined) setPeerReady(data.ready);
          break;
        case "phaseChange":
          if (data.phase) {
            console.debug(
              `Received phase change to ${data.phase}. Local role: ${localRole}`
            );
            setDebatePhase(data.phase);
          }
          break;
        case "message":
          if (data.message && peerRole) {
            // Store in speech transcripts for the current phase
            setSpeechTranscripts((prev) => ({
              ...prev,
              [debatePhase]: (prev[debatePhase] || "") + " " + data.message,
            }));
          }
          break;
        case "autoMuteStatus":
          if (data.userId === currentUser?.id) {
            setIsAutoMuted(data.isMuted || false);

            // Automatically mute/unmute microphone based on turn
            if (localStream) {
              const audioTrack = localStream.getAudioTracks()[0];
              if (audioTrack) {
                audioTrack.enabled = !data.isMuted;
              }
            }
          }
          break;
        case "speechText":
          if (data.userId && data.speechText) {
            // Store speech text in transcripts for the specified phase
            const targetPhase = data.phase || debatePhase;
            setSpeechTranscripts((prev) => {
              const updated = {
                ...prev,
                [targetPhase]:
                  (prev[targetPhase] || "") + " " + data.speechText,
              };
              return updated;
            });
          }
          break;
        case "liveTranscript":
          if (
            data.userId &&
            data.liveTranscript &&
            data.userId !== currentUser?.id
          ) {
            // Only update if it's from the opponent
            setCurrentTranscript(data.liveTranscript);
          }
          break;
        case "userDetails":
          if (data.userDetails) {
            if (data.userDetails.id === currentUser?.id) {
              setLocalUser(data.userDetails);
            } else {
              setOpponentUser(data.userDetails);
            }
          }
          break;
        case "roomParticipants":
          if (data.roomParticipants) {
            console.debug(
              "Received room participants update:",
              data.roomParticipants
            );
            setRoomParticipants(data.roomParticipants);
            // Update local and opponent user details when participants change
            if (currentUser && data.roomParticipants.length >= 1) {
              const localParticipant = data.roomParticipants.find(
                (p: UserDetails) =>
                  p.id === currentUser.id || p.email === currentUser.email
              );
              const opponentParticipant = data.roomParticipants.find(
                (p: UserDetails) =>
                  (p.id && p.id !== currentUser.id) ||
                  (!p.id && p.email && p.email !== currentUser.email)
              );

              if (localParticipant) {
                setLocalUser({
                  ...localParticipant,
                  avatarUrl:
                    currentUser.avatarUrl || localParticipant.avatarUrl,
                  displayName:
                    currentUser.displayName || localParticipant.displayName,
                });
              } else {
                // Fallback to current user data
                setLocalUser({
                  id: currentUser.id || "unknown",
                  username:
                    currentUser.displayName || currentUser.email || "User",
                  displayName:
                    currentUser.displayName || currentUser.email || "User",
                  elo: currentUser.rating || 1500,
                  avatarUrl: currentUser.avatarUrl,
                });
              }

              if (opponentParticipant) {
                setOpponentUser({
                  ...opponentParticipant,
                  avatarUrl:
                    opponentParticipant.avatarUrl ||
                    "https://avatar.iran.liara.run/public/31",
                });
              } else {
                setOpponentUser(null);
              }
            }
          }
          break;
        case "concede":
          setDebatePhase(DebatePhase.Finished);
          setPopup({
            show: true,
            message: `${data.username || "Opponent"} has conceded the debate. You win!`,
            isJudging: false,
          });
          break;
        case "spectatorJoined":
          if (data.spectator?.connectionId) {
            queueSpectatorOffer(
              data.spectator.connectionId,
              data.spectator.connectionId
            );
          }
          break;
        case "spectatorLeft":
          if (data.spectator?.connectionId) {
            cleanupSpectatorConnectionsByBase(data.spectator.connectionId);
          }
          break;
        case "requestOffer":
          await processSpectatorOfferRequest(data);
          break;
        case "offer":
          if (data.connectionId) {
            // Offers from spectators are not expected for debaters
            break;
          }
          if (pcRef.current && data.offer) {
            await pcRef.current.setRemoteDescription(data.offer!);
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            wsRef.current?.send(JSON.stringify({ type: "answer", answer }));
          }
          break;
        case "answer":
          if (data.connectionId && data.targetUserId === currentUserId) {
            const spectatorPc = data.connectionId
              ? spectatorPCsRef.current.get(data.connectionId)
              : null;
            if (spectatorPc && data.answer) {
              try {
                await spectatorPc.setRemoteDescription(data.answer);
                const pending = spectatorPendingCandidatesRef.current.get(
                  data.connectionId
                );
                if (pending && pending.length > 0) {
                  for (const candidate of pending) {
                    try {
                      await spectatorPc.addIceCandidate(candidate);
                    } catch (err) {}
                  }
                  spectatorPendingCandidatesRef.current.delete(
                    data.connectionId
                  );
                }
              } catch {
                cleanupSpectatorConnection(data.connectionId);
              }
            }
          } else if (
            data.connectionId &&
            data.targetUserId &&
            data.targetUserId !== currentUserId
          ) {
            // Spectator answer meant for the other debater; ignore.
          } else if (pcRef.current && data.answer) {
            await pcRef.current.setRemoteDescription(data.answer);
          }
          break;
        case "candidate":
          if (data.connectionId) {
            if (data.userId && data.userId !== currentUserId) {
              // Candidate is intended for the other debater's copy of this spectator connection.
              break;
            }
            const spectatorPc = spectatorPCsRef.current.get(data.connectionId);
            if (spectatorPc && data.candidate) {
              try {
                if (
                  spectatorPc.remoteDescription &&
                  spectatorPc.remoteDescription.type
                ) {
                  await spectatorPc.addIceCandidate(data.candidate);
                } else {
                  const queue =
                    spectatorPendingCandidatesRef.current.get(
                      data.connectionId
                    ) ?? [];
                  queue.push(data.candidate);
                  spectatorPendingCandidatesRef.current.set(
                    data.connectionId,
                    queue
                  );
                }
              } catch (err) {
                cleanupSpectatorConnection(data.connectionId);
              }
            } else if (!spectatorPc) {
            }
          } else if (pcRef.current && data.candidate) {
            await pcRef.current.addIceCandidate(data.candidate);
          }
          break;
      }
    };

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "candidate", candidate: event.candidate })
        );
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true,
        });
        setLocalStream(stream);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        flushSpectatorOfferQueue();
      } catch (err) {
        setMediaError(
          "Failed to access camera/microphone. Please check permissions."
        );
        console.error("Error accessing media devices:", err);
      }
    };

    return () => {
      const activeLocalStream = localStreamRef.current;
      if (activeLocalStream) {
        activeLocalStream.getTracks().forEach((track) => track.stop());
      }
      spectatorPCsRef.current.forEach((spectatorPc) => {
        try {
          spectatorPc.close();
        } catch {
          // Ignore close errors
        }
      });
      spectatorPCsRef.current.clear();
      rws.close();
      pc.close();
    };
  }, [
    cleanupSpectatorConnection,
    flushSpectatorOfferQueue,
    processSpectatorOfferRequest,
    queueSpectatorOffer,
    roomId,
  ]);

  useEffect(() => {
    flushSpectatorOfferQueue();
  }, [flushSpectatorOfferQueue]);

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play();
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play();
    }
  }, [localStream, remoteStream]);

  // Initialize Audio Recording
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        setAudioStream(stream);
        setAudioError(null);

        // Create audio context for visualization
        const AudioContextClass =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext: typeof AudioContext;
            }
          ).webkitAudioContext;
        const audioContext = new AudioContextClass();
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        source.connect(analyser);
        analyserRef.current = analyser;

        // Create media recorder
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/ogg",
        });

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0 && isMyTurn && localRole) {
            // Send indicator that user is speaking
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: "speaking",
                  userId: currentUser?.id,
                  isSpeaking: true,
                })
              );
            }
          }
        };

        recorder.onstart = () => {
          setIsRecording(true);
        };

        recorder.onstop = () => {
          setIsRecording(false);

          // Send indicator that user stopped speaking
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "speaking",
                userId: currentUser?.id,
                isSpeaking: false,
              })
            );
          }
        };

        setMediaRecorder(recorder);
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === "NotAllowedError") {
            setAudioError(
              "Microphone access denied. Please allow microphone access and refresh the page."
            );
          } else if (error.name === "NotFoundError") {
            setAudioError(
              "No microphone found. Please connect a microphone and refresh the page."
            );
          } else {
            setAudioError(`Audio initialization failed: ${error.message}`);
          }
        }
      }
    };

    initializeAudio();

    return () => {
      // Cleanup
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Initialize Speech Recognition
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const initializeSpeechRecognition = () => {
      if (
        "SpeechRecognition" in window ||
        "webkitSpeechRecognition" in window
      ) {
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          setSpeechError("Speech recognition not available");
          return;
        }
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.maxAlternatives = 3;

        recognition.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
          retryCountRef.current = 0; // Reset retry count on successful start
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript + " ";
            } else {
              interimTranscript += result[0].transcript;
            }
          }

          if (finalTranscript.trim()) {
            // Add final transcript to current phase
            setSpeechTranscripts((prev) => ({
              ...prev,
              [debatePhase]: (
                (prev[debatePhase] || "") +
                " " +
                finalTranscript
              ).trim(),
            }));
            setCurrentTranscript("");

            // Send transcript to backend
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: "speechText",
                  userId: currentUser?.id,
                  username: currentUser?.displayName,
                  speechText: finalTranscript,
                  phase: debatePhase,
                })
              );
            }
          }
          if (interimTranscript) {
            setCurrentTranscript(interimTranscript);

            // Send live transcript to opponent
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: "liveTranscript",
                  userId: currentUser?.id,
                  username: currentUser?.displayName,
                  liveTranscript: interimTranscript,
                  phase: debatePhase,
                })
              );
            }
          }
        };

        recognition.onend = () => {
          setIsListening(false);

          // Restart speech recognition if it's still the user's turn
          if (
            isMyTurn &&
            debatePhase !== DebatePhase.Setup &&
            debatePhase !== DebatePhase.Finished &&
            !isAutoMuted
          ) {
            setTimeout(() => {
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (error) {
                  console.error(
                    "Error restarting speech recognition after end:",
                    error
                  );
                }
              }
            }, 100);
          }
        };

        recognition.onerror = (event: Event) => {
          const errorEvent = event as unknown as { error: string };
          setIsListening(false);

          // Handle different types of errors
          switch (errorEvent.error) {
            case "no-speech":
            case "aborted":
              // These are normal, don't show error
              break;
            case "network":
              // Network errors are often temporary, try to restart silently
              console.warn(
                "Speech recognition network error, attempting to restart..."
              );
              if (retryCountRef.current < 3) {
                // Limit retries to 3
                retryCountRef.current += 1;
                setTimeout(() => {
                  if (
                    recognitionRef.current &&
                    isMyTurn &&
                    debatePhase !== DebatePhase.Setup &&
                    debatePhase !== DebatePhase.Finished &&
                    !isAutoMuted
                  ) {
                    try {
                      recognitionRef.current.start();
                    } catch (error) {
                      console.error(
                        "Failed to restart after network error:",
                        error
                      );
                    }
                  }
                }, 2000); // Wait 2 seconds before retrying
              } else {
                setSpeechError(
                  "Speech recognition temporarily unavailable. Please try again later."
                );
              }
              break;
            case "not-allowed":
              setSpeechError(
                "Microphone access denied. Please allow microphone access and refresh the page."
              );
              break;
            case "service-not-allowed":
              setSpeechError(
                "Speech recognition service not available. Please check your internet connection."
              );
              break;
            default:
              // For other errors, show a brief message and try to restart
              if (retryCountRef.current < 2) {
                // Limit retries to 2 for other errors
                retryCountRef.current += 1;
                setSpeechError(
                  `Speech recognition temporarily unavailable. Retrying...`
                );
                setTimeout(() => {
                  setSpeechError(null);
                  if (
                    recognitionRef.current &&
                    isMyTurn &&
                    debatePhase !== DebatePhase.Setup &&
                    debatePhase !== DebatePhase.Finished &&
                    !isAutoMuted
                  ) {
                    try {
                      recognitionRef.current.start();
                    } catch (error) {
                      console.error(
                        "Error restarting speech recognition during retry:",
                        error
                      );
                    }
                  }
                }, 3000); // Wait 3 seconds before retrying
              } else {
                console.error(
                  "Max retry attempts reached for speech recognition error"
                );
                setSpeechError(
                  `Speech recognition error: ${errorEvent.error}. Please try again later.`
                );
              }
          }
        };
      } else {
        setSpeechError("Speech recognition not supported in this browser");
      }
    };

    initializeSpeechRecognition();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [debatePhase]);

  // Audio level monitoring function
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume (not used since we removed audio level display)
    // const average =
    //   dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

    // Continue monitoring
    animationRef.current = requestAnimationFrame(monitorAudioLevel);
  }, []);

  // Start/stop audio recording based on turn
  const startAudioRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === "inactive") {
      try {
        mediaRecorder.start(1000); // Record in 1-second chunks
        monitorAudioLevel(); // Start audio level monitoring
        setAudioError(null);
      } catch (error) {
        setAudioError("Failed to start audio recording");
        console.error("Failed to start audio recording:", error);
      }
    }
  }, [mediaRecorder, monitorAudioLevel]);

  const stopAudioRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
      try {
        mediaRecorder.stop();
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      } catch (error) {
        console.error("Failed to stop audio recording:", error);
      }
    }
  }, [mediaRecorder]);

  // Start/stop speech recognition based on turn
  const startSpeechRecognition = useCallback(() => {
    if (
      !recognitionRef.current ||
      isListening ||
      debatePhase === DebatePhase.Setup ||
      debatePhase === DebatePhase.Finished ||
      isAutoMuted
    ) {
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      // If start fails, try to reinitialize after a short delay
      setTimeout(() => {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (retryError) {
            console.error(
              "Failed to restart speech recognition after retry:",
              retryError
            );
            setSpeechError("Failed to start speech recognition");
          }
        }
      }, 1000);
    }
  }, [isListening, debatePhase, isAutoMuted]);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
        retryCountRef.current = 0; // Reset retry count when manually stopping
      } catch {
        // Error already handled by onerror callback
      }
    }
  }, [isListening]);

  const handleStartSpeaking = useCallback(() => {
    const canSpeakNow =
      isMyTurn &&
      debatePhase !== DebatePhase.Setup &&
      debatePhase !== DebatePhase.Finished &&
      !isAutoMuted;

    if (!canSpeakNow || isManualRecording) {
      return;
    }

    if (!mediaRecorder) {
      setSpeechError("Microphone not ready yet. Please wait a moment.");
      return;
    }

    setSpeechError(null);
    manualRecordingRef.current = true;
    setIsManualRecording(true);
    startAudioRecording();
    startSpeechRecognition();
  }, [
    isMyTurn,
    debatePhase,
    isAutoMuted,
    isManualRecording,
    mediaRecorder,
    setIsManualRecording,
    startAudioRecording,
    startSpeechRecognition,
  ]);

  const handleStopSpeaking = useCallback(() => {
    if (!isManualRecording) {
      return;
    }

    manualRecordingRef.current = false;
    stopAudioRecording();
    stopSpeechRecognition();
    setIsManualRecording(false);
  }, [isManualRecording, stopAudioRecording, stopSpeechRecognition]);

  useEffect(() => {
    if (!manualRecordingRef.current) {
      return;
    }

    const canStillSpeak =
      isMyTurn &&
      debatePhase !== DebatePhase.Setup &&
      debatePhase !== DebatePhase.Finished &&
      !isAutoMuted;

    if (!canStillSpeak) {
      handleStopSpeaking();
    }
  }, [isMyTurn, debatePhase, isAutoMuted, handleStopSpeaking]);

  // Auto start/stop recording and speech recognition based on turn
  useEffect(() => {
    if (!mediaRecorder || audioError) return;

    if (isManualRecording) {
      startAudioRecording();
      startSpeechRecognition();
    } else {
      stopAudioRecording();
      stopSpeechRecognition();
    }

    return () => {
      stopAudioRecording();
      stopSpeechRecognition();
    };
  }, [
    isManualRecording,
    mediaRecorder,
    audioError,
    startAudioRecording,
    stopAudioRecording,
    startSpeechRecognition,
    stopSpeechRecognition,
  ]);

  // Clear audio level when phase changes
  useEffect(() => {
    // Phase changed, reset retry count for speech recognition
    retryCountRef.current = 0;
  }, [debatePhase]);

  // Reset retry count when turn changes
  useEffect(() => {
    retryCountRef.current = 0;
  }, [isMyTurn]);

  // Check microphone permissions on component mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        console.error("Microphone permission check failed:", error);
      }
    };
    checkPermission();
  }, []);

  // Trigger logMessageHistory when debatePhase changes to Finished
  useEffect(() => {
    if (debatePhase === DebatePhase.Finished && localRole) {
      logMessageHistory();
    }
  }, [debatePhase, localRole, logMessageHistory]);

  // Reset submissionStartedRef whenever phase moves away from Finished.
  useEffect(() => {
    if (debatePhase !== DebatePhase.Finished) {
      submissionStartedRef.current = false;
    }
  }, [debatePhase]);

  // Handlers for user actions
  const handleTopicChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const newTopic = e.target.value;
    setTopic(newTopic);
    const message = JSON.stringify({ type: "topicChange", topic: newTopic });
    wsRef.current?.send(message);
  };

  const handleRoleSelection = (role: DebateRole) => {
    if (peerRole === role) {
      alert(
        `Your opponent already chose "${role}". Please select the other side.`
      );
      return;
    }
    setLocalRole(role);
    const message = JSON.stringify({ type: "roleSelection", role });
    wsRef.current?.send(message);
  };

  const toggleReady = () => {
    const newReadyState = !localReady;
    setLocalReady(newReadyState);
    wsRef.current?.send(
      JSON.stringify({ type: "ready", ready: newReadyState })
    );
  };

  // Manage setup popup visibility
  useEffect(() => {
    if (localReady && peerReady) {
      setShowSetupPopup(false);
      setCountdown(3);
    } else {
      setShowSetupPopup(true);
    }
  }, [localReady, peerReady]);

  // Countdown logic
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setDebatePhase(DebatePhase.OpeningFor);
      wsRef.current?.send(
        JSON.stringify({ type: "phaseChange", phase: DebatePhase.OpeningFor })
      );
      console.debug(
        `Countdown finished. Starting debate at ${DebatePhase.OpeningFor} for ${localRole}`
      );
      if (localRole === "for") {
        pcRef.current
          ?.createOffer()
          .then((offer) =>
            pcRef.current!.setLocalDescription(offer).then(() => offer)
          )
          .then((offer) =>
            wsRef.current?.send(JSON.stringify({ type: "offer", offer }))
          );
      }
    }
  }, [countdown, localRole]);

  // Clear input fields on phase change
  useEffect(() => {
    // Clear any audio-related state if needed
  }, [debatePhase]);

  useEffect(() => {
    manualRecordingRef.current = isManualRecording;
  }, [isManualRecording]);

  const formatTime = (seconds: number) => {
    const timeStr = `${Math.floor(seconds / 60)}:${(seconds % 60)
      .toString()
      .padStart(2, "0")}`;
    return (
      <span
        className={`font-mono ${
          seconds <= 5 ? "text-red-500 animate-pulse" : "text-gray-600"
        }`}
      >
        {timeStr}
      </span>
    );
  };

  const speakingStatusMessage = isManualRecording
    ? "Recording & speech recognition active."
    : isMyTurn &&
      debatePhase !== DebatePhase.Setup &&
      debatePhase !== DebatePhase.Finished &&
      !isAutoMuted
    ? "Click start when you're ready to speak."
    : isAutoMuted
    ? "Auto-muted while the opponent is speaking."
    : "Waiting for your turn...";

  const canStartSpeaking =
    isMyTurn &&
    debatePhase !== DebatePhase.Setup &&
    debatePhase !== DebatePhase.Finished &&
    !isAutoMuted;

  if (!roomId) {
    return (
      <div className="p-6 text-center text-red-600">Room ID is missing.</div>
    );
  }

  // Render UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4">
      <div className="w-full max-w-5xl mx-auto py-2">
        <div className="bg-gradient-to-r from-orange-100 via-white to-orange-100 rounded-xl p-4 text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Debate: {topic || "No topic set"}
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Phase: <span className="font-medium">{debatePhase}</span> |
            Participants:{" "}
            <span className="font-medium">{roomParticipants.length}/2</span> |
            Spectators: <span className="font-medium">{spectatorPresence}</span>{" "}
            | Current Turn:{" "}
            <span className="font-semibold text-orange-600">
              {isMyTurn ? "You" : "Opponent"} to{" "}
              {debatePhase.includes("Question")
                ? "ask a question"
                : debatePhase.includes("Answer")
                ? "answer"
                : "make a statement"}
            </span>
            {isAutoMuted && (
              <span className="ml-2 text-red-500 font-medium">
                🔇 Auto-muted (not your turn)
              </span>
            )}
          </p>
          {debatePhase !== DebatePhase.Finished && debatePhase !== DebatePhase.Setup && (
            <div className="mt-2">
              <Button
                onClick={handleConcede}
                className="bg-red-500 hover:bg-red-600 text-white rounded-md px-3 text-sm"
              >
                Concede
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Setup Popup */}
      {showSetupPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-card text-foreground p-6 rounded-lg shadow-lg max-w-md w-full">
            {/* Header with title and close icon */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Debate Setup</h2>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-primary"></div>
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading participants...
                </span>
              </div>
            )}

            {!isLoading && (
              <>
                {/* Debate Topic */}
                <div className="mb-6">
                  <label className="block text-lg mb-2">Debate Topic</label>
                  <select
                    value={topic}
                    onChange={(e) => handleTopicChange(e)}
                    className="border border-border rounded p-2 w-full bg-input text-foreground mb-2"
                  >
                    <option value="">Select a topic or enter custom</option>
                    {predefinedTopics.map((predefinedTopic, index) => (
                      <option key={index} value={predefinedTopic}>
                        {predefinedTopic}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={topic}
                    onChange={handleTopicChange}
                    placeholder="Or enter a custom debate topic"
                    className="border border-border rounded p-2 w-full bg-input text-foreground"
                  />
                </div>
                {/* Avatars and Role Selection */}
                <div className="mb-6 flex justify-around">
                  {/* Your Avatar and Role Selection */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <img
                        src={
                          localUser?.avatarUrl ||
                          currentUser?.avatarUrl ||
                          "https://avatar.iran.liara.run/public/40"
                        }
                        alt="You"
                        className="w-20 h-20 rounded-full object-cover"
                      />
                      <div
                        className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-card ${
                          localReady ? "bg-green-500" : "bg-red-500"
                        }`}
                        title={
                          localReady ? "You are Ready" : "You are Not Ready"
                        }
                      ></div>
                    </div>
                    <div className="mt-2 text-center">
                      <div className="text-sm font-medium">
                        {localUser?.displayName ||
                          currentUser?.displayName ||
                          "You"}
                      </div>
                      <div className="text-xs text-gray-500">
                        Rating: {localUser?.elo || currentUser?.rating || 1500}
                      </div>
                    </div>
                    <div className="mt-2 flex space-x-2">
                      <button
                        onClick={() => handleRoleSelection("for")}
                        className={`px-2 py-1 rounded text-xs border transition ${
                          localRole === "for"
                            ? "bg-primary text-primary-foreground border-transparent"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        For
                      </button>
                      <button
                        onClick={() => handleRoleSelection("against")}
                        className={`px-2 py-1 rounded text-xs border transition ${
                          localRole === "against"
                            ? "bg-primary text-primary-foreground border-transparent"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        Against
                      </button>
                    </div>
                    <div className="mt-1 text-xs">
                      {localRole
                        ? localRole === "for"
                          ? "For"
                          : "Against"
                        : "Not selected"}
                    </div>
                  </div>
                  {/* Opponent Avatar */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <img
                        src={
                          opponentUser?.avatarUrl ||
                          "https://avatar.iran.liara.run/public/31"
                        }
                        alt="Opponent"
                        className="w-20 h-20 rounded-full object-cover"
                      />
                      <div
                        className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-card ${
                          peerReady ? "bg-green-500" : "bg-red-500"
                        }`}
                        title={
                          peerReady ? "Opponent Ready" : "Opponent Not Ready"
                        }
                      ></div>
                    </div>
                    <div className="mt-2 text-center">
                      <div className="text-sm font-medium">
                        {opponentUser?.displayName ||
                          opponentUser?.username ||
                          (roomParticipants.length > 1
                            ? "Opponent"
                            : "Waiting for opponent...")}
                      </div>
                      <div className="text-xs text-gray-500">
                        Rating: {opponentUser?.elo || 1500}
                      </div>
                      {!opponentUser && roomParticipants.length === 1 && (
                        <div className="text-xs text-orange-500 mt-1">
                          Waiting for opponent to join...
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-xs">
                      {peerRole
                        ? peerRole === "for"
                          ? "For"
                          : "Against"
                        : "Not selected"}
                    </div>
                  </div>
                </div>
                {/* Ready Button */}
                <div>
                  <Button
                    onClick={toggleReady}
                    className={`w-full py-2 rounded-lg transition ${
                      localReady
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {localReady ? "Cancel Ready" : "I'm Ready"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Countdown Popup */}
      {countdown !== null && countdown > 0 && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-3xl font-bold">
              Debate starting in {countdown}
            </h2>
          </div>
        </div>
      )}

      {/* Judging Popup */}
      {popup.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full transform transition-all duration-300 scale-105 border border-orange-200">
            {popup.isJudging ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-800">
                  {popup.message}
                </h2>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-orange-600 mb-2">
                  Phase Transition
                </h3>
                <p className="text-gray-700 text-center text-sm">
                  {popup.message}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Judgment Popup */}
      {showJudgment && judgmentData && (
        <JudgmentPopup
          judgment={judgmentData}
          forRole={
            localRole === "for"
              ? "You"
              : opponentUser?.displayName || "Opponent"
          }
          againstRole={
            localRole === "against"
              ? "You"
              : opponentUser?.displayName || "Opponent"
          }
          localRole={localRole ?? null}
          localDisplayName={
            localUser?.displayName ||
            localUser?.username ||
            currentUser?.displayName ||
            currentUser?.email ||
            "You"
          }
          localAvatarUrl={
            localUser?.avatarUrl || currentUser?.avatarUrl || null
          }
          opponentDisplayName={
            opponentUser?.displayName || opponentUser?.username || "Opponent"
          }
          opponentAvatarUrl={opponentUser?.avatarUrl || null}
          ratingSummary={ratingSummary}
          onClose={() => setShowJudgment(false)}
        />
      )}

      <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-3">
        {/* Local User Section */}
        <div
          className={`relative w-full md:w-1/2 ${
            isMyTurn && debatePhase !== DebatePhase.Finished
              ? "animate-glow"
              : ""
          } bg-white border border-gray-200 shadow-md h-[540px] flex flex-col`}
        >
          <div className="p-2 bg-gray-50 flex items-center gap-2">
            <div className="w-12 h-12 flex-shrink-0">
              <img
                src={
                  localUser?.avatarUrl ||
                  currentUser?.avatarUrl ||
                  "https://avatar.iran.liara.run/public/40"
                }
                alt="You"
                className="w-full h-full rounded-full border border-orange-400 object-cover"
              />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-gray-800">
                {localUser?.displayName || currentUser?.displayName || "You"}
              </div>
              <div className="text-xs text-gray-500">
                Role: {localRole || "Not selected"} | Rating:{" "}
                {localUser?.elo || currentUser?.rating || 1500}
              </div>
            </div>
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
            <p className="text-sm font-semibold text-orange-600 mb-1">
              Stance: {localRole}
            </p>
            <p className="text-xs mb-1">
              Time:{" "}
              {formatTime(isMyTurn ? timer : phaseDurations[debatePhase] || 0)}
            </p>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-80 object-cover"
            />
            {/* Speaking Controls */}
            <div className="mt-3 flex flex-col items-center gap-2">
              <Button
                onClick={
                  isManualRecording ? handleStopSpeaking : handleStartSpeaking
                }
                variant={isManualRecording ? "destructive" : "default"}
                size="sm"
                disabled={!isManualRecording && !canStartSpeaking}
                className="px-4"
              >
                {isManualRecording ? "Stop Speaking" : "Start Speaking"}
              </Button>
              <div className="text-sm text-gray-600 text-center">
                {speakingStatusMessage}
              </div>
            </div>
          </div>
        </div>

        {/* Remote User Section */}
        <div
          className={`relative w-full md:w-1/2 ${
            !isMyTurn && debatePhase !== DebatePhase.Finished
              ? "animate-glow"
              : ""
          } bg-white border border-gray-200 shadow-md h-[540px] flex flex-col`}
        >
          <div className="p-2 bg-gray-50 flex items-center gap-2">
            <div className="w-12 h-12 flex-shrink-0">
              <img
                src={
                  opponentUser?.avatarUrl ||
                  "https://avatar.iran.liara.run/public/31"
                }
                alt="Opponent"
                className="w-full h-full rounded-full border border-orange-400 object-cover"
              />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-gray-800">
                {opponentUser?.displayName ||
                  opponentUser?.username ||
                  "Opponent"}
              </div>
              <div className="text-xs text-gray-500">
                Role: {peerRole || "Not selected"} | Rating:{" "}
                {opponentUser?.elo || 1500}
              </div>
            </div>
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
            <p className="text-sm font-semibold text-orange-600 mb-1">
              Stance: {peerRole}
            </p>
            <p className="text-xs mb-1">
              Time:{" "}
              {formatTime(!isMyTurn ? timer : phaseDurations[debatePhase] || 0)}
            </p>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-80 object-cover"
            />
          </div>
        </div>
      </div>

      {/* Speech Transcripts Section */}
      {debatePhase !== DebatePhase.Setup && (
        <div className="w-full max-w-5xl mx-auto mt-4">
          <SpeechTranscripts
            transcripts={speechTranscripts}
            currentPhase={debatePhase}
          />
        </div>
      )}

      <div className="w-full max-w-5xl mx-auto mt-4 grid gap-4 md:grid-cols-2">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Audience Polls
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {audiencePolls.length === 0 ? (
              <p className="text-sm text-gray-500">
                No polls in progress. Spectators can launch polls from the
                viewer portal.
              </p>
            ) : (
              audiencePolls.map((poll: PollInfo) => {
                const totalVotes = poll.options.reduce(
                  (acc, option) => acc + (poll.counts[option] || 0),
                  0
                );
                return (
                  <div
                    key={poll.pollId}
                    className="border border-gray-100 bg-gray-50 rounded-md p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-800">
                        {poll.question || `Poll ${poll.pollId.slice(0, 8)}`}
                      </span>
                      <span className="text-xs text-gray-500">
                        {totalVotes} vote{totalVotes === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {poll.options.map((option) => {
                        const count = poll.counts[option] || 0;
                        return (
                          <div
                            key={option}
                            className="flex items-center justify-between text-xs text-gray-600"
                          >
                            <span>{option}</span>
                            <span className="font-semibold text-gray-700">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Audience Comments
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentQuestions.length === 0 ? (
              <p className="text-sm text-gray-500">
                No comments yet. Spectators can submit questions from the viewer
                panel.
              </p>
            ) : (
              recentQuestions.map((question) => (
                <div
                  key={question.qId}
                  className="rounded border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <p className="text-sm text-gray-800">{question.text}</p>
                  <span className="text-xs text-gray-500">
                    {new Date(question.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="w-full max-w-5xl mx-auto mt-2 bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            Total spectators currently watching
          </span>
          <span className="text-lg font-semibold text-orange-600">
            {spectatorPresence}
          </span>
        </div>
      </div>

      {/* Media Error Display */}
      {mediaError && (
        <p className="text-red-500 mt-4 text-center">{mediaError}</p>
      )}

      <style>{`
        @keyframes glow {
          0% {
            box-shadow: 0 0 5px rgba(255, 149, 0, 0.5);
          }
          50% {
            box-shadow: 0 0 20px rgba(255, 149, 0, 0.8);
          }
          100% {
            box-shadow: 0 0 5px rgba(255, 149, 0, 0.5);
          }
        }
        .animate-glow {
          animation: glow 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default OnlineDebateRoom;
