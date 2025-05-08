import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import JudgmentPopup from '@/components/JudgementPopup';

// Utility function to get authentication token
const getAuthToken = (): string => {
  return localStorage.getItem('token') || '';
};

// Define debate phases as an enum
enum DebatePhase {
  Setup = 'setup',
  OpeningFor = 'openingFor',
  OpeningAgainst = 'openingAgainst',
  CrossForQuestion = 'crossForQuestion',
  CrossAgainstAnswer = 'crossAgainstAnswer',
  CrossAgainstQuestion = 'crossAgainstQuestion',
  CrossForAnswer = 'crossForAnswer',
  ClosingFor = 'closingFor',
  ClosingAgainst = 'closingAgainst',
  Finished = 'finished',
}

// Define debate roles
type DebateRole = 'for' | 'against';

type JudgmentData = {
  opening_statement: { for: { score: number; reason: string }; against: { score: number; reason: string } };
  cross_examination_questions: { for: { score: number; reason: string }; against: { score: number; reason: string } };
  cross_examination_answers: { for: { score: number; reason: string }; against: { score: number; reason: string } };
  closing: { for: { score: number; reason: string }; against: { score: number; reason: string } };
  total: { for: number; against: number };
  verdict: { winner: string; reason: string; congratulations: string; opponent_analysis: string };
};

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
}

// Define message structure
type Message = { sender: DebateRole; text: string; phase: DebatePhase };

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

const localAvatar = localStorage.getItem('userAvatar') || 'https://avatar.iran.liara.run/public/40'; // Default fallback
const opponentAvatar = localStorage.getItem('opponentAvatar') || 'https://avatar.iran.liara.run/public/31'; // Default fallback

// Function to extract JSON from response
const extractJSON = (response: string): string => {
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = fenceRegex.exec(response);
  if (match && match[1]) return match[1].trim();
  return response;
};

const OnlineDebateRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();

  // Refs for WebSocket, PeerConnection, and media elements
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // State for debate setup and signaling
  const [topic, setTopic] = useState('');
  const [localRole, setLocalRole] = useState<DebateRole | null>(null);
  const [peerRole, setPeerRole] = useState<DebateRole | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [peerReady, setPeerReady] = useState(false);
  const [debatePhase, setDebatePhase] = useState<DebatePhase>(DebatePhase.Setup);

  // State for media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Timer state
  const [timer, setTimer] = useState<number>(0);

  // Speech recognition and transcript state
  const [messages, setMessages] = useState<Message[]>([]);
  const [finalInput, setFinalInput] = useState('');
  const [interimInput, setInterimInput] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);

  // Popup and countdown state
  const [showSetupPopup, setShowSetupPopup] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Phase-wise transcripts
  const [transcripts, setTranscripts] = useState<{
    [key in DebatePhase]?: { [key in DebateRole]?: string };
  }>({});

  // Judgment states
  const [popup, setPopup] = useState<{ show: boolean; message: string; isJudging?: boolean }>({ show: false, message: "" });
  const [judgmentData, setJudgmentData] = useState<JudgmentData | null>(null);
  const [showJudgment, setShowJudgment] = useState(false);

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

  // Determine if it's the local user's turn to speak
  const isMyTurn = localRole === (debatePhase.includes('For') ? 'for' : debatePhase.includes('Against') ? 'against' : null);

  // Function to send transcripts to backend
  const sendTranscriptsToBackend = async (roomId: string, role: DebateRole, transcripts: { [key in DebatePhase]?: string }) => {
    const token = getAuthToken();
    console.log("-----------------------------------------------------------------------");
    console.log(`Attempting to send transcripts for role: ${role}`, { roomId, transcripts });
    try {
      const response = await fetch(`http://localhost:1313/api/submit-transcripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          roomId,
          role,
          transcripts,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to send transcripts: ${response.status} ${response.statusText}`);
      }
      const result = await response.json();
      console.log(`Response from backend for ${role}:`, result);

      if (result.message === "Waiting for opponent submission") {
        // Poll for the result periodically until judgment is available
        const pollResult = async () => {
          const pollInterval = setInterval(async () => {
            const pollResponse = await fetch(`http://localhost:1313/api/submit-transcripts`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ roomId, role, transcripts: {} }), // Empty transcripts to just check result
            });
            const pollData = await pollResponse.json();
            if (pollData.message === "Debate judged" || pollData.message === "Debate already judged") {
              clearInterval(pollInterval);
              const jsonString = extractJSON(pollData.result);
              const judgment: JudgmentData = JSON.parse(jsonString);
              setJudgmentData(judgment);
              setPopup({ show: false, message: "" });
              setShowJudgment(true);
            }
          }, 2000); // Poll every 2 seconds
        };
        pollResult();
        return null; // Return null to indicate waiting
      } else if (result.message === "Debate judged" || result.message === "Debate already judged") {
        const jsonString = extractJSON(result.result);
        const judgment: JudgmentData = JSON.parse(jsonString);
        return judgment;
      }
    } catch (error) {
      console.error(`Error submitting transcripts for ${role}:`, error);
      throw error;
    }
  };

  // Log message history, collect transcripts, and send to backend
  const logMessageHistory = async () => {
    if (!localRole) {
      console.log("Cannot log message history: localRole is not defined yet.");
      setPopup({ show: true, message: "Please select a role before the debate ends.", isJudging: false });
      return;
    }

    console.log(`logMessageHistory called for role: ${localRole}`);
    console.log('Debate Message History:');
    const debateTranscripts: { [key in DebatePhase]?: string } = {};

    const phasesForRole = localRole === 'for'
      ? [DebatePhase.OpeningFor, DebatePhase.CrossForQuestion, DebatePhase.CrossForAnswer, DebatePhase.ClosingFor]
      : [DebatePhase.OpeningAgainst, DebatePhase.CrossAgainstAnswer, DebatePhase.CrossAgainstQuestion, DebatePhase.ClosingAgainst];

    phasesForRole.forEach((phase) => {
      const transcript = localStorage.getItem(`${roomId}_${phase}_${localRole}`) || 'No response';
      debateTranscripts[phase] = transcript;
    });
    console.log(`Collected transcripts for ${localRole}:`, debateTranscripts);

    setPopup({ show: true, message: "Submitting transcripts and awaiting judgment...", isJudging: true });

    if (roomId && localRole) {
      try {
        console.log(`Sending transcripts to backend for ${localRole}`);
        const judgment = await sendTranscriptsToBackend(roomId, localRole, debateTranscripts);
        if (judgment) {
          setJudgmentData(judgment);
          setPopup({ show: false, message: "" });
          setShowJudgment(true);
        } // If null, polling is already handling the wait
      } catch (error) {
        console.error(`Failed to send transcripts to backend for ${localRole}:`, error);
        setPopup({ show: false, message: "Error occurred while judging. Please try again." });
      }
    } else {
      console.log(`Cannot send transcripts. roomId: ${roomId}, localRole: ${localRole}`);
      setPopup({ show: false, message: "" });
    }
  };

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
            if (isMyTurn && localRole) { // Added localRole check
              const transcriptToSave = finalInput.trim() || 'No response';
              setTranscripts((prev) => {
                const phaseTranscripts = prev[debatePhase] || {};
                const roleTranscripts = phaseTranscripts[localRole] || '';
                return {
                  ...prev,
                  [debatePhase]: {
                    ...phaseTranscripts,
                    [localRole]: roleTranscripts + ' ' + transcriptToSave,
                  },
                };
              });
              localStorage.setItem(`${roomId}_${debatePhase}_${localRole}`, transcriptToSave);
              console.log(`Timer expired for ${localRole} in ${debatePhase}. Transcript saved:`, transcriptToSave);
              if (finalInput.trim()) {
                sendMessage();
              }
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
  }, [timer, debatePhase, isMyTurn, finalInput, localRole, roomId]);

  // Initialize WebSocket, RTCPeerConnection, and media
  useEffect(() => {
    const token = getAuthToken();
    if (!token || !roomId) return;

    const ws = new WebSocket(`ws://localhost:1313/ws?room=${roomId}&token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      ws.send(JSON.stringify({ type: 'join', room: roomId }));
      getMedia();
    };

    ws.onmessage = async (event) => {
      const data: WSMessage = JSON.parse(event.data);
      switch (data.type) {
        case 'topicChange':
          if (data.topic !== undefined) setTopic(data.topic);
          break;
        case 'roleSelection':
          if (data.role) setPeerRole(data.role);
          break;
        case 'ready':
          if (data.ready !== undefined) setPeerReady(data.ready);
          break;
        case 'phaseChange':
          if (data.phase) {
            console.log(`Received phase change to ${data.phase}. Local role: ${localRole}`);
            setDebatePhase(data.phase);
          }
          break;
        case 'message':
          if (data.message && peerRole) {
            setMessages((prev) => [
              ...prev,
              { sender: peerRole, text: data.message, phase: debatePhase },
            ]);
            setTranscripts((prev) => {
              const phaseTranscripts = prev[debatePhase] || {};
              const roleTranscripts = phaseTranscripts[peerRole] || '';
              return {
                ...prev,
                [debatePhase]: {
                  ...phaseTranscripts,
                  [peerRole]: roleTranscripts + ' ' + data.message,
                },
              };
            });
          }
          break;
        case 'offer':
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(data.offer!);
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            wsRef.current?.send(JSON.stringify({ type: 'answer', answer }));
          }
          break;
        case 'answer':
          if (pcRef.current) await pcRef.current.setRemoteDescription(data.answer!);
          break;
        case 'candidate':
          if (pcRef.current) await pcRef.current.addIceCandidate(data.candidate!);
          break;
      }
    };

    ws.onerror = (err) => console.error('WebSocket error:', err);
    ws.onclose = () => console.log('WebSocket closed');

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
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
      } catch (err) {
        setMediaError('Failed to access camera/microphone. Please check permissions.');
        console.error('Media error:', err);
      }
    };

    return () => {
      if (localStream) localStream.getTracks().forEach((track) => track.stop());
      ws.close();
      pc.close();
    };
  }, [roomId]);

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((err) => console.error('Error playing local video:', err));
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((err) => console.error('Error playing remote video:', err));
    }
  }, [localStream, remoteStream]);

  // Initialize SpeechRecognition
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let newFinalTranscript = '';
        let newInterimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            newFinalTranscript += result[0].transcript + ' ';
          } else {
            newInterimTranscript = result[0].transcript;
          }
        }
        if (newFinalTranscript) {
          setFinalInput((prev) => (prev ? prev + ' ' + newFinalTranscript.trim() : newFinalTranscript.trim()));
          setInterimInput('');
        } else {
          setInterimInput(newInterimTranscript);
        }
      };

      recognitionRef.current.onend = () => setIsRecognizing(false);
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecognizing(false);
      };
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // Start/Stop Speech Recognition
  const startRecognition = () => {
    if (recognitionRef.current && !isRecognizing && isMyTurn) {
      try {
        recognitionRef.current.start();
        setIsRecognizing(true);
      } catch (error) {
        console.error('Error starting recognition:', error);
        setIsRecognizing(false);
      }
    }
  };

  const stopRecognition = () => {
    if (recognitionRef.current && isRecognizing) {
      recognitionRef.current.stop();
      setIsRecognizing(false);
    }
  };

  // Auto-start/stop recognition based on turn
  useEffect(() => {
    if (isMyTurn && debatePhase !== DebatePhase.Setup && debatePhase !== DebatePhase.Finished) {
      startRecognition();
    } else {
      stopRecognition();
    }
  }, [isMyTurn, debatePhase]);

  // Send message (transcript)
  const sendMessage = () => {
    if (!finalInput.trim() || !isMyTurn || timer === 0 || !localRole) return;

    const newMessage: Message = {
      sender: localRole,
      text: finalInput,
      phase: debatePhase,
    };

    setMessages((prev) => [...prev, newMessage]);
    wsRef.current?.send(JSON.stringify({ type: 'message', message: finalInput }));

    setTranscripts((prev) => {
      const phaseTranscripts = prev[debatePhase] || {};
      const roleTranscripts = phaseTranscripts[localRole] || '';
      return {
        ...prev,
        [debatePhase]: {
          ...phaseTranscripts,
          [localRole]: roleTranscripts + ' ' + finalInput.trim(),
        },
      };
    });

    localStorage.setItem(`${roomId}_${debatePhase}_${localRole}`, finalInput.trim());
    console.log(`Message sent by ${localRole} in ${debatePhase}:`, finalInput.trim());

    setFinalInput('');
    setInterimInput('');
    if (isRecognizing) stopRecognition();
  };

  // Handle phase completion
  const handlePhaseDone = () => {
    const currentIndex = phaseOrder.indexOf(debatePhase);
    console.log(`handlePhaseDone called for ${localRole}. Current phase: ${debatePhase}, Index: ${currentIndex}`);
    if (currentIndex >= 0 && currentIndex < phaseOrder.length - 1) {
      const nextPhase = phaseOrder[currentIndex + 1];
      console.log(`Transitioning to next phase: ${nextPhase} for role: ${localRole}`);
      setDebatePhase(nextPhase);
      wsRef.current?.send(JSON.stringify({ type: 'phaseChange', phase: nextPhase }));
    } else if (!localRole || !peerRole) {
      console.log("Cannot finish debate: Both roles must be selected.");
      setPopup({ show: true, message: "Both debaters must select roles to finish the debate." });
    } else {
      console.log(`Debate finished for ${localRole}`);
    }
  };

  // Trigger logMessageHistory when debatePhase changes to Finished
  useEffect(() => {
    if (debatePhase === DebatePhase.Finished && localRole) {
      logMessageHistory();
    }
  }, [debatePhase, localRole]);

  // Handlers for user actions
  const handleTopicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTopic = e.target.value;
    setTopic(newTopic);
    wsRef.current?.send(JSON.stringify({ type: 'topicChange', topic: newTopic }));
  };

  const handleRoleSelection = (role: DebateRole) => {
    if (peerRole === role) {
      alert(`Your opponent already chose "${role}". Please select the other side.`);
      return;
    }
    setLocalRole(role);
    wsRef.current?.send(JSON.stringify({ type: 'roleSelection', role }));
    console.log(`Role selected: ${role}`);
  };

  const toggleReady = () => {
    const newReadyState = !localReady;
    setLocalReady(newReadyState);
    wsRef.current?.send(JSON.stringify({ type: 'ready', ready: newReadyState }));
    console.log(`Ready toggled to ${newReadyState} for ${localRole}`);
  };

  // Manage setup popup visibility
  useEffect(() => {
    if (localReady && peerReady) {
      setShowSetupPopup(false);
      setCountdown(3);
      console.log(`Both ready. Starting countdown for ${localRole}`);
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
      wsRef.current?.send(JSON.stringify({ type: 'phaseChange', phase: DebatePhase.OpeningFor }));
      console.log(`Countdown finished. Starting debate at ${DebatePhase.OpeningFor} for ${localRole}`);
      if (localRole === 'for') {
        pcRef.current
          ?.createOffer()
          .then((offer) => pcRef.current!.setLocalDescription(offer).then(() => offer))
          .then((offer) => wsRef.current?.send(JSON.stringify({ type: 'offer', offer })))
          .catch((err) => console.error('Error creating offer:', err));
      }
    }
  }, [countdown, localRole]);

  // Clear input fields on phase change
  useEffect(() => {
    setFinalInput('');
    setInterimInput('');
  }, [debatePhase]);

  const formatTime = (seconds: number) => {
    const timeStr = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
    return (
      <span className={`font-mono ${seconds <= 5 ? 'text-red-500 animate-pulse' : 'text-gray-600'}`}>
        {timeStr}
      </span>
    );
  };

  // Render UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4">
      <div className="w-full max-w-5xl mx-auto py-2">
        <div className="bg-gradient-to-r from-orange-100 via-white to-orange-100 rounded-xl p-4 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Debate: {topic || 'No topic set'}</h1>
          <p className="mt-2 text-sm text-gray-700">
            Phase: <span className="font-medium">{debatePhase}</span> | Current Turn:{' '}
            <span className="font-semibold text-orange-600">
              {isMyTurn ? 'You' : 'Opponent'} to{' '}
              {debatePhase.includes('Question') ? 'ask a question' : debatePhase.includes('Answer') ? 'answer' : 'make a statement'}
            </span>
          </p>
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
            {/* Debate Topic */}
            <div className="mb-6">
              <label className="block text-lg mb-2">Debate Topic</label>
              <input
                type="text"
                value={topic}
                onChange={handleTopicChange}
                placeholder="Enter debate topic"
                className="border border-border rounded p-2 w-full bg-input text-foreground"
              />
            </div>
            {/* Avatars and Role Selection */}
            <div className="mb-6 flex justify-around">
              {/* Your Avatar and Role Selection */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <img
                    src={localAvatar}
                    alt="You"
                    className="w-20 h-20 rounded-full"
                  />
                  <div
                    className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-card ${
                      localReady ? "bg-green-500" : "bg-red-500"
                    }`}
                    title={localReady ? "You are Ready" : "You are Not Ready"}
                  ></div>
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
                  {localRole ? (localRole === "for" ? "For" : "Against") : "Not selected"}
                </div>
              </div>
              {/* Opponent Avatar */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <img
                    src={opponentAvatar}
                    alt="Opponent"
                    className="w-20 h-20 rounded-full"
                  />
                  <div
                    className={`absolute top-0 right-0 w-4 h-4 rounded-full border-2 border-card ${
                      peerReady ? "bg-green-500" : "bg-red-500"
                    }`}
                    title={peerReady ? "Opponent Ready" : "Opponent Not Ready"}
                  ></div>
                </div>
                <div className="mt-2 text-xs">
                  {peerRole ? (peerRole === "for" ? "For" : "Against") : "Not selected"}
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
          </div>
        </div>
      )}

      {/* Countdown Popup */}
      {countdown !== null && countdown > 0 && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <h2 className="text-3xl font-bold">Debate starting in {countdown}</h2>
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
                <h2 className="text-xl font-semibold text-gray-800">{popup.message}</h2>
              </div>
            ) : (
              <>
                <h3 className="text-xl font-bold text-orange-600 mb-2">Phase Transition</h3>
                <p className="text-gray-700 text-center text-sm">{popup.message}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Judgment Popup */}
      {showJudgment && judgmentData && (
        <JudgmentPopup
          judgment={judgmentData}
          forRole={localRole === 'for' ? 'You' : 'Opponent'}
          againstRole={localRole === 'against' ? 'You' : 'Opponent'}
          onClose={() => setShowJudgment(false)}
        />
      )}

      <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-3">
        {/* Local User Section */}
        <div
          className={`relative w-full md:w-1/2 ${isMyTurn && debatePhase !== DebatePhase.Finished ? 'animate-glow' : ''} bg-white border border-gray-200 shadow-md h-[540px] flex flex-col`}
        >
          <div className="p-2 bg-gray-50 flex items-center gap-2">
            <div className="w-12 h-12 flex-shrink-0">
              <img
                src={localAvatar}
                alt="You"
                className="w-full h-full rounded-full border border-orange-400 object-cover"
              />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-gray-800">You</div>
              <div className="text-xs text-gray-500">Role: {localRole || 'Not selected'}</div>
            </div>
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
            <p className="text-sm font-semibold text-orange-600 mb-1">Stance: {localRole}</p>
            <p className="text-xs mb-1">Time: {formatTime(isMyTurn ? timer : phaseDurations[debatePhase] || 0)}</p>
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-80 object-cover" />
            {isMyTurn && debatePhase !== DebatePhase.Setup && debatePhase !== DebatePhase.Finished && (
              <div className="mt-3 flex gap-2 items-center">
                <input
                  value={isRecognizing ? finalInput + (interimInput ? ' ' + interimInput : '') : finalInput}
                  onChange={(e) => !isRecognizing && setFinalInput(e.target.value)}
                  readOnly={isRecognizing}
                  disabled={!isMyTurn || timer === 0}
                  placeholder={
                    debatePhase.includes('Question')
                      ? 'Ask your question'
                      : debatePhase.includes('Answer')
                      ? 'Provide your answer'
                      : 'Make your statement'
                  }
                  className="flex-1 border-gray-300 focus:border-orange-400 rounded-md text-sm p-2"
                />
                <Button
                  onClick={isRecognizing ? stopRecognition : startRecognition}
                  disabled={!isMyTurn || timer === 0}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-md p-2"
                >
                  {isRecognizing ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                <Button
                  onClick={() => {
                    sendMessage();
                    handlePhaseDone();
                  }}
                  disabled={!isMyTurn || timer === 0}
                  className="bg-orange-500 hover:bg-orange-600 text-white rounded-md px-3 text-sm"
                >
                  Send
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Remote User Section */}
        <div
          className={`relative w-full md:w-1/2 ${!isMyTurn && debatePhase !== DebatePhase.Finished ? 'animate-glow' : ''} bg-white border border-gray-200 shadow-md h-[540px] flex flex-col`}
        >
          <div className="p-2 bg-gray-50 flex items-center gap-2">
            <div className="w-12 h-12 flex-shrink-0">
              <img
                src={opponentAvatar}
                alt="Opponent"
                className="w-full h-full rounded-full border border-orange-400 object-cover"
              />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-gray-800">Opponent</div>
              <div className="text-xs text-gray-500">Role: {peerRole || 'Not selected'}</div>
            </div>
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
            <p className="text-sm font-semibold text-orange-600 mb-1">Stance: {peerRole}</p>
            <p className="text-xs mb-1">Time: {formatTime(!isMyTurn ? timer : phaseDurations[debatePhase] || 0)}</p>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-80 object-cover" />
          </div>
        </div>
      </div>

      {/* Media Error Display */}
      {mediaError && <p className="text-red-500 mt-4 text-center">{mediaError}</p>}

      <style jsx>{`
        @keyframes glow {
          0% { box-shadow: 0 0 5px rgba(255, 149, 0, 0.5); }
          50% { box-shadow: 0 0 20px rgba(255, 149, 0, 0.8); }
          100% { box-shadow: 0 0 5px rgba(255, 149, 0, 0.5); }
        }
        .animate-glow { animation: glow 2s infinite; }
      `}</style>
    </div>
  );
};

export default OnlineDebateRoom;