import React, { useEffect, useMemo, useRef, useState } from "react";
import { safeParse } from "@/utils/safeParse";
import { useParams, useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { useDebateWS } from "../hooks/useDebateWS";
import { buildWsUrl } from "@/lib/ws";
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
import { getAuthToken } from "../utils/auth";

type DebateParticipant = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  role?: string;
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
  const remoteStream1Ref = useRef<MediaStream | null>(null);
  const remoteStream2Ref = useRef<MediaStream | null>(null);
  const [participants, setParticipants] = useState<DebateParticipant[]>([]);
  const participantsRef = useRef<DebateParticipant[]>([]);
  const [spectatorCount, setSpectatorCount] = useState<number>(0);
  const [pollQuestion, setPollQuestion] = useState<string>("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [isCreatingPoll, setIsCreatingPoll] = useState<boolean>(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const roomWsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<
    Map<
      string,
      {
        pc: RTCPeerConnection;
        userId: string;
        baseConnectionId: string;
      }
    >
  >(new Map());
  const userToConnectionRef = useRef<Map<string, string>>(new Map());
  const baseConnectionToIdsRef = useRef<Map<string, Set<string>>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  );
  const offerRequestedRef = useRef(false);

  useEffect(() => {
    if (debateID) {
      setDebateId(debateID);
    }
  }, [debateID, setDebateId]);

  // Connect to room WebSocket to receive video streams
  useEffect(() => {
    if (!debateID) return;

    const token = getAuthToken();
    if (!token) {
      return;
    }

    const wsUrl = buildWsUrl(`/ws`, {
      room: debateID,
      token,
      spectator: "true",
    });
    const ws = new WebSocket(wsUrl);
    roomWsRef.current = ws;

    const requestOffersIfNeeded = () => {
      if (ws.readyState !== WebSocket.OPEN) {
        return;
      }

      if (participantsRef.current.length === 0) {
        return;
      }

      const needsFirstStream = !remoteStream1Ref.current;
      const needsSecondStream =
        participantsRef.current.length > 1 && !remoteStream2Ref.current;

      if (!needsFirstStream && !needsSecondStream) {
        return;
      }

      if (offerRequestedRef.current) {
        return;
      }

      const requestId = `spectator_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      ws.send(JSON.stringify({ type: "requestOffer", requestId }));
      offerRequestedRef.current = true;
    };

    const cleanupPeerConnection = (
      connectionId: string,
      options?: { skipReoffer?: boolean }
    ) => {
      const entry = peerConnectionsRef.current.get(connectionId);
      if (!entry) {
        return;
      }

      const { pc, userId, baseConnectionId } = entry;
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.oniceconnectionstatechange = null;
        pc.close();
      } catch {
        // Ignore errors
      }

      peerConnectionsRef.current.delete(connectionId);
      userToConnectionRef.current.delete(userId);
      const baseSet = baseConnectionToIdsRef.current.get(baseConnectionId);
      if (baseSet) {
        baseSet.delete(connectionId);
        if (baseSet.size === 0) {
          baseConnectionToIdsRef.current.delete(baseConnectionId);
        }
      }
      pendingCandidatesRef.current.delete(connectionId);

      const debaterIndex = participantsRef.current.findIndex(
        (p) => p.id === userId
      );
      if (debaterIndex === 0 || debaterIndex === -1) {
        remoteStream1Ref.current = null;
        setRemoteStream1(null);
      } else if (debaterIndex === 1) {
        remoteStream2Ref.current = null;
        setRemoteStream2(null);
      }

      if (!options?.skipReoffer) {
        offerRequestedRef.current = false;
        requestOffersIfNeeded();
      }
    };

    const createPeerConnection = (
      connectionId: string,
      userId: string
    ): RTCPeerConnection => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      const baseConnectionId = connectionId.includes(":")
        ? connectionId.split(":")[0]
        : connectionId;

      pc.ontrack = (event) => {
        if (!event.streams[0]) return;
        const slot = participantsRef.current.findIndex((p) => p.id === userId);

        if (slot === 0 || slot === -1) {
          setRemoteStream1(event.streams[0]);
          remoteStream1Ref.current = event.streams[0];
        } else if (slot === 1) {
          setRemoteStream2(event.streams[0]);
          remoteStream2Ref.current = event.streams[0];
        }

        if (
          remoteStream1Ref.current &&
          (participantsRef.current.length === 1 || remoteStream2Ref.current)
        ) {
          offerRequestedRef.current = false;
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(
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
        const state = pc.connectionState || pc.iceConnectionState;
        if (
          state === "failed" ||
          state === "disconnected" ||
          state === "closed"
        ) {
          cleanupPeerConnection(connectionId);
        }
      };

      pc.onconnectionstatechange = handleConnectionStateChange;
      pc.oniceconnectionstatechange = handleConnectionStateChange;

      peerConnectionsRef.current.set(connectionId, {
        pc,
        userId,
        baseConnectionId,
      });
      userToConnectionRef.current.set(userId, connectionId);
      const baseSet =
        baseConnectionToIdsRef.current.get(baseConnectionId) ??
        new Set<string>();
      baseSet.add(connectionId);
      baseConnectionToIdsRef.current.set(baseConnectionId, baseSet);
      return pc;
    };

    const getPeerConnection = (
      connectionId: string,
      userId: string
    ): RTCPeerConnection | null => {
      if (!connectionId) {
        return null;
      }

      if (peerConnectionsRef.current.has(connectionId)) {
        return peerConnectionsRef.current.get(connectionId)!.pc;
      }

      const existingConnectionId = userToConnectionRef.current.get(userId);
      if (
        existingConnectionId &&
        existingConnectionId !== connectionId &&
        peerConnectionsRef.current.has(existingConnectionId)
      ) {
        cleanupPeerConnection(existingConnectionId, { skipReoffer: true });
      }

      return createPeerConnection(connectionId, userId);
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join", room: debateID }));
    };

    ws.onmessage = async (event) => {
      try {
        const data: any = safeParse<any>(event.data, null);
        if (!data) {
          console.warn("ViewDebate: failed to parse WS message", event.data);
          return;
        }

        if (data.type === "roomParticipants" && data.roomParticipants) {
          const roomParticipants =
            (data.roomParticipants as DebateParticipant[]) ?? [];
          const debatersOnly = roomParticipants.filter(
            (p) => p.role === "for" || p.role === "against"
          );
          setParticipants(debatersOnly);
          participantsRef.current = debatersOnly;
          if (typeof data.spectatorCount === "number") {
            setSpectatorCount(data.spectatorCount);
          }

          offerRequestedRef.current = false;

          const activeDebaterIds = new Set(debatersOnly.map((p) => p.id));
          const connectionsToRemove: string[] = [];
          peerConnectionsRef.current.forEach((entry, connectionId) => {
            if (!activeDebaterIds.has(entry.userId)) {
              connectionsToRemove.push(connectionId);
            }
          });
          connectionsToRemove.forEach((connectionId) =>
            cleanupPeerConnection(connectionId, { skipReoffer: true })
          );

          if (debatersOnly.length === 0) {
            remoteStream1Ref.current = null;
            remoteStream2Ref.current = null;
            setRemoteStream1(null);
            setRemoteStream2(null);
          } else if (debatersOnly.length === 1) {
            remoteStream2Ref.current = null;
            setRemoteStream2(null);
          }

          requestOffersIfNeeded();
        } else if (data.type === "offer" && data.userId && data.offer) {
          const connectionId =
            data.connectionId ||
            userToConnectionRef.current.get(data.userId) ||
            `${data.userId}`;
          if (connectionId && data.offer) {
            try {
              const pc = getPeerConnection(connectionId, data.userId);
              if (!pc) {
                return;
              }
              await pc.setRemoteDescription(
                new RTCSessionDescription(data.offer)
              );
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(
                JSON.stringify({
                  type: "answer",
                  answer,
                  targetUserId: data.userId,
                  userId: data.userId,
                  connectionId,
                })
              );
              const queuedCandidates =
                pendingCandidatesRef.current.get(connectionId);
              if (queuedCandidates && queuedCandidates.length > 0) {
                for (const candidate of queuedCandidates) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                  } catch (candidateError) {
                    console.error(
                      "Failed to flush pending ICE candidate",
                      candidateError
                    );
                  }
                }
                pendingCandidatesRef.current.delete(connectionId);
              }
            } catch (offerError) {
              console.error("Error handling incoming offer", offerError);
            }
          }
        } else if (data.type === "candidate" && data.candidate) {
          const connectionId =
            data.connectionId ||
            userToConnectionRef.current.get(data.userId ?? "") ||
            null;

          if (!connectionId) {
            return;
          }

          const entry = peerConnectionsRef.current.get(connectionId);
          if (entry) {
            try {
              await entry.pc.addIceCandidate(
                new RTCIceCandidate(data.candidate)
              );
            } catch {
              const queue =
                pendingCandidatesRef.current.get(connectionId) ?? [];
              queue.push(data.candidate);
              pendingCandidatesRef.current.set(connectionId, queue);
            }
          } else {
            const queue = pendingCandidatesRef.current.get(connectionId) ?? [];
            queue.push(data.candidate);
            pendingCandidatesRef.current.set(connectionId, queue);
          }
        }
      } catch (messageError) {
        console.error("Error handling debate room message", messageError);
      }
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      ws.close();
      peerConnectionsRef.current.forEach((_, connectionId) =>
        cleanupPeerConnection(connectionId, { skipReoffer: true })
      );
      peerConnectionsRef.current.clear();
      userToConnectionRef.current.clear();
      baseConnectionToIdsRef.current.clear();
      pendingCandidatesRef.current.clear();
      remoteStream1Ref.current = null;
      remoteStream2Ref.current = null;
      offerRequestedRef.current = false;
      setRemoteStream1(null);
      setRemoteStream2(null);
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

  const handleAddPollOption = () => {
    setPollOptions((prev) => [...prev, ""]);
  };

  const handlePollOptionChange = (index: number, value: string) => {
    setPollOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleRemovePollOption = (index: number) => {
    setPollOptions((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleCreatePoll = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!debateID || isCreatingPoll) return;

    const question = pollQuestion.trim();
    const options = pollOptions
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0);

    if (!question) {
      setPollError("Please enter a poll question.");
      return;
    }

    if (options.length < 2) {
      setPollError("Please provide at least two options.");
      return;
    }

    setPollError(null);
    setIsCreatingPoll(true);
    try {
      sendMessage("createPoll", {
        question,
        options,
      });
      setPollQuestion("");
      setPollOptions(["", ""]);
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const polls = useMemo(() => Object.values(pollState), [pollState]);

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
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Live debate
            </p>
            <h1 className="text-2xl font-semibold">
              Debate #{debateID.slice(0, 8)}
            </h1>
            <p className="text-sm text-muted-foreground">
              {wsStatus === "connected" ? "Connected" : "Connecting…"} •{" "}
              {presence} spectator{presence === 1 ? "" : "s"} watching • room
              viewers {spectatorCount}
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Back
          </Button>
        </header>

        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-muted/40">
                <video
                  ref={video1Ref}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                {!remoteStream1 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
                    <span>{participants[0]?.displayName || "Debater 1"}</span>
                    <span className="text-xs">Waiting for video…</span>
                  </div>
                )}
                {participants[0] && (
                  <div className="absolute bottom-3 left-3 rounded-full bg-background/80 px-3 py-1 text-xs font-medium">
                    {participants[0].displayName}
                    {participants[0].role ? ` • ${participants[0].role}` : ""}
                  </div>
                )}
              </div>

              <div className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-muted/40">
                <video
                  ref={video2Ref}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                {!remoteStream2 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
                    <span>{participants[1]?.displayName || "Debater 2"}</span>
                    <span className="text-xs">Waiting for video…</span>
                  </div>
                )}
                {participants[1] && (
                  <div className="absolute bottom-3 left-3 rounded-full bg-background/80 px-3 py-1 text-xs font-medium">
                    {participants[1].displayName}
                    {participants[1].role ? ` • ${participants[1].role}` : ""}
                  </div>
                )}
              </div>
            </div>

            <section className="rounded-2xl border border-border bg-card/40 p-4 shadow-sm shadow-black/5">
              <div className="flex items-center justify-between pb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Audience polls
                </h2>
                <span className="text-xs text-muted-foreground">
                  Engage the live audience in real time
                </span>
              </div>

              <form onSubmit={handleCreatePoll} className="space-y-3">
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Ask spectators a question…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="space-y-2">
                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) =>
                          handlePollOptionChange(index, e.target.value)
                        }
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePollOption(index)}
                          className="text-xs text-muted-foreground hover:text-destructive"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddPollOption}
                    className="text-xs font-medium text-primary"
                  >
                    + Add option
                  </button>
                </div>
                {pollError && (
                  <p className="text-xs text-destructive">{pollError}</p>
                )}
                <Button
                  type="submit"
                  disabled={isCreatingPoll}
                  className="w-full"
                >
                  {isCreatingPoll ? "Creating…" : "Publish poll"}
                </Button>
              </form>

              <div className="mt-6 space-y-4">
                {polls.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No polls yet. Launch one to gather instant feedback.
                  </p>
                ) : (
                  polls.map((poll) => {
                    const totalVotes = poll.options.reduce(
                      (count, option) => count + (poll.counts[option] || 0),
                      0
                    );
                    return (
                      <div
                        key={poll.pollId}
                        className="rounded-xl border border-border/60 bg-background/60 p-4"
                      >
                        <div className="flex items-center justify-between text-sm font-medium">
                          <span>
                            {poll.question || `Poll ${poll.pollId.slice(0, 8)}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {totalVotes} vote{totalVotes === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {poll.options.map((option) => {
                            const count = poll.counts[option] || 0;
                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => handleVote(poll.pollId, option)}
                                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-primary/5"
                              >
                                <span>{option}</span>
                                <span className="font-semibold">{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card/40 p-4 shadow-sm shadow-black/5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground pb-4">
                Audience questions
              </h2>
              <AnonymousQA />
            </section>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-card/40 p-4 shadow-sm shadow-black/5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground pb-3">
                Recent reactions
              </h2>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {reactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No reactions yet.
                  </p>
                ) : (
                  reactions
                    .slice()
                    .reverse()
                    .slice(0, 20)
                    .map((reaction, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg bg-background/60 px-3 py-2 text-sm"
                      >
                        <span className="text-lg">{reaction.reaction}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(reaction.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/40 p-4 shadow-sm shadow-black/5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground pb-3">
                Room summary
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Connection</dt>
                  <dd
                    className={
                      wsStatus === "connected"
                        ? "font-medium text-emerald-500"
                        : wsStatus === "connecting"
                        ? "font-medium text-amber-500"
                        : "font-medium text-destructive"
                    }
                  >
                    {wsStatus}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Spectators online</dt>
                  <dd className="font-medium">{presence}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Questions submitted</dt>
                  <dd className="font-medium">{questions.length}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </section>

        <ReactionBar />
      </div>
    </div>
  );
};

export default ViewDebate;
