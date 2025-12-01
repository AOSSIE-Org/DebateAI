import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useAtom } from "jotai";
import { userAtom } from "@/state/userAtom";
import { useUser } from "@/hooks/useUser";
import { getTeamDebate } from "@/services/teamDebateService";
import { Button } from "@/components/ui/button";
import JudgmentPopup from "@/components/JudgementPopup";
import SpeechTranscripts from "@/components/SpeechTranscripts";
import { getAuthToken } from "@/utils/auth";

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
  userId?: string;
  username?: string;
  timestamp?: number;
  mode?: "type" | "speak";
  isTyping?: boolean;
  isSpeaking?: boolean;
  partialText?: string;
  isMuted?: boolean;
  currentTurn?: string;
  speechText?: string;
  liveTranscript?: string;
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
  
  // Debug: Log user state
  useEffect(() => {
    console.debug('TeamDebateRoom user state', {
      userFromAtom: user?.id,
      userFromHook: userFromHook?.id,
      currentUser: currentUser?.id,
      isUserLoading,
      isAuthenticated,
      hasToken: !!getAuthToken(),
    });
  }, [user?.id, userFromHook?.id, currentUser?.id, isUserLoading, isAuthenticated]);

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

  // Refs for WebSocket, PeerConnections, and media elements
  const wsRef = useRef<WebSocket | null>(null);
  const pcRefs = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const debateStartedRef = useRef<boolean>(false); // Track if debate has started to prevent popup reopening

  // State for media streams
  const [, setLocalStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  let toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
    setIsCameraOn((prev) => !prev);
  }, []);

  // Refs mirroring frequently used reactive state inside WebSocket handlers
  const isTeam1Ref = useRef(isTeam1);
  useEffect(() => {
    isTeam1Ref.current = isTeam1;
  }, [isTeam1]);

  const myTeamIdRef = useRef<string | null>(myTeamId);
  useEffect(() => {
    myTeamIdRef.current = myTeamId;
  }, [myTeamId]);

  const debatePhaseRef = useRef<DebatePhase>(debatePhase);
  useEffect(() => {
    debatePhaseRef.current = debatePhase;
  }, [debatePhase]);

  const currentUserIdRef = useRef<string | undefined>(currentUser?.id);
  useEffect(() => {
    currentUserIdRef.current = currentUser?.id;
  }, [currentUser?.id]);

  // Timer state
  const [timer, setTimer] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Speech recognition state
  const [isListening, setIsListening] = useState(false);
  const [, setCurrentTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [, setSpeechError] = useState<string | null>(null);
  const [speechTranscripts, setSpeechTranscripts] = useState<{
    [key: string]: string;
  }>({});

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

  // Determine if it's the local team's turn to speak
  const isMyTurn = React.useMemo(() => {
    if (!localRole || !debatePhase) return false;
    
    const isForPhase = debatePhase.includes("For");
    const isAgainstPhase = debatePhase.includes("Against");
    
    if (isForPhase && localRole === "for") return true;
    if (isAgainstPhase && localRole === "against") return true;
    return false;
  }, [debatePhase, localRole]);

  // Fetch debate details - proceed if we have debateId and either user or token
  useEffect(() => {
    const fetchDebate = async () => {
      const token = getAuthToken();
      
      // Allow proceeding if we have a token, even if user isn't fully loaded yet
      // The debate API will use the token for authentication
      if (!debateId || (!token && !currentUser?.id)) {
        console.debug('Skipping team debate fetch', {
          debateId,
          userId: currentUser?.id,
          hasToken: !!token,
          isUserLoading,
          userFromAtom: user?.id,
          userFromHook: userFromHook?.id,
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

        console.debug('Resolved team membership info', {
          userId,
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
        } else {
        }

        setIsLoading(false);
      } catch (error) {
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
            if (isMyTurn && localRole) {
              // Save any existing transcript for this phase
              const existingTranscript =
                speechTranscripts[debatePhase] || "No response";
              localStorage.setItem(
                `${debateId}_${debatePhase}_${localRole}`,
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
  }, [timer, debatePhase, isMyTurn, speechTranscripts, localRole, debateId]);

  // Initialize WebSocket connection - only need token and debateId
  // User ID will be extracted from token on backend
  useEffect(() => {
    const token = getAuthToken();
    if (!token || !debateId) {
      console.debug('Skipping team debate websocket setup', {
        hasToken: !!token,
        debateId,
      });
      return;
    }

    console.debug('Opening team debate websocket', {
      debateId,
      userId: currentUser?.id,
    });

    const ws = new WebSocket(
      `ws://localhost:1313/ws/team?debateId=${debateId}&token=${token}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join" }));
      getMedia();
    };

    ws.onmessage = async (event) => {
      const data: WSMessage = JSON.parse(event.data);
      const amTeam1 = isTeam1Ref.current;
      const currentMyTeamId = myTeamIdRef.current;
      const currentUserId = currentUserIdRef.current;
      const currentPhase = debatePhaseRef.current;

      switch (data.type) {
        case "stateSync":
          // Sync all state when joining or receiving state update
          if (data.topic !== undefined) setTopic(data.topic);
          // CRITICAL: Only sync phase if debate hasn't started, or if backend phase is ahead
          if (data.phase) {
            const backendPhase = data.phase as DebatePhase;
            // Don't allow stateSync to reset phase back to Setup if debate has started
            if (debateStartedRef.current && backendPhase === DebatePhase.Setup) {
            } else {
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
        case "teamMembers":
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
        case "topicChange":
          if (data.topic !== undefined) setTopic(data.topic);
          break;
        case "roleSelection":
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
            } else {
              // This role selection is from opponent team
              setPeerRole(data.role as DebateRole);
            }
          }
          break;
        case "countdownStart":
          // Backend is starting countdown - show it to all users
          const countdownValue = (data as any).countdown || 3;
          setCountdown(countdownValue);
          // Hide setup popup when countdown starts
          setShowSetupPopup(false);
          break;
        case "checkStart":
          // Ignore checkStart messages from backend (we shouldn't receive them)
          // This is sent by frontend to backend, not the other way around
          break;
        case "ready":
          
          // CRITICAL: Verify the ready status is assigned to the correct team
          const messageTeamId = data.teamId;
          const expectedTeamId = currentMyTeamId; // Should be the same regardless of isTeam1
          const assignedTeam = (data as any).assignedToTeam;
          
          // Update the ready status for the specific user who clicked
          if (data.userId === currentUserId && data.ready !== undefined) {
            // Verify team assignment matches
            if (assignedTeam && assignedTeam !== (amTeam1 ? "Team1" : "Team2")) {
              console.error(
                `Ready status assigned to unexpected team`,
                { userId: data.userId, expected: amTeam1 ? "Team1" : "Team2", assignedTeam }
              );
            } else if (messageTeamId && expectedTeamId && messageTeamId !== expectedTeamId) {
            } else {
              setLocalReady(data.ready);
            }
          }
          
          // Update individual player ready status
          if (data.userId && data.ready !== undefined) {
            setPlayerReadyStatus(prev => new Map(prev).set(data.userId!, data.ready!));
          }
          
          // Update team ready counts - these are the ACTUAL counts from backend
          if (data.team1Ready !== undefined) {
            setTeam1ReadyCount(data.team1Ready);
          }
          if (data.team2Ready !== undefined) {
            setTeam2ReadyCount(data.team2Ready);
          }
          // CRITICAL: Update member counts from ready message
          // Check both direct access and through (data as any) to handle type issues
          const team1Count = data.team1MembersCount ?? (data as any).team1MembersCount;
          const team2Count = data.team2MembersCount ?? (data as any).team2MembersCount;
          
          if (team1Count !== undefined && team1Count !== null) {
            setTeam1MembersCount(team1Count);
          } else {
          }
          if (team2Count !== undefined && team2Count !== null) {
            setTeam2MembersCount(team2Count);
          } else {
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
          // Validation: Ensure we're showing the right team
          if (data.userId === currentUserId && assignedTeam) {
            const expectedTeamForUser = amTeam1 ? "Team1" : "Team2";
            if (assignedTeam !== expectedTeamForUser) {
            } else {
            }
          }
          
          // Update peer ready status (whether all opponent team members are ready)
          const allOppReady = oppReadyCount === oppTeamTotal && oppTeamTotal > 0;
          setPeerReady(allOppReady);
          break;
        case "phaseChange":
          if (data.phase) {
            const newPhase = data.phase as DebatePhase;
            
            // Ensure we accept the phase change
            setDebatePhase(newPhase);
            
            // Close setup popup and clear countdown when debate starts (ALWAYS if not setup)
            if (newPhase !== DebatePhase.Setup) {
              debateStartedRef.current = true; // Mark debate as started - prevent popup from reopening
              setShowSetupPopup(false);
              setCountdown(null);
            } else {
            }
          } else {
          }
          break;
        case "speechText":
          if (data.userId && data.speechText) {
            const targetPhase = data.phase || currentPhase;
            setSpeechTranscripts((prev) => ({
            ...prev,
              [targetPhase]:
                (prev[targetPhase] || "") + " " + data.speechText,
            }));
          }
          break;
        case "liveTranscript":
          if (
            data.userId &&
            data.liveTranscript &&
            data.userId !== currentUserId
          ) {
            setCurrentTranscript(data.liveTranscript);
          }
          break;
        case "teamStatus":
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
        case "offer":
          // Handle WebRTC offer
          break;
        case "answer":
          // Handle WebRTC answer
          break;
        case "candidate":
          // Handle WebRTC ICE candidate
          break;
      }
    };


    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true,
        });
        setLocalStream(stream);
        localStreamRef.current = stream;
        
        // Attach local stream to video element
        const localVideo = localVideoRefs.current.get(
          currentUserIdRef.current || ""
        );
        if (localVideo) {
          localVideo.srcObject = stream;
        }
      } catch (err) {
        setMediaError(
          "Failed to access camera/microphone. Please check permissions."
        );
      }
    };

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      pcRefs.current.forEach((pc) => pc.close());
    };
  }, [debateId, currentUser?.id]);

  // Initialize Speech Recognition
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

        recognition.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
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
            setSpeechTranscripts((prev) => ({
              ...prev,
              [debatePhase]: (
                (prev[debatePhase] || "") + " " + finalTranscript
              ).trim(),
            }));
            setCurrentTranscript("");

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
          if (
            isMyTurn &&
            debatePhase !== DebatePhase.Setup &&
            debatePhase !== DebatePhase.Finished
          ) {
            setTimeout(() => {
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.start();
      } catch (error) {
                }
              }
            }, 100);
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
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
  }, [debatePhase, isMyTurn, currentUser?.id, currentUser?.displayName]);

  // Start/stop speech recognition based on turn
  const startSpeechRecognition = useCallback(() => {
    if (
      !recognitionRef.current ||
      isListening ||
      debatePhase === DebatePhase.Setup ||
      debatePhase === DebatePhase.Finished
    ) {
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
    }
  }, [isListening, debatePhase]);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
      }
    }
  }, [isListening]);

   toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      console.warn("[TeamDebateRoom] toggleCamera called without local stream");
      return;
    }

    const [videoTrack] = stream.getVideoTracks();
    if (!videoTrack) {
      console.warn("[TeamDebateRoom] No video track available to toggle");
      return;
    }

    setIsCameraOn((prev) => {
      const next = !prev;
      videoTrack.enabled = next;
      return next;
    });
  }, []);

  // Auto start/stop speech recognition based on turn
  useEffect(() => {
    if (
      isMyTurn &&
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
    debatePhase,
    startSpeechRecognition,
    stopSpeechRecognition,
  ]);

  // Handle phase completion
  const handlePhaseDone = () => {
    const currentIndex = phaseOrder.indexOf(debatePhase);
    if (currentIndex >= 0 && currentIndex < phaseOrder.length - 1) {
      const nextPhase = phaseOrder[currentIndex + 1];
      setDebatePhase(nextPhase);
      wsRef.current?.send(
        JSON.stringify({ type: "phaseChange", phase: nextPhase })
      );
    } else {
      setDebatePhase(DebatePhase.Finished);
      logMessageHistory();
    }
  };

  // Log message history and send to backend (same as OnlineDebateRoom)
  const logMessageHistory = async () => {
    if (!localRole || !debateId) return;

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
      const transcript =
        localStorage.getItem(`${debateId}_${phase}_${localRole}`) ||
        speechTranscripts[phase] ||
        "No response";
      debateTranscripts[phase] = transcript;
    });

    setPopup({
      show: true,
      message: "Submitting transcripts and awaiting judgment...",
      isJudging: true,
    });

    try {
      const token = getAuthToken();
      const response = await fetch(`http://localhost:1313/submit-transcripts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId: debateId,
          role: localRole,
          transcripts: debateTranscripts,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.message === "Debate judged" || result.message === "Debate already judged") {
          const jsonString = extractJSON(result.result);
          const judgment: JudgmentData = JSON.parse(jsonString);
          setJudgmentData(judgment);
          setPopup({ show: false, message: "" });
          setShowJudgment(true);
        }
      }
    } catch (error) {
      setPopup({
        show: false,
        message: "Error occurred while judging. Please try again.",
      });
    }
  };

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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "ready", ready: newReadyState })
      );
    } else {
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

    console.log("Setup popup state:", {
      myTeamReadyCount,
      myTeamTotal,
      allMyTeamReady,
      oppTeamReadyCount,
      oppTeamTotal,
      allOpponentReady,
      allReady,
      localReady,
      peerReady,
      debatePhase,
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
      if (countdown === null) {
        setCountdown(3);
        
        // Also notify backend (for synchronization)
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({ type: "checkStart" }));
          } catch (error) {
          }
        }
      }
    } else {
      // Not all ready yet - show popup
      setShowSetupPopup(true);
      if (countdown !== null) {
        setCountdown(null);
      }
    }
  }, [team1ReadyCount, team2ReadyCount, team1MembersCount, team2MembersCount, isTeam1, countdown, debatePhase]);

  // Countdown logic - when countdown reaches 0, start the debate (like OnlineDebateRoom)
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      // Countdown finished - start the debate by transitioning to OpeningFor
      
      // Mark debate as started FIRST to prevent popup from reopening
      debateStartedRef.current = true;
      // Close popup FIRST before phase change
      setShowSetupPopup(false);
      setCountdown(null);
      
      // Change phase to OpeningFor
      const newPhase = DebatePhase.OpeningFor;
      setDebatePhase(newPhase);
      
      // Send phase change to backend
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const phaseChangeMessage = JSON.stringify({ type: "phaseChange", phase: DebatePhase.OpeningFor });
        wsRef.current.send(phaseChangeMessage);
      } else {
      }
      
      // Note: debatePhase state won't update immediately due to React batching
      // The phase change handler will receive the backend's phase change message
      // which will update the phase correctly
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
  
  // Debug: Log user state for troubleshooting
  useEffect(() => {
    if (hasAuthToken && !currentUser?.id) {
      console.log("Auth state while loading user:", {
        hasToken: hasAuthToken,
        currentUser,
        userFromAtom: user,
        userFromHook,
        isUserLoading,
        isAuthenticated,
      });
    }
  }, [hasAuthToken, currentUser, user, userFromHook, isUserLoading, isAuthenticated]);
  
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
          <h1 className="text-3xl font-bold text-gray-900">
            Team Debate: {topic || "No topic set"}
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Phase: <span className="font-medium">{debatePhase}</span> |
            My Team: <span className="font-medium">{myTeamName}</span> |
            Opponent: <span className="font-medium">{opponentTeamName}</span> |
            Current Turn:{" "}
            <span className="font-semibold text-orange-600">
              {isMyTurn ? "Your Team" : "Opponent Team"} to{" "}
              {debatePhase.includes("Question")
                ? "ask a question"
                : debatePhase.includes("Answer")
                ? "answer"
                : "make a statement"}
            </span>
          </p>
            </div>
      </div>

      {/* Setup Popup */}
      {showSetupPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-card text-foreground p-6 rounded-lg shadow-lg max-w-4xl w-full">
            <h2 className="text-2xl font-bold mb-6">Team Debate Setup</h2>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-primary"></div>
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading...
                </span>
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
                  {/* Players List - Side by Side */}
                  <div className="mb-6 grid grid-cols-2 gap-4">
                    {/* Left Team - My Team */}
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <h3 className="text-sm font-semibold mb-3 text-gray-700">
                        {myTeamName}
                      </h3>
                      <div className="space-y-3">
                        {myTeamMembers.map((member) => {
                          const isReady = playerReadyStatus.get(member.userId) ?? false;
                          return (
                            <div key={member.userId} className="flex items-center gap-3">
                              <div className="relative">
                                <img
                                  src={member.avatarUrl || "https://avatar.iran.liara.run/public/31"}
                                  alt={member.displayName}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
                                />
                                <div
                                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                                    isReady ? "bg-green-500" : "bg-red-500"
                                  }`}
                                  title={isReady ? "Ready" : "Not Ready"}
                                />
                              </div>
                              <div className="flex-1">
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
                      <h3 className="text-sm font-semibold mb-3 text-gray-700">
                        {opponentTeamName}
                      </h3>
                      <div className="space-y-3">
                        {opponentTeamMembers.map((member) => {
                          const isReady = playerReadyStatus.get(member.userId) ?? false;
                          return (
                            <div key={member.userId} className="flex items-center gap-3">
                              <div className="relative">
                                <img
                                  src={member.avatarUrl || "https://avatar.iran.liara.run/public/31"}
                                  alt={member.displayName}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
                                />
                                <div
                                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                                    isReady ? "bg-green-500" : "bg-red-500"
                                  }`}
                                  title={isReady ? "Ready" : "Not Ready"}
                                />
                              </div>
                              <div className="flex-1">
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
                    ) : team1ReadyCount !== team1MembersCount || team2ReadyCount !== team2MembersCount ? (
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
          forRole={localRole === "for" ? "Your Team" : "Opponent Team"}
          againstRole={localRole === "against" ? "Your Team" : "Opponent Team"}
          localRole={localRole ?? null}
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
          } bg-white border border-gray-200 shadow-md min-h-[540px] flex flex-col`}
        >
          <div className="p-3 bg-gray-50 border-b">
            <h2 className="text-lg font-bold text-gray-900 text-center">
              {myTeamName}
            </h2>
            <p className="text-xs text-gray-600 text-center">
              Stance: {localRole || "Not selected"}
            </p>
          </div>
          <div className="flex-1 p-4 grid grid-cols-1 gap-4 overflow-y-auto">
            {myTeamMembers.map((member) => {
              const isCurrentUser = member.userId === currentUser?.id;
              return (
                <div
                  key={member.userId}
                  className="relative border border-gray-300 rounded-lg overflow-hidden bg-gray-50"
                >
                  <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded flex items-center gap-2">
                    <span>
                      {member.displayName}
                      {isCurrentUser && " (You)"}
                    </span>
                    {isCurrentUser && (
                      <button
                        onClick={toggleCamera}
                        className="ml-2 p-1 rounded bg-white bg-opacity-20 hover:bg-opacity-30 transition"
                        title={isCameraOn ? "Turn camera off" : "Turn camera on"}
                      >
                        {isCameraOn ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="white">
                            <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="white">
                            <path d="M21 6.5l-4-4v3.5H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h13v3.5l4-4v-11z" fill="white" opacity="0.5"/>
                            <line x1="2" y1="2" x2="22" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {isCurrentUser && !isCameraOn ? (
                    <div className="w-full h-48 bg-gray-800 flex items-center justify-center">
                      <div className="text-center text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
                        </svg>
                        <p className="text-sm">Camera Off</p>
                      </div>
                    </div>
                  ) : (
                    <video
                      ref={(el) => {
                        if (el) {
                          if (isCurrentUser) {
                            localVideoRefs.current.set(member.userId, el);
                            if (localStreamRef.current) {
                              el.srcObject = localStreamRef.current;
                            }
                          } else {
                            remoteVideoRefs.current.set(member.userId, el);
                          }
                        }
                      }}
                      autoPlay
                      muted={isCurrentUser}
                      playsInline
                      className="w-full h-48 object-cover"
                      style={{ display: isCurrentUser && !isCameraOn ? 'none' : 'block' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="p-3 bg-gray-50 border-t">
            <p className="text-xs text-center text-gray-600">
              Time: {formatTime(isMyTurn ? timer : phaseDurations[debatePhase] || 0)}
            </p>
            {isMyTurn && debatePhase !== DebatePhase.Setup && debatePhase !== DebatePhase.Finished && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600">
                  {isListening ? "Recording & Speech Recognition Active" : "Waiting..."}
                </span>
              </div>
            )}
            {/* Camera Toggle Button - Only show for current user's team */}
            {currentUser && myTeamMembers.some(m => m.userId === currentUser.id) && (
              <div className="flex items-center justify-center gap-2 mt-2">
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
                        </svg>
                        Camera On
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
                          <line x1="2" y1="2" x2="22" y2="22" strokeWidth="2" strokeLinecap="round"/>
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
          } bg-white border border-gray-200 shadow-md min-h-[540px] flex flex-col`}
        >
          <div className="p-3 bg-gray-50 border-b">
            <h2 className="text-lg font-bold text-gray-900 text-center">
              {opponentTeamName}
            </h2>
            <p className="text-xs text-gray-600 text-center">
              Stance: {peerRole || "Not selected"}
            </p>
          </div>
          <div className="flex-1 p-4 grid grid-cols-1 gap-4 overflow-y-auto">
            {opponentTeamMembers.map((member) => (
              <div
                key={member.userId}
                className="relative border border-gray-300 rounded-lg overflow-hidden bg-gray-50"
              >
                <div className="absolute top-2 left-2 z-10 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  {member.displayName}
                </div>
                <video
                  ref={(el) => {
                    if (el) {
                      remoteVideoRefs.current.set(member.userId, el);
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-48 object-cover bg-gray-200"
                />
              </div>
            ))}
          </div>
          <div className="p-3 bg-gray-50 border-t">
            <p className="text-xs text-center text-gray-600">
              Time: {formatTime(!isMyTurn ? timer : phaseDurations[debatePhase] || 0)}
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

      {/* Media Error Display */}
      {mediaError && (
        <p className="text-red-500 mt-4 text-center max-w-6xl mx-auto">
          {mediaError}
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
