import config from "../config/config";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useAtom } from "jotai";
import { userAtom } from "@/state/userAtom";
import { useUser } from "@/hooks/useUser";
import { getTeamDebate } from "@/services/teamDebateService";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import JudgmentPopup from "@/components/JudgementPopup";
import SpeechTranscripts from "@/components/SpeechTranscripts";
import { getAuthToken } from "@/utils/auth";
import LoadingSpinner from "@/components/LoadingSpinner";
import ReconnectingWebSocket from "reconnecting-websocket";

// Define debate phases as an enum (same as OnlineDebateRoom)
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
type TeamSocket = Pick<ReconnectingWebSocket, "readyState" | "send" | "close">;

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

// Define team member interface
interface TeamMember {
  userId: string;
  email: string;
  displayName: string;
  elo: number;
  avatarUrl?: string;
}

// Define user details interface
interface UserDetails {
  id: string;
  username: string;
  elo: number;
  avatarUrl?: string;
  displayName?: string;
  teamId?: string;
  cameraOn?: boolean;
  microphoneOn?: boolean;
}

interface TranscriptEntry {
  transcriptId: string;
  phase: DebatePhase;
  userId: string;
  username: string;
  speechText: string;
  timestamp: number;
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
  participant?: UserDetails;
  participants?: UserDetails[];
  userId?: string;
  username?: string;
  timestamp?: number;
  fromUserId?: string;
  targetUserId?: string;
  mode?: "type" | "speak";
  isTyping?: boolean;
  isSpeaking?: boolean;
  partialText?: string;
  isMuted?: boolean;
  currentTurn?: string;
  speechText?: string;
  transcriptId?: string;
  entries?: TranscriptEntry[];
  cameraOn?: boolean;
  microphoneOn?: boolean;
  teamId?: string;
  team1Members?: TeamMember[];
  team2Members?: TeamMember[];
  // State sync fields
  team1Role?: string;
  team2Role?: string;
  team1Ready?: number;
  team2Ready?: number;
  team1MembersCount?: number;
  team2MembersCount?: number;
  spectatorCount?: number;
  spectator?: {
    connectionId: string;
    spectatorUserId?: string;
    spectatorDisplayName?: string;
  };
}

// Define phase durations in seconds
const phaseDurations: { [key in DebatePhase]?: number } = {
  [DebatePhase.OpeningFor]: 60,
  [DebatePhase.OpeningAgainst]: 60,
  [DebatePhase.CrossForQuestion]: 30,
  [DebatePhase.CrossAgainstAnswer]: 30,
  [DebatePhase.CrossAgainstQuestion]: 30,
  [DebatePhase.CrossForAnswer]: 30,
  [DebatePhase.ClosingFor]: 45,
  [DebatePhase.ClosingAgainst]: 45,
};

const BASE_URL =
  (config.baseUrl as string | undefined)?.replace(/\/$/, "") ??
  window.location.origin;

const renegotiatePeerConnection = async (
  connection: RTCPeerConnection,
  fromUserId: string,
  targetUserId: string,
  socket: TeamSocket | null
) => {
  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "offer",
        fromUserId,
        targetUserId,
        offer: { type: offer.type, sdp: offer.sdp },
      })
    );
  }
};

const getMediaErrorMessage = (device: "camera" | "microphone", error: unknown) => {
  const errorName =
    error instanceof DOMException ? error.name : "";
  switch (errorName) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return `Allow ${device} access for this site in your browser settings, then try again.`;
    case "NotFoundError":
    case "DevicesNotFoundError":
      return `No ${device} was found. Connect or select a ${device} and try again.`;
    case "NotReadableError":
    case "TrackStartError":
      return `Your ${device} is already in use by another app or tab. Close it there and try again.`;
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return `The selected ${device} does not support the requested settings. Check your device settings and try again.`;
    case "SecurityError":
      return `The browser blocked ${device} access. Open this debate on HTTPS or localhost and allow access.`;
    default:
      return `Could not start your ${device}. Check browser permissions and make sure the device is available.`;
  }
};

// Function to extract JSON from response
const extractJSON = (response: string): string => {
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = fenceRegex.exec(response);
  if (match && match[1]) return match[1].trim();
  return response;
};

