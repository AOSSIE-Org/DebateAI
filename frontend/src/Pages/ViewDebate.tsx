import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { useDebateWS } from "../hooks/useDebateWS";
import { ReactionBar } from "../components/ReactionBar";
import { AnonymousQA } from "../components/AnonymousQA";
import {
  debateIdAtom,
  pollStateAtom,
  questionsAtom,
  reactionsAtom,
  wsStatusAtom,
  presenceAtom,
} from "../atoms/debateAtoms";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { getAuthToken } from "../utils/auth";

type RoomParticipant = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  role?: "for" | "against" | string;
};

export const ViewDebate: React.FC = () => {
  const { debateID } = useParams<{ debateID: string }>();
  const navigate = useNavigate();
  const [, setDebateId] = useAtom(debateIdAtom);
  const [pollState] = useAtom(pollStateAtom);
  const [questions] = useAtom(questionsAtom);
  const [reactions] = useAtom(reactionsAtom);
  const [wsStatus] = useAtom(wsStatusAtom);
  const [presence] = useAtom(presenceAtom);
  const { sendMessage } = useDebateWS(debateID || null);

  // Video streams for spectators
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const [remoteStream1, setRemoteStream1] = useState<MediaStream | null>(null);
  const [remoteStream2, setRemoteStream2] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const remoteStream1Ref = useRef<MediaStream | null>(null);
  const remoteStream2Ref = useRef<MediaStream | null>(null);
  const participantsRef = useRef<RoomParticipant[]>([]);
  const roomWsRef = useRef<WebSocket | null>(null);
  const pc1Ref = useRef<RTCPeerConnection | null>(null);
  const pc2Ref = useRef<RTCPeerConnection | null>(null);
  // Store userId and connectionId mapping for each peer connection
  const pc1UserIdRef = useRef<string | null>(null);
  const pc2UserIdRef = useRef<string | null>(null);
  const pc1ConnectionIdRef = useRef<string | null>(null);
  const pc2ConnectionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (debateID) {
      setDebateId(debateID);
    }
  }, [debateID, setDebateId]);

  useEffect(() => {
    remoteStream1Ref.current = remoteStream1;
  }, [remoteStream1]);

  useEffect(() => {
    remoteStream2Ref.current = remoteStream2;
  }, [remoteStream2]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  // Connect to room WebSocket to receive video streams
  useEffect(() => {
    if (!debateID) return;

    const token = getAuthToken();
    if (!token) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host =
      import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, "") ||
      "localhost:1313";
    const wsUrl = `${protocol}//${host}/ws?room=${debateID}&token=${token}&spectator=true`;
    const ws = new WebSocket(wsUrl);
    roomWsRef.current = ws;

    const pc1 = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    const pc2 = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pc1Ref.current = pc1;
    pc2Ref.current = pc2;

    pc1.ontrack = (event) => {
      if (event.streams[0]) {
        remoteStream1Ref.current = event.streams[0];
        setRemoteStream1(event.streams[0]);
      }
    };

    pc2.ontrack = (event) => {
      if (event.streams[0]) {
        remoteStream2Ref.current = event.streams[0];
        setRemoteStream2(event.streams[0]);
      }
    };

    pc1.onicecandidate = (event) => {
      if (
        event.candidate &&
        ws.readyState === WebSocket.OPEN &&
        pc1UserIdRef.current
      ) {
        ws.send(
          JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
            userId: pc1UserIdRef.current,
            connectionId: pc1ConnectionIdRef.current || undefined, // Include connectionId if available
          })
        );
      }
    };

    pc2.onicecandidate = (event) => {
      if (
        event.candidate &&
        ws.readyState === WebSocket.OPEN &&
        pc2UserIdRef.current
      ) {
        ws.send(
          JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
            userId: pc2UserIdRef.current,
            connectionId: pc2ConnectionIdRef.current || undefined, // Include connectionId if available
          })
        );
      }
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", room: debateID }));
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (
          data.type === "roomParticipants" &&
          Array.isArray(data.roomParticipants)
        ) {
          const roomParticipants = data.roomParticipants as RoomParticipant[];
          const debatersOnly = roomParticipants.filter(
            (participant) =>
              participant.role === "for" || participant.role === "against"
          );
          participantsRef.current = debatersOnly;
          setParticipants(debatersOnly);

          if (
            debatersOnly.length === 2 &&
            !remoteStream1Ref.current &&
            !remoteStream2Ref.current
          ) {
            // Generate a unique request ID for this spectator
            const requestId = `spectator_${Date.now()}_${Math.random()
              .toString(36)
              .substr(2, 9)}`;
            ws.send(JSON.stringify({ type: "requestOffer", requestId }));
          }
        } else if (data.type === "offer" && data.userId && data.offer) {
          const debaterIndex = participantsRef.current.findIndex(
            (participant) => participant.id === data.userId
          );
          let pc: RTCPeerConnection | null = null;
          if (debaterIndex === 0) {
            pc = pc1;
          } else if (debaterIndex === 1) {
            pc = pc2;
          } else {
            pc = pc1;
          }

          if (pc && data.offer) {
            try {
              if (pc === pc1) {
                pc1UserIdRef.current = data.userId;
                pc1ConnectionIdRef.current = data.connectionId || null;
              } else if (pc === pc2) {
                pc2UserIdRef.current = data.userId;
                pc2ConnectionIdRef.current = data.connectionId || null;
              }

              await pc.setRemoteDescription(
                new RTCSessionDescription(data.offer)
              );
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              // Include connectionId if provided (for spectator connections)
              ws.send(
                JSON.stringify({
                  type: "answer",
                  answer,
                  targetUserId: data.userId,
                  userId: data.userId,
                  connectionId: data.connectionId, // Include connectionId if provided
                })
              );
            } catch (error) {
              console.error("Error handling offer", error);
            }
          }
        } else if (data.type === "candidate" && data.userId) {
          const debaterIndex = participantsRef.current.findIndex(
            (participant) => participant.id === data.userId
          );
          let pc: RTCPeerConnection | null = null;
          if (debaterIndex === 0) {
            pc = pc1;
          } else if (debaterIndex === 1) {
            pc = pc2;
          } else {
            pc = pc1;
          }

          if (pc && data.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
              console.error("Error adding ICE candidate", error);
            }
          }
        }
      } catch (error) {
        console.error("Error processing debate room message", error);
      }
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      ws.close();
      pc1.close();
      pc2.close();
    };
  }, [debateID]);

  // Attach video streams to video elements
  useEffect(() => {
    if (video1Ref.current && remoteStream1) {
      video1Ref.current.srcObject = remoteStream1;
      video1Ref.current.play().catch(() => {});
    }
    if (video2Ref.current && remoteStream2) {
      video2Ref.current.srcObject = remoteStream2;
      video2Ref.current.play().catch(() => {});
    }
  }, [remoteStream1, remoteStream2]);

  const handleVote = (pollId: string, option: string) => {
    if (!debateID) return;

    const payload = {
      pollId,
      option,
      clientEventId: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    sendMessage("vote", payload);
  };

  if (!debateID) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Invalid debate ID
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Debate #{debateID.slice(0, 8)}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Status: {wsStatus === "connected" ? "Connected" : "Connecting..."}{" "}
              • {presence} spectator{presence !== 1 ? "s" : ""} online
            </p>
          </div>
          <Button onClick={() => navigate(-1)} variant="outline">
            Back
          </Button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Videos and Polls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Display Section */}
            <Card>
              <CardHeader>
                <CardTitle>Live Debate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Debater 1 Video */}
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                      ref={video1Ref}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {!remoteStream1 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <div className="text-center text-white">
                          <p className="text-sm">
                            {participants[0]?.displayName || "Debater 1"}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Waiting for video...
                          </p>
                        </div>
                      </div>
                    )}
                    {participants[0] && (
                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                        {participants[0].displayName}{" "}
                        {participants[0].role && `(${participants[0].role})`}
                      </div>
                    )}
                  </div>

                  {/* Debater 2 Video */}
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    <video
                      ref={video2Ref}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {!remoteStream2 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <div className="text-center text-white">
                          <p className="text-sm">
                            {participants[1]?.displayName || "Debater 2"}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Waiting for video...
                          </p>
                        </div>
                      </div>
                    )}
                    {participants[1] && (
                      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                        {participants[1].displayName}{" "}
                        {participants[1].role && `(${participants[1].role})`}
                      </div>
                    )}
                  </div>
                </div>
                {participants.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    Waiting for debaters to join...
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Poll Section */}
            <Card>
              <CardHeader>
                <CardTitle>Live Polls</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(pollState).length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 italic">
                    No active polls yet.
                  </p>
                ) : (
                  Object.entries(pollState).map(([pollId, options]) => (
                    <div
                      key={pollId}
                      className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
                        Poll: {pollId.slice(0, 8)}
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(options).map(([option, count]) => (
                          <div
                            key={option}
                            className="flex items-center justify-between"
                          >
                            <Button
                              onClick={() => handleVote(pollId, option)}
                              variant="outline"
                              className="flex-1 mr-2"
                            >
                              {option}
                            </Button>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-16 text-right">
                              {count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Q&A Section */}
            <AnonymousQA />
          </div>

          {/* Right Column - Reactions & Info */}
          <div className="space-y-6">
            {/* Reactions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Reactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {reactions.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      No reactions yet.
                    </p>
                  ) : (
                    reactions
                      .slice()
                      .reverse()
                      .slice(0, 20)
                      .map((r, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded"
                        >
                          <span className="text-2xl">{r.reaction}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(r.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle>Connection Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Status:
                    </span>
                    <span
                      className={`font-semibold ${
                        wsStatus === "connected"
                          ? "text-green-600 dark:text-green-400"
                          : wsStatus === "connecting"
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {wsStatus}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Spectators:
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {presence}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Questions:
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {questions.length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Floating Reaction Bar */}
        <ReactionBar />
      </div>
    </div>
  );
};

export default ViewDebate;