const TeamDebateRoom: React.FC = () => {
  const { debateId } = useParams<{ debateId: string }>();
  const [user] = useAtom(userAtom);
  const { user: userFromHook, isLoading: isUserLoading, isAuthenticated } = useUser();
  
  // Use user from hook if available, otherwise fallback to atom
  const currentUser = userFromHook || user;
  
  // Debate state
  const [debate, setDebate] = useState<any>(null);
  const [topic, setTopic] = useState("");
  const [localRole, setLocalRole] = useState<DebateRole | null>(null);
  const [peerRole, setPeerRole] = useState<DebateRole | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [peerReady, setPeerReady] = useState(false);
  const [debatePhase, setDebatePhase] = useState<DebatePhase>(
    DebatePhase.Setup
  );

  // Team information
  const [myTeamMembers, setMyTeamMembers] = useState<TeamMember[]>([]);
  const [opponentTeamMembers, setOpponentTeamMembers] = useState<TeamMember[]>([]);
  const [myTeamName, setMyTeamName] = useState("");
  const [opponentTeamName, setOpponentTeamName] = useState("");
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [isTeam1, setIsTeam1] = useState(false);
  const [team1ReadyCount, setTeam1ReadyCount] = useState(0);
  const [team2ReadyCount, setTeam2ReadyCount] = useState(0);
  const [team1MembersCount, setTeam1MembersCount] = useState(0);
  const [team2MembersCount, setTeam2MembersCount] = useState(0);
  
  // Track individual ready status for each player
  const [playerReadyStatus, setPlayerReadyStatus] = useState<Map<string, boolean>>(new Map());
  const [hasDeterminedTeam, setHasDeterminedTeam] = useState(false);

  // Refs for WebSocket, PeerConnections, and media elements
  const wsRef = useRef<ReconnectingWebSocket | null>(null);
  const pcRefs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const debateStartedRef = useRef<boolean>(false); // Track if debate has started to prevent popup reopening
  const countdownCompletedRef = useRef(false);
  const finalSubmissionStartedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const myTeamIdRef = useRef<string | null>(null);
  const isTeam1Ref = useRef<boolean>(false);
  const debatePhaseRef = useRef<DebatePhase>(DebatePhase.Setup);

  

  // State for media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<
    Map<string, MediaStream>
  >(new Map());
  const [remoteMediaStates, setRemoteMediaStates] = useState<
    Map<string, { cameraOn: boolean; microphoneOn: boolean }>
  >(new Map());
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(false);
  const publishMediaState = useCallback((cameraOn: boolean, microphoneOn: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "mediaState", cameraOn, microphoneOn })
      );
    }
  }, []);

  const isMyTurn =
    !!localRole &&
    ((debatePhase.includes("For") && localRole === "for") ||
      (debatePhase.includes("Against") && localRole === "against"));
  const canSpeakNow =
    isMyTurn &&
    debatePhase !== DebatePhase.Setup &&
    debatePhase !== DebatePhase.Finished;
  const canSpeakNowRef = useRef(canSpeakNow);
  canSpeakNowRef.current = canSpeakNow;

  useEffect(() => {
    if (canSpeakNow || !isMicrophoneOn) return;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setIsMicrophoneOn(false);
    publishMediaState(
      localStreamRef.current?.getVideoTracks().some((track) => track.enabled) ?? false,
      false
    );
  }, [canSpeakNow, isMicrophoneOn, publishMediaState]);

  // Timer state
  const [timer, setTimer] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Speech recognition state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechTranscripts, setSpeechTranscripts] = useState<{
    [key: string]: string;
  }>({});
  const speechTranscriptsRef = useRef(speechTranscripts);
  const seenTranscriptIdsRef = useRef(new Set<string>());
  const [speechRecognitionDisabled, setSpeechRecognitionDisabled] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const activeSpeakerTimeoutRef = useRef<number | null>(null);
  const connectedParticipantsRef = useRef<Set<string>>(new Set());
  const peerRetryRef = useRef<(remoteUserId: string) => void>(() => {});
  const speechRecognitionRunningRef = useRef(false);
  const speechRecognitionRestartRef = useRef<number | null>(null);
  const speechRecognitionPhaseRef = useRef(DebatePhase.Setup);
  const speechRecognitionStopWaitersRef = useRef<Array<() => void>>([]);
  const speechRecognitionStopTimeoutRef = useRef<number | null>(null);
  const speechRecognitionContextRef = useRef({
    isMyTurn: false,
    phase: DebatePhase.Setup,
    microphoneEnabled: false,
    disabled: false,
    userId: undefined as string | undefined,
    displayName: undefined as string | undefined,
  });

  const markActiveSpeaker = useCallback((userId: string) => {
    setActiveSpeakerId(userId);
    if (activeSpeakerTimeoutRef.current !== null) {
      window.clearTimeout(activeSpeakerTimeoutRef.current);
    }
    activeSpeakerTimeoutRef.current = window.setTimeout(() => {
      setActiveSpeakerId(null);
      activeSpeakerTimeoutRef.current = null;
    }, 1800);
  }, []);

  const appendTranscript = useCallback((
    phase: DebatePhase,
    text: string,
    transcriptId?: string
  ) => {
    if (transcriptId && seenTranscriptIdsRef.current.has(transcriptId)) return;
    if (transcriptId) seenTranscriptIdsRef.current.add(transcriptId);
    const existing = speechTranscriptsRef.current[phase] || "";
    const nextTranscript = `${existing}\n${text}`.trim();
    const nextTranscripts = {
      ...speechTranscriptsRef.current,
      [phase]: nextTranscript,
    };
    speechTranscriptsRef.current = nextTranscripts;
    setSpeechTranscripts(nextTranscripts);
  }, []);

  useEffect(
    () => () => {
      if (activeSpeakerTimeoutRef.current !== null) {
        window.clearTimeout(activeSpeakerTimeoutRef.current);
      }
    },
    []
  );

  // Popup and countdown state
  const [showSetupPopup, setShowSetupPopup] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Judgment states
  const [popup, setPopup] = useState<{
    show: boolean;
    message: string;
    isJudging?: boolean;
  }>({ show: false, message: "" });
  const [judgmentData, setJudgmentData] = useState<JudgmentData | null>(null);
  const [showJudgment, setShowJudgment] = useState(false);

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

  const toggleCamera = useCallback(async () => {
    const shouldEnable = !isCameraOn;

    if (
      shouldEnable &&
      (!localStreamRef.current || localStreamRef.current.getVideoTracks().length === 0)
    ) {
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: false,
        });
        const stream = localStreamRef.current ?? new MediaStream();
        const videoTracks = cameraStream.getVideoTracks();
        videoTracks.forEach((track) => stream.addTrack(track));
        localStreamRef.current = stream;
        setLocalStream(stream);

        const localVideoEl = localVideoRefs.current.get(currentUser?.id || "");
        if (localVideoEl) {
          localVideoEl.srcObject = stream;
        }
        pcRefs.current.forEach((connection, remoteUserId) => {
          videoTracks.forEach((track) => connection.addTrack(track, stream));
          void renegotiatePeerConnection(
            connection,
            currentUserIdRef.current || "",
            remoteUserId,
            wsRef.current
          ).catch((error: unknown) => {
            console.error("Failed to share camera with debate participant:", error);
          });
        });
      } catch (error) {
        console.error("toggleCamera: failed to enable camera", error);
        setMediaError(getMediaErrorMessage("camera", error));
        return;
      }
    }

    const stream = localStreamRef.current;
    if (!stream) {
      console.warn("toggleCamera called without an active local stream.");
      return;
    }

    stream.getVideoTracks().forEach((track) => {
      track.enabled = shouldEnable;
    });

    setIsCameraOn(shouldEnable);
    publishMediaState(
      shouldEnable,
      stream.getAudioTracks().some((track) => track.enabled)
    );
    if (shouldEnable) {
      setMediaError(null);
    }
  }, [currentUser?.id, isCameraOn, publishMediaState]);

  const toggleMicrophone = useCallback(async () => {
    if (!canSpeakNow) return;

    let stream = localStreamRef.current;
    let audioTracks = stream?.getAudioTracks() ?? [];
    let acquiredTrack = false;

    if (audioTracks.length === 0) {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Microphone access is not available in this browser.");
        }
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!canSpeakNowRef.current) {
          audioStream.getTracks().forEach((track) => track.stop());
          return;
        }
        const audioTrack = audioStream.getAudioTracks()[0];
        if (!audioTrack) {
          throw new Error("No microphone track was provided by the browser.");
        }
        if (!stream) {
          stream = new MediaStream();
          localStreamRef.current = stream;
        }
        const activeStream = stream;
        activeStream.addTrack(audioTrack);
        audioTracks = [audioTrack];
        acquiredTrack = true;
        setLocalStream(activeStream);

        pcRefs.current.forEach((connection, remoteUserId) => {
          connection.addTrack(audioTrack, activeStream);
          void renegotiatePeerConnection(
            connection,
            currentUserIdRef.current || "",
            remoteUserId,
            wsRef.current
          ).catch((error: unknown) => {
            console.error("Failed to share microphone with debate participant:", error);
          });
        });
      } catch (error) {
        console.error("toggleMicrophone: failed to enable microphone", error);
          setMediaError(getMediaErrorMessage("microphone", error));
        return;
      }
    }

    const shouldEnable = acquiredTrack || !isMicrophoneOn;
    audioTracks.forEach((track) => {
      track.enabled = shouldEnable;
    });
    setIsMicrophoneOn(shouldEnable);
    publishMediaState(
      localStreamRef.current?.getVideoTracks().some((track) => track.enabled) ?? false,
      shouldEnable
    );
    if (shouldEnable) setMediaError(null);
  }, [canSpeakNow, isMicrophoneOn, publishMediaState]);

  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingOffersRef = useRef<Map<string, RTCSessionDescriptionInit[]>>(new Map());
  const initiatedOffersRef = useRef<Set<string>>(new Set());

  const sendSignalMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not ready for signalling message:", message);
    }
  }, []);

  const attachStreamToVideo = useCallback((userId: string, stream: MediaStream) => {
    const videoEl = remoteVideoRefs.current.get(userId);
    if (videoEl && videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
      if (typeof videoEl.play === "function") {
        videoEl
          .play()
          .catch((err) =>
            console.warn("Unable to autoplay remote video element", err)
          );
      }
    }
  }, []);

  const closePeerConnection = useCallback(
    (remoteUserId: string) => {
      const pc = pcRefs.current.get(remoteUserId);
      if (pc) {
        try {
          pc.ontrack = null;
          pc.onicecandidate = null;
          pc.oniceconnectionstatechange = null;
          pc.close();
        } catch (error) {
          console.warn("Error closing peer connection", error);
        }
        pcRefs.current.delete(remoteUserId);
      }
      pendingCandidatesRef.current.delete(remoteUserId);
      pendingOffersRef.current.delete(remoteUserId);
      initiatedOffersRef.current.delete(remoteUserId);

      setRemoteStreams((prev) => {
        if (!prev.has(remoteUserId)) return prev;
        const updated = new Map(prev);
        updated.delete(remoteUserId);
        return updated;
      });
      remoteVideoRefs.current.delete(remoteUserId);
    },
    [setRemoteStreams]
  );

  const createPeerConnection = useCallback(
    (remoteUserId: string): RTCPeerConnection | undefined => {
      if (pcRefs.current.has(remoteUserId)) {
        return pcRefs.current.get(remoteUserId);
      }

      if (!localStreamRef.current) {
        console.warn("Attempted to create peer connection without local media stream");
        return undefined;
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pcRefs.current.set(remoteUserId, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate && currentUserIdRef.current) {
          const serialisedCandidate = {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          };
          sendSignalMessage({
            type: "candidate",
            fromUserId: currentUserIdRef.current,
            targetUserId: remoteUserId,
            candidate: serialisedCandidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        setRemoteStreams((prev) => {
          const updated = new Map(prev);
          updated.set(remoteUserId, stream);
          return updated;
        });
        attachStreamToVideo(remoteUserId, stream);
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === "failed") {
          closePeerConnection(remoteUserId);
          window.setTimeout(() => {
            if (connectedParticipantsRef.current.has(remoteUserId)) {
              peerRetryRef.current(remoteUserId);
            }
          }, 1000);
        } else if (state === "closed") {
          closePeerConnection(remoteUserId);
        }
      };

      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current as MediaStream);
      });

      return pc;
    },
    [attachStreamToVideo, closePeerConnection, sendSignalMessage]
  );

  const flushPendingCandidates = useCallback(async (remoteUserId: string) => {
    const pc = pcRefs.current.get(remoteUserId);
    const pending = pendingCandidatesRef.current.get(remoteUserId);
    if (!pc || !pending || !pc.remoteDescription) return;

    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Failed to apply pending ICE candidate", error);
      }
    }
    pendingCandidatesRef.current.delete(remoteUserId);
  }, []);

  const processIncomingOffer = useCallback(
    async (remoteUserId: string, offer: RTCSessionDescriptionInit) => {
      let pc = pcRefs.current.get(remoteUserId);
      if (!pc) pc = createPeerConnection(remoteUserId);
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingCandidates(remoteUserId);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const currentUserId = currentUserIdRef.current;
        if (currentUserId) {
          sendSignalMessage({
            type: "answer",
            fromUserId: currentUserId,
            targetUserId: remoteUserId,
            answer: { type: answer.type, sdp: answer.sdp },
          });
        }
      } catch (error) {
        console.error("Failed to process WebRTC offer", error);
      }
    },
    [createPeerConnection, flushPendingCandidates, sendSignalMessage]
  );

  const initiateOffer = useCallback(
    async (remoteUserId: string) => {
      const currentUserId = currentUserIdRef.current;
      if (!currentUserId) return;

      let pc = pcRefs.current.get(remoteUserId);
      if (!pc) {
        pc = createPeerConnection(remoteUserId);
      }
      if (!pc) return;

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignalMessage({
          type: "offer",
          fromUserId: currentUserId,
          targetUserId: remoteUserId,
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
        });
      } catch (error) {
        console.error("Failed to create/send WebRTC offer", error);
      }
    },
    [createPeerConnection, sendSignalMessage]
  );

  const ensurePeerConnection = useCallback(
    (remoteUserId: string) => {
      const currentUserId = currentUserIdRef.current;
      if (!currentUserId || !remoteUserId || remoteUserId === currentUserId) return;
      if (!localStreamRef.current) return;

      if (!pcRefs.current.has(remoteUserId)) {
        createPeerConnection(remoteUserId);
      }

      if (currentUserId < remoteUserId && !initiatedOffersRef.current.has(remoteUserId)) {
        initiatedOffersRef.current.add(remoteUserId);
        initiateOffer(remoteUserId);
      }
    },
    [createPeerConnection, initiateOffer]
  );

  useEffect(() => {
    peerRetryRef.current = ensurePeerConnection;
    return () => {
      peerRetryRef.current = () => {};
    };
  }, [ensurePeerConnection]);

  useEffect(() => {
    if (!localStream) return;
    const pending = Array.from(pendingOffersRef.current.entries());
    pendingOffersRef.current.clear();
    pending.forEach(([remoteUserId, offers]) => {
      offers.forEach((offer) => {
        void processIncomingOffer(remoteUserId, offer);
      });
    });
  }, [localStream, processIncomingOffer]);

  useEffect(() => {
    remoteStreams.forEach((stream, userId) => {
      attachStreamToVideo(userId, stream);
    });
  }, [remoteStreams, attachStreamToVideo]);

  useEffect(() => {
    if (!hasDeterminedTeam || !localStreamRef.current) return;
    const currentUserId = currentUserIdRef.current;
    if (!currentUserId) return;

    const uniqueMemberIds = Array.from(
      new Set(
        [...myTeamMembers, ...opponentTeamMembers]
          .map((member) => member.userId)
          .filter((id): id is string => Boolean(id))
      )
    );

    uniqueMemberIds.forEach((memberId) => {
      ensurePeerConnection(memberId);
    });

    pcRefs.current.forEach((_pc, userId) => {
      if (!uniqueMemberIds.includes(userId)) {
        closePeerConnection(userId);
      }
    });
  }, [
    myTeamMembers,
    opponentTeamMembers,
    hasDeterminedTeam,
    ensurePeerConnection,
    closePeerConnection,
    localStream,
  ]);
  // Ordered list of debate phases
  const phaseOrder: DebatePhase[] = [
    DebatePhase.OpeningFor,
    DebatePhase.OpeningAgainst,
    DebatePhase.CrossForQuestion,
    DebatePhase.CrossAgainstAnswer,
    DebatePhase.CrossAgainstQuestion,
    DebatePhase.CrossForAnswer,
    DebatePhase.ClosingFor,
    DebatePhase.ClosingAgainst,
    DebatePhase.Finished,
  ];

  // Fetch debate details - proceed if we have debateId and either user or token
  useEffect(() => {
    const fetchDebate = async () => {
      const token = getAuthToken();
      
      // Allow proceeding if we have a token, even if user isn't fully loaded yet
        // The debate API will use the token for authentication
        if (!debateId || (!token && !currentUser?.id)) {
        console.log("[TeamDebateRoom] Waiting for user/token...", { 
          debateId, 
          userId: currentUser?.id,
          hasToken: !!token,
          isUserLoading,
          userFromAtom: user?.id,
          userFromHook: userFromHook?.id
        });
        return;
      }

      try {
        const debateData = await getTeamDebate(debateId);
        setDebate(debateData);
        setTopic(debateData.topic || "");

        // Determine which team the current user belongs to
        // Try to match by user ID - if user isn't loaded yet, we'll match later
        const userId = currentUser?.id || user?.id;
        const userTeam1 = debateData.team1Members?.some(
          (member: TeamMember) => member.userId === userId
        );
        const userTeam2 = debateData.team2Members?.some(
          (member: TeamMember) => member.userId === userId
        );

        console.log("[TeamDebateRoom] Determining user team:", {
          userId: userId,
          currentUser: currentUser?.id,
          userFromAtom: user?.id,
          userTeam1,
          userTeam2,
          team1Members: debateData.team1Members?.map((m: TeamMember) => m.userId),
          team2Members: debateData.team2Members?.map((m: TeamMember) => m.userId),
        });

        if (userTeam1) {
          setIsTeam1(true);
          setMyTeamId(debateData.team1Id);
          setMyTeamName(debateData.team1Name || "Team 1");
          setOpponentTeamName(debateData.team2Name || "Team 2");
          setMyTeamMembers(debateData.team1Members || []);
          setOpponentTeamMembers(debateData.team2Members || []);
          const team1Stance = debateData.team1Stance === "for" ? "for" : "against";
          const team2Stance = debateData.team2Stance === "for" ? "for" : "against";
          setLocalRole(team1Stance);
          setPeerRole(team2Stance);
          console.log("[TeamDebateRoom] User is Team1. My Team:", debateData.team1Name, "Stance:", team1Stance, "Opponent:", debateData.team2Name, "Stance:", team2Stance);
        } else if (userTeam2) {
          setIsTeam1(false);
          setMyTeamId(debateData.team2Id);
          setMyTeamName(debateData.team2Name || "Team 2");
          setOpponentTeamName(debateData.team1Name || "Team 1");
          setMyTeamMembers(debateData.team2Members || []);
          setOpponentTeamMembers(debateData.team1Members || []);
          const team1Stance = debateData.team1Stance === "for" ? "for" : "against";
          const team2Stance = debateData.team2Stance === "for" ? "for" : "against";
          setLocalRole(team2Stance);
          setPeerRole(team1Stance);
          console.log("[TeamDebateRoom] User is Team2. My Team:", debateData.team2Name, "Stance:", team2Stance, "Opponent:", debateData.team1Name, "Stance:", team1Stance);
        } else {
          console.error("[TeamDebateRoom] ERROR: User is not in either team!");
        }

        setHasDeterminedTeam(true);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch debate:", error);
        setHasDeterminedTeam(true);
        setIsLoading(false);
      }
    };

    fetchDebate();
  }, [debateId, currentUser?.id, isUserLoading]); // Wait for debateId and optionally user.id

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
  }, [timer, debatePhase, isMyTurn, localRole, debateId]);

  useEffect(() => {
  currentUserIdRef.current = currentUser?.id ?? null;
  myTeamIdRef.current = myTeamId;
  isTeam1Ref.current = isTeam1;
  debatePhaseRef.current = debatePhase;
}, [currentUser?.id, myTeamId, isTeam1, debatePhase]);


  // Initialize WebSocket connection - only need token and debateId
  // User ID will be extracted from token on backend
 
  useEffect(() => {
    const token = getAuthToken();
    if (!token || !debateId || !hasDeterminedTeam) {
      console.log("[TeamDebateRoom] Waiting for prerequisites before connecting WebSocket...", {
        hasToken: !!token,
        debateId,
        hasDeterminedTeam,
      });
      return;
    }

    console.log("[TeamDebateRoom] Initializing WebSocket connection...", {
      debateId,
      userId: currentUserIdRef.current,
      hasDeterminedTeam,
    });

    let cancelled = false;

    const ensureMediaStream = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError("Camera and microphone access require a supported browser and a secure connection (HTTPS or localhost).");
        return;
      }
      let audioTracks: MediaStreamTrack[] = [];
      let videoTracks: MediaStreamTrack[] = [];
      let audioError: unknown;
      let videoError: unknown;

      try {
        audioTracks = (await navigator.mediaDevices.getUserMedia({ audio: true })).getAudioTracks();
      } catch (error) {
        audioError = error;
        console.error("Microphone access failed:", error);
      }
      try {
        videoTracks = (
          await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: false,
          })
        ).getVideoTracks();
      } catch (error) {
        videoError = error;
        console.error("Camera access failed:", error);
      }

      if (cancelled) {
        [...audioTracks, ...videoTracks].forEach((track) => track.stop());
        return;
      }

      const stream = localStreamRef.current ?? new MediaStream();
      audioTracks.forEach((track) => {
        if (stream.getAudioTracks().length === 0) stream.addTrack(track);
        else track.stop();
      });
      videoTracks.forEach((track) => {
        if (stream.getVideoTracks().length === 0) stream.addTrack(track);
        else track.stop();
      });
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      if (stream.getAudioTracks().length === 0 && !audioError) {
        audioError = new Error("No microphone track was provided.");
      }
      if (stream.getVideoTracks().length === 0 && !videoError) {
        videoError = new Error("No camera track was provided.");
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      const microphoneOn = stream.getAudioTracks().some((track) => track.enabled);
      const cameraOn = stream.getVideoTracks().some((track) => track.enabled);
      setIsMicrophoneOn(microphoneOn);
      setIsCameraOn(cameraOn);
      publishMediaState(cameraOn, microphoneOn);

      pcRefs.current.forEach((connection, remoteUserId) => {
        const existingTracks = new Set(
          connection.getSenders().map((sender) => sender.track?.id).filter(Boolean)
        );
        stream.getTracks().forEach((track) => {
          if (!existingTracks.has(track.id)) connection.addTrack(track, stream);
        });
        const currentUserId = currentUserIdRef.current;
        if (
          currentUserId &&
          currentUserId < remoteUserId &&
          connection.signalingState === "stable" &&
          connection.getSenders().some((sender) => sender.track)
        ) {
          void renegotiatePeerConnection(
            connection,
            currentUserId,
            remoteUserId,
            wsRef.current
          ).catch((error: unknown) => {
            console.error("Failed to renegotiate debate media:", error);
          });
        }
      });

      const localVideo = localVideoRefs.current.get(currentUserIdRef.current || "");
      if (localVideo) localVideo.srcObject = stream;
      setMediaError(audioError || videoError
        ? [audioError ? getMediaErrorMessage("microphone", audioError) : "",
            videoError ? getMediaErrorMessage("camera", videoError) : ""]
            .filter(Boolean)
            .join(" ")
        : null);
    };

    const wsUrl = new URL("/ws/team", BASE_URL);
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    wsUrl.searchParams.set("debateId", debateId);
    wsUrl.searchParams.set("token", token);

    const ws = new ReconnectingWebSocket(wsUrl.toString(), [], {
      connectionTimeout: 4000,
      maxRetries: Infinity,
      maxReconnectionDelay: 10000,
      minReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1.3,
    });
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) {
        ws.close();
        return;
      }

      setIsWsConnected(true);
      console.log("Team debate WebSocket connected");
      ws.send(JSON.stringify({ type: "join" }));
      publishMediaState(
        localStreamRef.current?.getVideoTracks().some((track) => track.enabled) ?? false,
        localStreamRef.current?.getAudioTracks().some((track) => track.enabled) ?? false
      );
      if (!localStreamRef.current) void ensureMediaStream();
    };

    ws.onmessage = async (event) => {
      const data: WSMessage = JSON.parse(event.data);
      console.log("Received WebSocket message:", data);

      const amTeam1 = isTeam1Ref.current;
      const currentMyTeamId = myTeamIdRef.current;
      const currentUserId = currentUserIdRef.current;
      switch (data.type) {
        case "stateSync": {
          // Sync all state when joining or receiving state update
          if (data.topic !== undefined) setTopic(data.topic);
          // CRITICAL: Only sync phase if debate hasn't started, or if backend phase is ahead
          if (data.phase) {
            const backendPhase = data.phase as DebatePhase;
            // Don't allow stateSync to reset phase back to Setup if debate has started
            if (debateStartedRef.current && backendPhase === DebatePhase.Setup) {
              console.log('⚠️ stateSync tried to reset phase to Setup, but debate has started - ignoring');
            } else {
              console.log(
                `stateSync: updating phase from ${debatePhaseRef.current} to ${backendPhase}`
              );
              setDebatePhase(backendPhase);
              // If backend says phase is not Setup, mark debate as started
              if (backendPhase !== DebatePhase.Setup) {
                debateStartedRef.current = true;
              }
            }
          }
          // Set roles based on which team the user is on
          // If user is Team1, their role is team1Role, opponent role is team2Role
          // If user is Team2, their role is team2Role, opponent role is team1Role
          if (amTeam1) {
            if (data.team1Role) {
              setLocalRole(data.team1Role as DebateRole);
            }
            if (data.team2Role) {
              setPeerRole(data.team2Role as DebateRole);
            }
          } else {
            if (data.team2Role) {
              setLocalRole(data.team2Role as DebateRole);
            }
            if (data.team1Role) {
              setPeerRole(data.team1Role as DebateRole);
            }
          }
          if (data.team1Ready !== undefined) setTeam1ReadyCount(data.team1Ready);
          if (data.team2Ready !== undefined) setTeam2ReadyCount(data.team2Ready);
          if (data.team1MembersCount !== undefined) setTeam1MembersCount(data.team1MembersCount);
          if (data.team2MembersCount !== undefined) setTeam2MembersCount(data.team2MembersCount);
          if (data.roomParticipants) {
            connectedParticipantsRef.current = new Set(
              data.roomParticipants
                .map((participant) => participant.id)
                .filter((id) => id !== currentUserId)
            );
            setRemoteMediaStates(
              new Map(
                data.roomParticipants
                  .filter((participant) => participant.id !== currentUserId)
                  .map((participant) => [
                    participant.id,
                    {
                      cameraOn: participant.cameraOn ?? false,
                      microphoneOn: participant.microphoneOn ?? false,
                    },
                  ])
              )
            );
            data.roomParticipants.forEach((participant) => {
              if (participant.id !== currentUserId) ensurePeerConnection(participant.id);
            });
          }
          
          // Update team names if provided (for late joiners)
          if ((data as any).team1Name) {
            if (amTeam1) {
              setMyTeamName((data as any).team1Name);
            } else {
              setOpponentTeamName((data as any).team1Name);
            }
          }
          if ((data as any).team2Name) {
            if (amTeam1) {
              setOpponentTeamName((data as any).team2Name);
            } else {
              setMyTeamName((data as any).team2Name);
            }
          }
          
          // Update individual player ready status (for late joiners)
          if ((data as any).team1ReadyStatus) {
            const team1Status = (data as any).team1ReadyStatus as Record<string, boolean>;
            setPlayerReadyStatus(prev => {
              const updated = new Map(prev);
              Object.entries(team1Status).forEach(([userId, ready]) => {
                updated.set(userId, ready);
              });
              return updated;
            });
          }
          if ((data as any).team2ReadyStatus) {
            const team2Status = (data as any).team2ReadyStatus as Record<string, boolean>;
            setPlayerReadyStatus(prev => {
              const updated = new Map(prev);
              Object.entries(team2Status).forEach(([userId, ready]) => {
                updated.set(userId, ready);
              });
              return updated;
            });
          }
          
          // Check if opponent team members are all ready (but don't override localReady)
          // localReady should only be set when the user clicks the ready button
          const opponentReadyCount =
            (amTeam1 ? data.team2Ready : data.team1Ready) ?? 0;
          const opponentMemberCount =
            (amTeam1 ? data.team2MembersCount : data.team1MembersCount) ?? 0;
          setPeerReady(
            opponentMemberCount > 0 &&
              opponentReadyCount === opponentMemberCount
          );
          
          // Update localReady if we have the user's ready status in stateSync
          if (currentUserId) {
            const team1Status = (data as any).team1ReadyStatus as Record<string, boolean> | undefined;
            const team2Status = (data as any).team2ReadyStatus as Record<string, boolean> | undefined;
            if (amTeam1 && team1Status && team1Status[currentUserId] !== undefined) {
              setLocalReady(team1Status[currentUserId]);
            } else if (!amTeam1 && team2Status && team2Status[currentUserId] !== undefined) {
              setLocalReady(team2Status[currentUserId]);
            }
          }
          
          break;
        }
        case "teamMembers": {
          if (data.team1Members) {
            if (amTeam1) {
              setMyTeamMembers(data.team1Members);
            } else {
              setOpponentTeamMembers(data.team1Members);
            }
          }
          if (data.team2Members) {
            if (amTeam1) {
              setOpponentTeamMembers(data.team2Members);
            } else {
              setMyTeamMembers(data.team2Members);
            }
          }
          // Initialize ready status for new members (default to false)
          const team1Members = data.team1Members ?? [];
          if (team1Members.length) {
            setPlayerReadyStatus(prev => {
              const updated = new Map(prev);
              team1Members.forEach((member: TeamMember) => {
                if (!updated.has(member.userId)) {
                  updated.set(member.userId, false);
                }
              });
              return updated;
            });
          }
          const team2Members = data.team2Members ?? [];
          if (team2Members.length) {
            setPlayerReadyStatus(prev => {
              const updated = new Map(prev);
              team2Members.forEach((member: TeamMember) => {
                if (!updated.has(member.userId)) {
                  updated.set(member.userId, false);
                }
              });
              return updated;
            });
          }
          break;
        }
        case "participantJoined": {
          const participant = data.participant;
          if (!participant?.id) break;
          if (participant.id !== currentUserId) {
            connectedParticipantsRef.current.add(participant.id);
          }
          setRemoteMediaStates((previous) => {
            const next = new Map(previous);
            next.set(participant.id, {
              cameraOn: participant.cameraOn ?? false,
              microphoneOn: participant.microphoneOn ?? false,
            });
            return next;
          });
          if (participant.teamId) {
            const member: TeamMember = {
              userId: participant.id,
              email: "",
              displayName: participant.displayName || participant.username || "Debater",
              elo: participant.elo ?? 0,
              avatarUrl: participant.avatarUrl,
            };
            const updateMembers = (members: TeamMember[]) =>
              members.some((existing) => existing.userId === member.userId)
                ? members.map((existing) =>
                    existing.userId === member.userId
                      ? {
                          ...existing,
                          displayName: member.displayName || existing.displayName,
                          avatarUrl: member.avatarUrl || existing.avatarUrl,
                        }
                      : existing
                  )
                : [...members, member];
            if (participant.teamId === currentMyTeamId) {
              setMyTeamMembers(updateMembers);
            } else {
              setOpponentTeamMembers(updateMembers);
            }
          }
          if (participant.id !== currentUserId) ensurePeerConnection(participant.id);
          break;
        }
        case "mediaState": {
          if (!data.userId) break;
          setRemoteMediaStates((previous) => {
            const next = new Map(previous);
            next.set(data.userId!, {
              cameraOn: data.cameraOn ?? false,
              microphoneOn: data.microphoneOn ?? false,
            });
            return next;
          });
          break;
        }
        case "transcriptSync": {
          data.entries?.forEach((entry) => {
            if (
              entry.transcriptId &&
              entry.userId &&
              typeof entry.speechText === "string" &&
              entry.speechText.trim()
            ) {
              appendTranscript(
                entry.phase,
                `${entry.username || "Debater"}: ${entry.speechText.trim()}`,
                entry.transcriptId
              );
            }
          });
          break;
        }
        case "topicChange":
          if (data.topic !== undefined) setTopic(data.topic);
          break;
        case "roleSelection": {
          if (data.role && data.teamId) {
            // Determine if this is from our team or opponent team based on teamId
            const messageTeamId = data.teamId;
            const isFromMyTeam =
              currentMyTeamId !== null
                ? messageTeamId === currentMyTeamId
                : false;
            
            if (isFromMyTeam) {
              // This role selection is from my team
              setLocalRole(data.role as DebateRole);
              console.log(`Role selection from my team (${messageTeamId}): ${data.role}`);
            } else {
              // This role selection is from opponent team
              setPeerRole(data.role as DebateRole);
              console.log(`Role selection from opponent team (${messageTeamId}): ${data.role}`);
            }
          }
          break;
        }
        case "countdownStart": {
          // Backend is starting countdown - show it to all users
          const countdownValue = (data as any).countdown || 3;
          console.log('✓✓✓ COUNTDOWN STARTED FROM BACKEND:', countdownValue);
          setCountdown(countdownValue);
          // Hide setup popup when countdown starts
          setShowSetupPopup(false);
          break;
        }
        case "checkStart":
          // Ignore checkStart messages from backend (we shouldn't receive them)
          // This is sent by frontend to backend, not the other way around
          console.log('Received checkStart message (ignoring - this is from us)');
          break;
        case "ready": {
          console.log("=== READY MESSAGE RECEIVED ===");
          console.log("Received ready message:", data);
          console.log("Current user:", currentUser?.id);
          console.log("Message userId:", data.userId);
          console.log("Message teamId:", data.teamId);
          console.log("Message assignedToTeam:", (data as any).assignedToTeam);
          console.log("isTeam1:", isTeam1);
          console.log("myTeamId:", myTeamId);
          console.log(
            "Team1Ready:",
            data.team1Ready,
            "Team2Ready:",
            data.team2Ready
          );
          console.log(
            "Team1MembersCount:",
            data.team1MembersCount,
            "Team2MembersCount:",
            data.team2MembersCount
          );
          
          // CRITICAL: Verify the ready status is assigned to the correct team
          const messageTeamId = data.teamId;
          const expectedTeamId = currentMyTeamId; // Should be the same regardless of isTeam1
          const assignedTeam = (data as any).assignedToTeam;
          
          // Update the ready status for the specific user who clicked
          if (data.userId === currentUserId && data.ready !== undefined) {
            // Verify team assignment matches
            if (assignedTeam && assignedTeam !== (amTeam1 ? "Team1" : "Team2")) {
              console.error(`❌ CRITICAL ERROR: Ready status assigned to wrong team! User ${data.userId} is ${amTeam1 ? "Team1" : "Team2"} but assigned to ${assignedTeam}`);
            } else if (messageTeamId && expectedTeamId && messageTeamId !== expectedTeamId) {
              console.error(`❌ WARNING: TeamId mismatch! Expected ${expectedTeamId}, got ${messageTeamId}`);
            } else {
              console.log(`✓ Updating localReady to ${data.ready} for user ${data.userId}`);
              setLocalReady(data.ready);
            }
          }
          
          // Update individual player ready status
          if (data.userId && data.ready !== undefined) {
            setPlayerReadyStatus(prev => new Map(prev).set(data.userId!, data.ready!));
          }
          
          // Update team ready counts - these are the ACTUAL counts from backend
          if (data.team1Ready !== undefined) {
            console.log(`Updating team1ReadyCount to ${data.team1Ready}`);
            setTeam1ReadyCount(data.team1Ready);
          }
          if (data.team2Ready !== undefined) {
            console.log(`Updating team2ReadyCount to ${data.team2Ready}`);
            setTeam2ReadyCount(data.team2Ready);
          }
          // CRITICAL: Update member counts from ready message
          // Check both direct access and through (data as any) to handle type issues
          const team1Count = data.team1MembersCount ?? (data as any).team1MembersCount;
          const team2Count = data.team2MembersCount ?? (data as any).team2MembersCount;
          
          if (team1Count !== undefined && team1Count !== null) {
            console.log(`✓ Updating team1MembersCount to ${team1Count}`);
            setTeam1MembersCount(team1Count);
          } else {
            console.warn(`⚠️ team1MembersCount is undefined in ready message. Raw data:`, data);
            console.warn(`⚠️ Full message keys:`, Object.keys(data));
          }
          if (team2Count !== undefined && team2Count !== null) {
            console.log(`✓ Updating team2MembersCount to ${team2Count}`);
            setTeam2MembersCount(team2Count);
          } else {
            console.warn(`⚠️ team2MembersCount is undefined in ready message. Raw data:`, data);
          }
          
          // Display what we're showing to the user
          // CRITICAL: Each user should see their own team correctly
          // Use (data as any) to access fields that might not be in TypeScript interface
          const dataAny = data as any;
          const myTeamReadyCount = amTeam1
            ? (data.team1Ready ?? dataAny.team1Ready)
            : (data.team2Ready ?? dataAny.team2Ready);
          const myTeamTotal = amTeam1
            ? (data.team1MembersCount ?? dataAny.team1MembersCount)
            : (data.team2MembersCount ?? dataAny.team2MembersCount);
          const oppReadyCount = amTeam1
            ? (data.team2Ready ?? dataAny.team2Ready)
            : (data.team1Ready ?? dataAny.team1Ready);
          const oppTeamTotal = amTeam1
            ? (data.team2MembersCount ?? dataAny.team2MembersCount)
            : (data.team1MembersCount ?? dataAny.team1MembersCount);
          
          console.log(`[Display] isTeam1=${amTeam1}, myTeamName=${myTeamName}`);
          console.log(`[Display] My Team (${myTeamName}) Ready: ${myTeamReadyCount}/${myTeamTotal}`);
          console.log(`[Display] Opponent Team (${opponentTeamName}) Ready: ${oppReadyCount}/${oppTeamTotal}`);
          console.log(`[Display] Backend counts - Team1Ready=${data.team1Ready}, Team2Ready=${data.team2Ready}`);
          console.log(`[Display] Raw data - team1MembersCount=${data.team1MembersCount}, team2MembersCount=${data.team2MembersCount}`);
          console.log(`[Display] Full ready message data:`, JSON.stringify(data));
          
          // Validation: Ensure we're showing the right team
          if (data.userId === currentUserId && assignedTeam) {
            const expectedTeamForUser = amTeam1 ? "Team1" : "Team2";
            if (assignedTeam !== expectedTeamForUser) {
              console.error(`❌ CRITICAL: User ${currentUserId} is ${amTeam1 ? "Team1" : "Team2"} but ready assigned to ${assignedTeam}!`);
            } else {
              console.log(`✓ Validation passed: User is ${expectedTeamForUser} and ready assigned to ${assignedTeam}`);
            }
          }
                    // Update peer ready status (whether all opponent team members are ready)
          const allOppReady = oppReadyCount === oppTeamTotal && oppTeamTotal > 0;
          setPeerReady(allOppReady);
          console.log("=== END READY MESSAGE ===");
          break;
        }
        case "phaseChange": {
          if (data.phase) {
            const newPhase = data.phase as DebatePhase;
            console.log(
              `✓✓✓ RECEIVED PHASE CHANGE: ${newPhase} (previous: ${debatePhaseRef.current})`
            );
            console.log(`Phase change data:`, data);

            // Ensure we accept the phase change
            setDebatePhase(newPhase);

            // Close setup popup and clear countdown when debate starts (ALWAYS if not setup)
            if (newPhase !== DebatePhase.Setup) {
              debateStartedRef.current = true; // Mark debate as started - prevent popup from reopening
              setShowSetupPopup(false);
              setCountdown(null);
              console.log('✓ Debate phase changed to:', newPhase, '- closing setup popup permanently');
            } else {
              console.log('⚠️ Phase change to Setup - debate not started');
            }
          } else {
            console.warn('⚠️ Phase change message received but phase is undefined:', data);
          }
          break;
        }
        case "phaseChangeError": {
          setPopup({
            show: true,
            message: data.message || "The debate phase could not be synchronized.",
            isJudging: false,
          });
          break;
        }
        case "error": {
          setSpeechError(data.message || "The debate room reported an error.");
          break;
        }
        case "speechText": {
          if (data.userId && typeof data.speechText === "string" && data.speechText.trim()) {
            const targetPhase = data.phase || debatePhaseRef.current;
            const speaker = data.username?.trim() || "Teammate";
            const speechText = data.speechText.trim();
            markActiveSpeaker(data.userId);
            appendTranscript(targetPhase, `${speaker}: ${speechText}`, data.transcriptId);
          }
          break;
        }
        case "teamStatus": {
          // Update team member status
          if (data.team1Members) {
            if (amTeam1) {
              setMyTeamMembers(data.team1Members);
            } else {
              setOpponentTeamMembers(data.team1Members);
            }
          }
          if (data.team2Members) {
            if (amTeam1) {
              setOpponentTeamMembers(data.team2Members);
            } else {
              setMyTeamMembers(data.team2Members);
            }
          }
          break;
        }
        case "offer":
          if (
            data.targetUserId !== currentUserId ||
            !data.fromUserId ||
            !data.offer
          ) {
            break;
          }
          {
            if (!localStreamRef.current) {
              const offers = pendingOffersRef.current.get(data.fromUserId) || [];
              offers.push(data.offer);
              pendingOffersRef.current.set(data.fromUserId, offers);
            } else {
              await processIncomingOffer(data.fromUserId, data.offer);
            }
          }
          break;
        case "answer":
          if (
            data.targetUserId !== currentUserId ||
            !data.fromUserId ||
            !data.answer
          ) {
            break;
          }
          {
            const pc = pcRefs.current.get(data.fromUserId);
            if (!pc) break;
            try {
              await pc.setRemoteDescription(
                new RTCSessionDescription(data.answer)
              );
              await flushPendingCandidates(data.fromUserId);
            } catch (error) {
              console.error("Failed to process WebRTC answer", error);
            }
          }
          break;
        case "candidate":
          if (
            data.targetUserId !== currentUserId ||
            !data.fromUserId ||
            !data.candidate
          ) {
            break;
          }
          {
            let pc = pcRefs.current.get(data.fromUserId);
            if (!pc) {
              pc = createPeerConnection(data.fromUserId);
            }
            if (!pc) {
              const queue =
                pendingCandidatesRef.current.get(data.fromUserId) || [];
              queue.push(data.candidate);
              pendingCandidatesRef.current.set(data.fromUserId, queue);
              break;
            }

            const candidateInit = data.candidate as RTCIceCandidateInit;
            try {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
              } else {
                const queue =
                  pendingCandidatesRef.current.get(data.fromUserId) || [];
                queue.push(candidateInit);
                pendingCandidatesRef.current.set(data.fromUserId, queue);
              }
            } catch (error) {
              console.error("Failed to add ICE candidate", error);
            }
          }
          break;
        case "leave":
          if (data.userId) {
            connectedParticipantsRef.current.delete(data.userId);
            closePeerConnection(data.userId);
            setRemoteMediaStates((previous) => {
              const next = new Map(previous);
              next.delete(data.userId!);
              return next;
            });
            setActiveSpeakerId((activeSpeaker) =>
              activeSpeaker === data.userId ? null : activeSpeaker
            );
          }
          break;
      }
    };

    ws.onerror = (err) => {
      setIsWsConnected(false);
      console.error("WebSocket error:", err);
    };
    ws.onclose = () => {
      if (!cancelled) setIsWsConnected(false);
      console.log("WebSocket closed");
    };

    return () => {
      cancelled = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      pcRefs.current.forEach((pc) => pc.close());
    };
  }, [
    debateId,
    hasDeterminedTeam,
    createPeerConnection,
    flushPendingCandidates,
    sendSignalMessage,
    processIncomingOffer,
    closePeerConnection,
    myTeamId,
    currentUser?.id,
    markActiveSpeaker,
    appendTranscript,
    publishMediaState,
  ]);

  useEffect(() => {
    speechRecognitionContextRef.current = {
      isMyTurn,
      phase: debatePhase,
      microphoneEnabled: isMicrophoneOn,
      disabled: speechRecognitionDisabled,
      userId: currentUser?.id,
      displayName: currentUser?.displayName,
    };
  }, [
    isMyTurn,
    debatePhase,
    isMicrophoneOn,
    speechRecognitionDisabled,
    currentUser?.id,
    currentUser?.displayName,
  ]);

  // Keep one recognition instance alive; changing turns or mic state should not abort it.
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechRecognitionDisabled(true);
      setSpeechError("Automatic speech transcription requires Chrome or Edge with speech recognition support.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      speechRecognitionRunningRef.current = true;
      setIsListening(true);
      setSpeechError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const context = speechRecognitionContextRef.current;
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalTranscript += `${transcript} `;
      }

      if (finalTranscript.trim()) {
        const speaker = context.displayName || "Speaker";
        const phase = speechRecognitionPhaseRef.current;
        const transcriptId =
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${context.userId || "speaker"}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        appendTranscript(phase, `${speaker}: ${finalTranscript.trim()}`, transcriptId);
        if (context.userId) markActiveSpeaker(context.userId);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "speechText",
              userId: context.userId,
              username: speaker,
              speechText: finalTranscript.trim(),
              phase,
              transcriptId,
            })
          );
        }
      }
    };

    recognition.onerror = (event: Event) => {
      const error = (event as Event & { error?: string }).error || "unknown";
      speechRecognitionRunningRef.current = false;
      setIsListening(false);
      console.error(`Speech recognition failed (${error}).`);

      if (error === "aborted" || error === "no-speech") return;
      if (error === "not-allowed" || error === "service-not-allowed") {
        setSpeechRecognitionDisabled(true);
        setSpeechError("Speech recognition permission was denied. Allow microphone access for this site, then reload the debate.");
      } else if (error === "audio-capture") {
        setSpeechError("Speech recognition cannot access a microphone. Check that one is connected and not in use by another app.");
      } else if (error === "network") {
        setSpeechError("The browser's speech-to-text service could not connect. Check your internet connection; transcription will retry while you are speaking.");
      } else {
        setSpeechError(`Speech recognition failed (${error}). Check microphone permissions and browser support.`);
      }
    };

    recognition.onend = () => {
      speechRecognitionRunningRef.current = false;
      setIsListening(false);
      if (speechRecognitionStopTimeoutRef.current !== null) {
        window.clearTimeout(speechRecognitionStopTimeoutRef.current);
        speechRecognitionStopTimeoutRef.current = null;
      }
      speechRecognitionStopWaitersRef.current.splice(0).forEach((resolve) => resolve());
      const context = speechRecognitionContextRef.current;
      if (
        context.isMyTurn &&
        context.microphoneEnabled &&
        !context.disabled &&
        context.phase !== DebatePhase.Setup &&
        context.phase !== DebatePhase.Finished &&
        speechRecognitionRestartRef.current === null
      ) {
        speechRecognitionRestartRef.current = window.setTimeout(() => {
          speechRecognitionRestartRef.current = null;
          const latest = speechRecognitionContextRef.current;
          if (
            latest.isMyTurn &&
            latest.microphoneEnabled &&
            !latest.disabled &&
            !speechRecognitionRunningRef.current
          ) {
            try {
              speechRecognitionPhaseRef.current = latest.phase;
              speechRecognitionRunningRef.current = true;
              recognition.start();
            } catch (error) {
              speechRecognitionRunningRef.current = false;
              console.error("Failed to restart speech recognition:", error);
            }
          }
        }, 300);
      }
    };

    return () => {
      if (speechRecognitionRestartRef.current !== null) {
        window.clearTimeout(speechRecognitionRestartRef.current);
        speechRecognitionRestartRef.current = null;
      }
      const wasRunning = speechRecognitionRunningRef.current;
      speechRecognitionRunningRef.current = false;
      recognitionRef.current = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      if (wasRunning) recognition.stop();
    };
  }, [appendTranscript, markActiveSpeaker]);

  const startSpeechRecognition = useCallback(() => {
    const context = speechRecognitionContextRef.current;
    const recognition = recognitionRef.current;
    if (
      !recognition ||
      context.disabled ||
      !context.microphoneEnabled ||
      !context.isMyTurn ||
      context.phase === DebatePhase.Setup ||
      context.phase === DebatePhase.Finished ||
      speechRecognitionRunningRef.current
    ) {
      return;
    }

    try {
      speechRecognitionPhaseRef.current = context.phase;
      speechRecognitionRunningRef.current = true;
      recognition.start();
    } catch (error) {
      speechRecognitionRunningRef.current = false;
      console.error("Failed to start speech recognition:", error);
    }
  }, []);

  const stopSpeechRecognition = useCallback((): Promise<void> => {
    const recognition = recognitionRef.current;
    if (speechRecognitionRestartRef.current !== null) {
      window.clearTimeout(speechRecognitionRestartRef.current);
      speechRecognitionRestartRef.current = null;
    }
    if (!recognition || !speechRecognitionRunningRef.current) {
      return Promise.resolve();
    }
    speechRecognitionRunningRef.current = false;
    return new Promise((resolve) => {
      const finish = () => {
        if (speechRecognitionStopTimeoutRef.current !== null) {
          window.clearTimeout(speechRecognitionStopTimeoutRef.current);
          speechRecognitionStopTimeoutRef.current = null;
        }
        speechRecognitionStopWaitersRef.current =
          speechRecognitionStopWaitersRef.current.filter((waiter) => waiter !== finish);
        resolve();
      };
      speechRecognitionStopWaitersRef.current.push(finish);
      speechRecognitionStopTimeoutRef.current = window.setTimeout(finish, 1500);
      try {
        recognition.stop();
      } catch (error) {
        console.error("Failed to stop speech recognition cleanly:", error);
        finish();
      }
    });
  }, []);

  useEffect(() => {
    if (canSpeakNow) return;

    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setIsMicrophoneOn(false);
    stopSpeechRecognition();
  }, [canSpeakNow, stopSpeechRecognition]);

  // Auto start/stop speech recognition based on turn
  useEffect(() => {
    if (
      isMyTurn &&
      isMicrophoneOn &&
      debatePhase !== DebatePhase.Setup &&
      debatePhase !== DebatePhase.Finished
    ) {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }

    return () => {
      stopSpeechRecognition();
    };
  }, [
    isMyTurn,
    isMicrophoneOn,
    debatePhase,
    startSpeechRecognition,
    stopSpeechRecognition,
  ]);

  // Handle phase completion
  const handlePhaseDone = () => {
    const currentIndex = phaseOrder.indexOf(debatePhase);
    if (currentIndex >= 0 && currentIndex < phaseOrder.length - 1) {
      const nextPhase = phaseOrder[currentIndex + 1];
      const socket = wsRef.current;
      if (socket?.readyState !== WebSocket.OPEN) {
        console.error("Cannot advance debate phase while the WebSocket is disconnected.");
        setPopup({
          show: true,
          message: "Connection lost. Reconnect before the debate can continue.",
          isJudging: false,
        });
        return;
      }
      socket.send(JSON.stringify({ type: "phaseChange", phase: nextPhase }));
    }
  };

  // Log message history and send to backend (same as OnlineDebateRoom)
  const logMessageHistory = async () => {
    if (!localRole || !debateId) return;
    speechRecognitionContextRef.current = {
      ...speechRecognitionContextRef.current,
      isMyTurn: false,
      phase: DebatePhase.Finished,
      microphoneEnabled: false,
    };
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setIsMicrophoneOn(false);
    await stopSpeechRecognition();

    const debateTranscripts: { [key in DebatePhase]?: string } = {};
    const phasesForRole =
      localRole === "for"
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

    phasesForRole.forEach((phase) => {
      const transcript = speechTranscriptsRef.current[phase] || "No response";
      debateTranscripts[phase] = transcript;
    });

    setPopup({
      show: true,
      message: "Submitting transcripts and awaiting judgment...",
      isJudging: true,
    });

    try {
      const token = getAuthToken();
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };
      const payload = {
        roomId: debateId,
        role: localRole,
        transcripts: debateTranscripts,
      };
      const response = await fetch(`${BASE_URL}/submit-transcripts`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorBody: { error?: string } = await response.json();
        throw new Error(
          errorBody.error || `Transcript submission failed (${response.status})`
        );
      }

      let result: { message?: string; result?: string } = await response.json();
      const deadline = Date.now() + 150_000;
      while (
        result.message !== "Debate judged" &&
        result.message !== "Debate already judged" &&
        Date.now() < deadline
      ) {
        setPopup({
          show: true,
          message:
            result.message === "Waiting for teammates to submit"
              ? "Waiting for every debater to submit their arguments..."
              : result.message === "Debate has not ended"
                ? "Waiting for the debate end to be confirmed..."
              : result.message === "Waiting for opponent submission"
                ? "Waiting for both teams' transcripts..."
              : "The AI judge is analyzing the debate...",
          isJudging: true,
        });
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const resultResponse = await fetch(
          `${BASE_URL}/debate-results/${encodeURIComponent(debateId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resultResponse.status === 202) {
          result = { message: "Judgment pending" };
          continue;
        }
        if (!resultResponse.ok) {
          throw new Error(`Could not retrieve the AI judgment (${resultResponse.status})`);
        }
        result = await resultResponse.json();
      }

      if (result.message !== "Debate judged" && result.message !== "Debate already judged") {
        throw new Error("The AI judge is taking longer than expected. Please reopen this debate shortly to check for results.");
      }
      if (!result.result) {
        throw new Error("The AI judge returned an empty result.");
      }
      const jsonString = extractJSON(result.result);
      const judgment: JudgmentData = JSON.parse(jsonString);
      setJudgmentData(judgment);
      setPopup({ show: false, message: "" });
      setShowJudgment(true);
    } catch (error) {
      console.error("Failed to submit or retrieve debate judgment:", error);
      setPopup({
        show: true,
        message:
          error instanceof Error
            ? error.message
            : "Error occurred while judging. Please try again.",
        isJudging: false,
      });
    }
  };

  useEffect(() => {
    if (debatePhase !== DebatePhase.Finished) {
      finalSubmissionStartedRef.current = false;
      return;
    }
    if (!localRole || !debateId || finalSubmissionStartedRef.current) return;

    finalSubmissionStartedRef.current = true;
    void logMessageHistory();
  }, [debatePhase, debateId, localRole]);


  // Handlers for user actions
  const handleTopicChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const newTopic = e.target.value;
    setTopic(newTopic);
    wsRef.current?.send(JSON.stringify({ type: "topicChange", topic: newTopic }));
  };

  const handleRoleSelection = (role: DebateRole) => {
    if (peerRole === role) {
      alert(
        `Your opponent already chose "${role}". Please select the other side.`
      );
      return;
    }
    setLocalRole(role);
    wsRef.current?.send(JSON.stringify({ type: "roleSelection", role }));
  };

  const toggleReady = () => {
    const newReadyState = !localReady;
    setLocalReady(newReadyState);
    console.log(`Toggling ready to ${newReadyState} for user ${currentUser?.id}`);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "ready", ready: newReadyState })
      );
    } else {
      console.error("WebSocket is not open, cannot send ready message");
    }
  };

 

  // Manage setup popup visibility and check if debate should start
  useEffect(() => {
    const myTeamReadyCount = isTeam1 ? team1ReadyCount : team2ReadyCount;
    const myTeamTotal = isTeam1 ? team1MembersCount : team2MembersCount;
    const oppTeamReadyCount = isTeam1 ? team2ReadyCount : team1ReadyCount;
    const oppTeamTotal = isTeam1 ? team2MembersCount : team1MembersCount;
    
    const allMyTeamReady = myTeamReadyCount === myTeamTotal && myTeamTotal > 0;
    const allOpponentReady = oppTeamReadyCount === oppTeamTotal && oppTeamTotal > 0;
    const allReady = allMyTeamReady && allOpponentReady;
    
    console.log('Ready check:', {
      myTeamReadyCount,
      myTeamTotal,
      allMyTeamReady,
      oppTeamReadyCount,
      oppTeamTotal,
      allOpponentReady,
      allReady,
      localReady,
      peerReady,
      debatePhase
    });
    
    // CRITICAL: Check if debate has started first - if so, NEVER show popup again
    if (debateStartedRef.current || debatePhase !== DebatePhase.Setup) {
      // Debate has started - don't show popup EVER
      debateStartedRef.current = true;
      setShowSetupPopup(false);
      if (countdown !== null) {
        setCountdown(null);
      }
      return; // Exit early to prevent any other logic from showing popup
    }
    
    // Debate hasn't started yet - manage popup based on ready status
    if (allReady && debatePhase === DebatePhase.Setup) {
      // All ready - close popup and start countdown
      setShowSetupPopup(false);
      if (countdown === null && !countdownCompletedRef.current) {
        console.log('🚀 All teams ready! Starting countdown...');
        setCountdown(3);
        
        // Also notify backend (for synchronization)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: "checkStart" }));
          } catch (error) {
            console.error('Failed to send checkStart:', error);
          }
        }
      }
    } else {
      // Not all ready yet - show popup
      countdownCompletedRef.current = false;
      setShowSetupPopup(true);
      if (countdown !== null) {
        setCountdown(null);
      }
    }
  }, [team1ReadyCount, team2ReadyCount, team1MembersCount, team2MembersCount, isTeam1, countdown, debatePhase]);

  // The backend owns the opening transition; clients only display its countdown.
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      countdownCompletedRef.current = true;
      setCountdown(null);
    }
  }, [countdown]);

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

  // Check for token - if token exists, user is authenticated even if user object isn't loaded yet
  const token = getAuthToken();
  const hasAuthToken = !!token;
  
  // Show loading while debate is loading, or while user is loading (if we have a token)
  if (!debate || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading debate...</p>
        </div>
      </div>
    );
  }
  
  // Only show "not authenticated" if we're sure there's no token
  // Don't block if we have a token - proceed even without user object (user ID will come from token)
  if (!hasAuthToken && !isAuthenticated && !currentUser?.id) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-500 text-lg">User not authenticated</p>
          <p className="text-gray-600 text-sm mt-2">Please log in to join the debate</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4">
      <div className="w-full max-w-6xl mx-auto py-2">
        <div className="bg-gradient-to-r from-orange-100 via-white to-orange-100 rounded-xl p-4 text-center">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 break-words">
            Team Debate: {topic || "No topic set"}
          </h1>
          <p className="mt-2 text-sm text-gray-700 flex flex-wrap justify-center gap-1">
            <span>Phase: <span className="font-medium">{debatePhase}</span> |</span>
            <span>My Team: <span className="font-medium truncate max-w-[100px] inline-block align-bottom">{myTeamName}</span> |</span>
            <span>Opponent: <span className="font-medium truncate max-w-[100px] inline-block align-bottom">{opponentTeamName}</span> |</span>
            <span>Turn:{" "}
            <span className="font-semibold text-orange-600">
              {isMyTurn ? "Your Team" : "Opponent Team"} to{" "}
              {debatePhase.includes("Question")
                ? "ask"
                : debatePhase.includes("Answer")
                ? "answer"
                : "state"}
            </span></span>
          </p>
          <p
            className={`mt-2 text-xs font-medium ${
              isWsConnected ? "text-green-700" : "text-amber-700"
            }`}
            role="status"
            aria-live="polite"
          >
            {isWsConnected ? "Room synchronized" : "Connection interrupted — reconnecting…"}
          </p>
        </div>
      </div>

      {/* Setup Popup */}
      {showSetupPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-2 sm:p-4">
          <div className="bg-card text-foreground p-4 sm:p-6 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl sm:text-2xl font-bold mb-6">Team Debate Setup</h2>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="block text-lg mb-2">Debate Topic</label>
                  <select
                    value={topic}
                    onChange={(e) => handleTopicChange(e)}
                    className="border border-border rounded p-2 w-full bg-input text-foreground mb-2"
                  >
                    <option value="">Select a topic</option>
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

                <div className="mb-6">
                  <div className="text-sm mb-2">
                    Your Team Stance:{" "}
                    <span className="font-medium">
                      {localRole || "Not selected"}
                    </span>
                  </div>
                  <div className="text-sm mb-4">
                    Opponent Team Stance:{" "}
                    <span className="font-medium">
                      {peerRole || "Not selected"}
                    </span>
                  </div>
                  {!localRole && (
                    <div className="flex space-x-2 mb-4">
                      <button
                        onClick={() => handleRoleSelection("for")}
                        className={`px-4 py-2 rounded text-sm border transition ${
                          peerRole !== "for"
                            ? "bg-primary text-primary-foreground border-transparent"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        For
                      </button>
                      <button
                        onClick={() => handleRoleSelection("against")}
                        className={`px-4 py-2 rounded text-sm border transition ${
                          peerRole !== "against"
                            ? "bg-primary text-primary-foreground border-transparent"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        Against
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  {/* Players List - Stacks on mobile */}
                  <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Left Team - My Team */}
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <h3 className="text-sm font-semibold mb-3 text-gray-700 text-center">
                        {myTeamName}
                      </h3>
                      <div className="space-y-3">
                        {myTeamMembers.map((member) => {
                          const isReady =
                            playerReadyStatus.get(member.userId) ?? false;
                          return (
                            <div
                              key={member.userId}
                              className="flex flex-col items-center gap-2 text-center"
                            >
                              <div className="relative">
                                <img
                                  src={
                                    member.avatarUrl ||
                                    `https://api.dicebear.com/9.x/big-ears/svg?seed=${encodeURIComponent(member.userId || member.displayName)}`
                                  }
                                  alt={member.displayName}
                                  onError={(event) => {
                                    const fallbackUrl = `https://api.dicebear.com/9.x/big-ears/svg?seed=${encodeURIComponent(member.userId || member.displayName || "debater")}`;
                                    if (event.currentTarget.src !== fallbackUrl) {
                                      event.currentTarget.src = fallbackUrl;
                                    }
                                  }}
                                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-300"
                                />
                                <div
                                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                                    isReady ? "bg-green-500" : "bg-red-500"
                                  }`}
                                  title={isReady ? "Ready" : "Not Ready"}
                                />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-800">
                                  {member.displayName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {isReady ? "Ready" : "Not Ready"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Team - Opponent Team */}
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <h3 className="text-sm font-semibold mb-3 text-gray-700 text-center">
                        {opponentTeamName}
                      </h3>
                      <div className="space-y-3">
                        {opponentTeamMembers.map((member) => {
                          const isReady =
                            playerReadyStatus.get(member.userId) ?? false;
                          return (
                            <div
                              key={member.userId}
                              className="flex flex-col items-center gap-2 text-center"
                            >
                              <div className="relative">
                                <img
                                  src={
                                    member.avatarUrl ||
                                    `https://api.dicebear.com/9.x/big-ears/svg?seed=${encodeURIComponent(member.userId || member.displayName)}`
                                  }
                                  alt={member.displayName}
                                  onError={(event) => {
                                    const fallbackUrl = `https://api.dicebear.com/9.x/big-ears/svg?seed=${encodeURIComponent(member.userId || member.displayName || "debater")}`;
                                    if (event.currentTarget.src !== fallbackUrl) {
                                      event.currentTarget.src = fallbackUrl;
                                    }
                                  }}
                                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-300"
                                />
                                <div
                                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                                    isReady ? "bg-green-500" : "bg-red-500"
                                  }`}
                                  title={isReady ? "Ready" : "Not Ready"}
                                />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-800">
                                  {member.displayName}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {isReady ? "Ready" : "Not Ready"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={toggleReady}
                    className={`w-full py-2 rounded-lg transition ${
                      localReady
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {localReady ? "Cancel Ready" : "I'm Ready"}
                    {localReady && <span className="ml-2">✓</span>}
                  </Button>
                  <div className="mt-2 text-xs text-center text-gray-500">
                    {countdown !== null && countdown > 0 ? (
                      <span className="text-green-600 font-semibold">
                        Debate starting in {countdown}...
                      </span>
                    ) : team1ReadyCount !== team1MembersCount ||
                      team2ReadyCount !== team2MembersCount ? (
                      <span>Waiting for all team members to be ready...</span>
                    ) : (
                      <span>All teams ready! Debate starting soon...</span>
                    )}
                  </div>
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
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
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
                  Debate status
                </h3>
                <p className="text-gray-700 text-center text-sm">
                  {popup.message}
                </p>
                <div className="flex justify-center mt-4">
                  <Button onClick={() => setPopup({ show: false, message: "" })}>
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Judgment Popup */}
      {showJudgment && judgmentData && (
        <JudgmentPopup
          judgment={judgmentData}
          forRole={localRole === "for" ? "Your Team" : "Opponent Team"}
          againstRole={localRole === "against" ? "Your Team" : "Opponent Team"}
          onClose={() => setShowJudgment(false)}
        />
      )}

      {/* Main Debate Area - Split Screen */}
      <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-4 mt-4">
        {/* My Team Section - Left Side */}
        <div
          className={`relative w-full md:w-1/2 ${
            isMyTurn && debatePhase !== DebatePhase.Finished
              ? "animate-glow"
              : ""
          } bg-white border border-gray-200 shadow-md min-h-[350px] sm:min-h-[450px] md:min-h-[540px] flex flex-col`}
        >
          <div className="p-3 bg-gray-50 border-b">
            <h2 className="text-lg font-bold text-gray-900 text-center break-words">
              {myTeamName}
            </h2>
            <p className="text-xs text-gray-600 text-center">
              Stance: {localRole || "Not selected"}
            </p>
          </div>
          <div className="flex-1 min-h-0 p-4 grid grid-cols-1 sm:grid-cols-2 auto-rows-fr gap-4 overflow-y-auto">
            {myTeamMembers.map((member) => {
              const isCurrentUser = member.userId === currentUser?.id;
              const isActiveSpeaker = activeSpeakerId === member.userId;
              const memberStream = isCurrentUser
                ? localStream
                : remoteStreams.get(member.userId);
              const memberCameraOn = isCurrentUser
                ? isCameraOn &&
                  Boolean(localStream?.getVideoTracks().some((track) => track.enabled))
                : remoteMediaStates.get(member.userId)?.cameraOn ?? true;
              const memberAvatarUrl =
                member.avatarUrl ||
                `https://api.dicebear.com/9.x/big-ears/svg?seed=${encodeURIComponent(member.userId || member.displayName)}`;
              return (
                <div
                  key={member.userId}
                  className={`relative flex h-full min-h-0 flex-col rounded-lg overflow-hidden bg-gray-50 border-2 transition-colors ${
                    isActiveSpeaker
                      ? "border-green-500 ring-2 ring-green-300"
                      : "border-gray-300"
                  }`}
                >
                  <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded flex items-center gap-2">
                    <span>
                      {member.displayName}
                      {isCurrentUser && " (You)"}
                    </span>
                    {isActiveSpeaker && (
                      <span className="flex items-center gap-1 text-green-300">
                        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                        Speaking
                      </span>
                    )}
                    {!isCurrentUser && remoteMediaStates.has(member.userId) && (
                      <span
                        className="flex items-center gap-1"
                        title={
                          remoteMediaStates.get(member.userId)?.microphoneOn
                            ? "Microphone on"
                            : "Microphone off"
                        }
                      >
                        {remoteMediaStates.get(member.userId)?.microphoneOn ? (
                          <Mic className="h-3 w-3 text-green-300" />
                        ) : (
                          <MicOff className="h-3 w-3 text-red-300" />
                        )}
                      </span>
                    )}
                    {isCurrentUser && (
                      <button
                        onClick={toggleCamera}
                        className="ml-2 p-1 rounded bg-white bg-opacity-20 hover:bg-opacity-30 transition"
                        title={
                          isCameraOn ? "Turn camera off" : "Turn camera on"
                        }
                      >
                        {isCameraOn ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="white"
                          >
                            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="white"
                          >
                            <path
                              d="M21 6.5l-4-4v3.5H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h13v3.5l4-4v-11z"
                              fill="white"
                              opacity="0.5"
                            />
                            <line
                              x1="2"
                              y1="2"
                              x2="22"
                              y2="22"
                              stroke="white"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                      </button>
                    )}
                    {isCurrentUser && (
                      <button
                        type="button"
                        onClick={toggleMicrophone}
                        disabled={!canSpeakNow}
                        aria-label={isMicrophoneOn ? "Turn microphone off" : "Turn microphone on"}
                        title={isMicrophoneOn ? "Turn microphone off" : "Turn microphone on"}
                        className={`p-1 rounded transition ${
                          isMicrophoneOn ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                        }`}
                      >
                        {isMicrophoneOn ? (
                          <Mic className="h-4 w-4 text-white" />
                        ) : (
                          <MicOff className="h-4 w-4 text-white" />
                        )}
                      </button>
                    )}
                  </div>
                  {memberStream && memberCameraOn ? (
                    <video
                      ref={(el) => {
                        if (el) {
                          if (isCurrentUser) {
                            localVideoRefs.current.set(member.userId, el);
                            el.srcObject = memberStream;
                          } else {
                            remoteVideoRefs.current.set(member.userId, el);
                            attachStreamToVideo(member.userId, memberStream);
                          }
                        }
                      }}
                      autoPlay
                      muted={isCurrentUser}
                      playsInline
                      className="block flex-1 min-h-0 w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 bg-gray-800 p-4">
                      <img
                        src={memberAvatarUrl}
                        alt={`${member.displayName}'s profile`}
                        onError={(event) => {
                          event.currentTarget.src = `https://api.dicebear.com/9.x/big-ears/svg?seed=${encodeURIComponent(member.userId || "debater")}`;
                        }}
                        className="h-24 w-24 rounded-full border-4 border-white object-cover shadow"
                      />
                      <span className="text-sm text-white">
                        {isCurrentUser
                          ? isCameraOn
                            ? "Camera unavailable"
                            : "Camera off"
                          : remoteMediaStates.has(member.userId)
                            ? memberCameraOn
                              ? "Connecting camera..."
                              : "Camera off"
                            : "Not connected"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="p-3 bg-gray-50 border-t">
            <p className="text-xs text-center text-gray-600">
              Time:{" "}
              {formatTime(isMyTurn ? timer : phaseDurations[debatePhase] || 0)}
            </p>
            {currentUser &&
              myTeamMembers.some((member) => member.userId === currentUser.id) && (
                <div className="mt-2 flex flex-col items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => void toggleMicrophone()}
                    variant={isMicrophoneOn ? "destructive" : "default"}
                    size="sm"
                    disabled={!canSpeakNow}
                    className="px-4"
                  >
                    {isMicrophoneOn ? "Stop Speaking" : "Start Speaking"}
                  </Button>
                  <p className="text-sm text-center text-gray-600">
                    {isMicrophoneOn
                      ? "Microphone and automatic transcript capture are active."
                      : canSpeakNow
                        ? "Click start when you're ready to speak."
                        : debatePhase === DebatePhase.Setup ||
                            debatePhase === DebatePhase.Finished
                          ? "Speaking is unavailable outside debate turns."
                          : "Auto-muted while the opponent is speaking."}
                  </p>
                </div>
              )}
            {isMyTurn &&
              debatePhase !== DebatePhase.Setup &&
              debatePhase !== DebatePhase.Finished && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-600">
                    {isMicrophoneOn
                      ? isListening
                        ? "Speaking — transcript capture active"
                        : "Speaking — starting transcript capture"
                      : "Muted — start when you're ready"}
                  </span>
                </div>
              )}
            {/* Camera Toggle Button - Only show for current user's team */}
            {currentUser &&
              myTeamMembers.some((m) => m.userId === currentUser.id) && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                  <button
                    onClick={toggleCamera}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      isCameraOn
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-400 text-white hover:bg-gray-500"
                    }`}
                    title={isCameraOn ? "Turn camera off" : "Turn camera on"}
                  >
                    <span className="flex items-center gap-1.5">
                      {isCameraOn ? (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
                          </svg>
                          Camera On
                        </>
                      ) : (
                        <>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
                            <line
                              x1="2"
                              y1="2"
                              x2="22"
                              y2="22"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                          Camera Off
                        </>
                      )}
                    </span>
                  </button>
                </div>
              )}
          </div>
        </div>

        {/* Opponent Team Section - Right Side */}
        <div
          className={`relative w-full md:w-1/2 ${
            !isMyTurn && debatePhase !== DebatePhase.Finished
              ? "animate-glow"
              : ""
          } bg-white border border-gray-200 shadow-md min-h-[350px] sm:min-h-[450px] md:min-h-[540px] flex flex-col`}
        >
          <div className="p-3 bg-gray-50 border-b">
            <h2 className="text-lg font-bold text-gray-900 text-center break-words">
              {opponentTeamName}
            </h2>
            <p className="text-xs text-gray-600 text-center">
              Stance: {peerRole || "Not selected"}
            </p>
          </div>
          <div className="flex-1 min-h-0 p-4 grid grid-cols-1 sm:grid-cols-2 auto-rows-fr gap-4 overflow-y-auto">
            {opponentTeamMembers.map((member) => {
              const isActiveSpeaker = activeSpeakerId === member.userId;
              const remoteStream = remoteStreams.get(member.userId);
              const cameraOn =
                remoteMediaStates.get(member.userId)?.cameraOn ?? true;
              const avatarUrl =
                member.avatarUrl ||
                `https://api.dicebear.com/9.x/big-ears/svg?seed=${encodeURIComponent(member.userId || member.displayName)}`;
              return (
              <div
                key={member.userId}
                className={`relative flex h-full min-h-0 flex-col rounded-lg overflow-hidden bg-gray-50 border-2 transition-colors ${
                  isActiveSpeaker
                    ? "border-green-500 ring-2 ring-green-300"
                    : "border-gray-300"
                }`}
              >
                <div className="absolute top-2 left-2 right-2 z-10 flex items-start justify-between gap-2">
                  <span className="bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  {member.displayName}
                  </span>
                  {isActiveSpeaker && (
                    <span className="flex items-center gap-1 bg-green-600 text-white text-xs px-2 py-1 rounded">
                      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                      Speaking
                    </span>
                  )}
                  {remoteMediaStates.has(member.userId) && (
                    <span
                      className="rounded bg-black bg-opacity-60 p-1"
                      title={
                        remoteMediaStates.get(member.userId)?.microphoneOn
                          ? "Microphone on"
                          : "Microphone off"
                      }
                    >
                      {remoteMediaStates.get(member.userId)?.microphoneOn ? (
                        <Mic className="h-3 w-3 text-green-300" />
                      ) : (
                        <MicOff className="h-3 w-3 text-red-300" />
                      )}
                    </span>
                  )}
                  <img
                    src={avatarUrl}
                    alt={`${member.displayName}'s profile`}
                    onError={(event) => {
                      event.currentTarget.src = `https://api.dicebear.com/9.x/big-ears/svg?seed=${encodeURIComponent(member.userId || "debater")}`;
                    }}
                    className="h-8 w-8 rounded-full border-2 border-white object-cover shadow"
                  />
                </div>
                {remoteStream && cameraOn ? (
                  <video
                    ref={(el) => {
                      if (el) {
                        remoteVideoRefs.current.set(member.userId, el);
                        attachStreamToVideo(member.userId, remoteStream);
                      }
                    }}
                    autoPlay
                    playsInline
                    className="block flex-1 min-h-0 w-full object-cover bg-gray-200"
                  />
                ) : (
                  <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 bg-gray-100 p-4">
                    <img
                      src={avatarUrl}
                      alt={`${member.displayName}'s profile`}
                      onError={(event) => {
                        event.currentTarget.src = `https://api.dicebear.com/9.x/big-ears/svg?seed=${encodeURIComponent(member.userId || "debater")}`;
                      }}
                      className="h-24 w-24 rounded-full border-4 border-white object-cover shadow"
                    />
                    <span className="text-sm text-gray-600">
                      {remoteMediaStates.has(member.userId)
                        ? cameraOn
                          ? "Connecting camera..."
                          : "Camera off"
                        : "Not connected"}
                    </span>
                  </div>
                )}
              </div>
              );
            })}
          </div>
          <div className="p-3 bg-gray-50 border-t">
            <p className="text-xs text-center text-gray-600">
              Time:{" "}
              {formatTime(!isMyTurn ? timer : phaseDurations[debatePhase] || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Speech Transcripts Section */}
      {debatePhase !== DebatePhase.Setup && (
        <div className="w-full max-w-6xl mx-auto mt-4">
          <SpeechTranscripts
            transcripts={speechTranscripts}
            currentPhase={debatePhase}
          />
        </div>
      )}

      {/* Media / Speech Error Display */}
      {mediaError && (
        <p className="text-red-500 mt-4 text-center max-w-6xl mx-auto">
          {mediaError}
        </p>
      )}
      {speechError && (
        <p className="text-amber-600 mt-2 text-center max-w-6xl mx-auto">
          {speechError}
        </p>
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

export default TeamDebateRoom;
