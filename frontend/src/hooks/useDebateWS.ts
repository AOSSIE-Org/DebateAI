import { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import {
  wsAtom,
  debateIdAtom,
  pollStateAtom,
  questionsAtom,
  reactionsAtom,
  wsStatusAtom,
  presenceAtom,
  spectatorHashAtom,
  lastEventIdAtom,
  PollInfo,
} from '../atoms/debateAtoms';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { buildWsUrl } from '@/lib/ws';
import { getLocalString, setLocalString } from '@/utils/storage';
import { safeParse } from '@/utils/safeParse';

interface Event {
  type: string;
  payload: any;
  timestamp: number;
}

export const useDebateWS = (debateId: string | null) => {
  const [ws, setWs] = useAtom(wsAtom);
  const [, setDebateId] = useAtom(debateIdAtom);
  const [, setPollState] = useAtom(pollStateAtom);
  const [, setQuestions] = useAtom(questionsAtom);
  const [, setReactions] = useAtom(reactionsAtom);
  const [, setWsStatus] = useAtom(wsStatusAtom);
  const [, setPresence] = useAtom(presenceAtom);
  const [, setLastEventId] = useAtom(lastEventIdAtom);
  const [spectatorHash] = useAtom(spectatorHashAtom);
  const wsRef = useRef<ReconnectingWebSocket | null>(null);
  const creatingRef = useRef(false);

  // Helper to cleanly remove handlers and close a socket
  const cleanupSocket = (socket: ReconnectingWebSocket | null) => {
    try {
      if (!socket) return;
      // remove handlers to avoid receiving events during/after close
      // @ts-ignore - reconnecting-websocket typings allow assignment
      socket.onopen = null;
      // @ts-ignore
      socket.onmessage = null;
      // @ts-ignore
      socket.onerror = null;
      // @ts-ignore
      socket.onclose = null;

      try {
        // close only if not already closed
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close();
        }
      } catch (e) {}

      if (wsRef.current === socket) {
        wsRef.current = null;
      }
      try {
        setWs(null);
      } catch {}
    } catch (err) {
      // swallow
    }
  };

  useEffect(() => {
    if (!debateId) return;

    setDebateId(debateId);

    if (wsRef.current) {
      // ensure any existing socket is fully cleaned before proceeding
      cleanupSocket(wsRef.current);
      // allow creating a fresh connection
    }

    if (ws) {
      const existing = ws as unknown as ReconnectingWebSocket;
      if (
        existing.readyState === WebSocket.CLOSING ||
        existing.readyState === WebSocket.CLOSED
      ) {
        setWs(null);
      } else {
        wsRef.current = existing;
        if (existing.readyState === WebSocket.OPEN) {
          setWsStatus('connected');
        } else if (existing.readyState === WebSocket.CONNECTING) {
          setWsStatus('connecting');
        } else {
          setWsStatus('disconnected');
        }
        return;
      }
    }

    setWsStatus('connecting');

    // Prevent concurrent creations
    if (creatingRef.current) return;
    creatingRef.current = true;

    let rws: ReconnectingWebSocket | null = null;
    try {
      let spectatorId = getLocalString('spectatorId');
      if (!spectatorId) {
        spectatorId = crypto.randomUUID();
        setLocalString('spectatorId', spectatorId);
      }

      const wsUrl = buildWsUrl(`/ws/debate/${debateId}`, { spectatorId });

      // If an existing socket already matches this URL and is open/connecting, reuse it
      const existing = wsRef.current as ReconnectingWebSocket | null;
      const existingUrl = (existing as any)?.url || (existing as any)?.URL || (existing as any)?._url || null;
      if (
        existing &&
        (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING) &&
        existingUrl === wsUrl
      ) {
        // already connected or connecting to the same room
        setWsStatus(existing.readyState === WebSocket.OPEN ? 'connected' : 'connecting');
        return;
      }

      // cleanup previous socket if it's different
      if (existing) {
        cleanupSocket(existing);
      }

      rws = new ReconnectingWebSocket(wsUrl, [], {
        connectionTimeout: 4000,
        // avoid infinite rapid reconnect loops that exhaust browser resources
        maxRetries: 10,
        maxReconnectionDelay: 10000,
        minReconnectionDelay: 2000,
        reconnectionDelayGrowFactor: 1.3,
      });
      const socket = rws;

      // set ref and global atom
      wsRef.current = socket;
      setWs(socket as unknown as WebSocket);

      socket.onopen = () => {
        // ignore events from stale sockets
        if (socket !== wsRef.current) return;
        setWsStatus('connected');

        const spectatorHashValue = spectatorHash || getLocalString('spectatorHash') || '';
        const joinMessage = {
          type: 'join',
          payload: {
            spectatorHash: spectatorHashValue,
          },
        };
        try {
          socket.send(JSON.stringify(joinMessage));
        } catch {}
      };

      socket.onmessage = (event) => {
      try {
        const eventData = safeParse<Event>(event.data, null);
        if (!eventData) {
          console.warn('useDebateWS: failed to parse event data');
          return;
        }

          // ignore stale socket messages
          if (socket !== wsRef.current) return;

        if (eventData.type !== 'poll_snapshot' && eventData.timestamp) {
          setLastEventId(String(eventData.timestamp));
        }

        switch (eventData.type) {
          case 'poll_snapshot': {
            const payload = eventData.payload || {};
            const pollsPayload = payload.polls;
            if (Array.isArray(pollsPayload)) {
              const nextState: Record<string, PollInfo> = {};
              pollsPayload.forEach((poll) => {
                if (!poll) return;
                const pollId =
                  typeof poll.pollId === 'string'
                    ? poll.pollId
                    : String(poll.pollId ?? '');
                if (!pollId) return;
                const countsRaw = poll.counts || {};
                const counts: Record<string, number> = {};
                if (countsRaw && typeof countsRaw === 'object') {
                  Object.entries(countsRaw).forEach(([option, value]) => {
                    const numericValue =
                      typeof value === 'number'
                        ? value
                        : Number(value ?? 0) || 0;
                    counts[option] = numericValue;
                  });
                }
                let options: string[] = [];
                if (Array.isArray(poll.options)) {
                  options = poll.options
                    .map((opt: unknown) => String(opt ?? '').trim())
                    .filter((opt: string) => opt.length > 0);
                }
                if (options.length === 0) {
                  options = Object.keys(counts);
                }
                const info: PollInfo = {
                  pollId,
                  question:
                    typeof poll.question === 'string' ? poll.question : '',
                  options,
                  counts,
                  voters:
                    typeof poll.voters === 'number'
                      ? poll.voters
                      : Number(poll.voters ?? 0) || 0,
                };
                nextState[pollId] = info;
              });
              setPollState(nextState);
            } else if (payload.pollState) {
              // Backwards compatibility: convert legacy structure
              const legacyState = payload.pollState as Record<
                string,
                Record<string, number>
              >;
              const legacyResult: Record<string, PollInfo> = {};
              Object.entries(legacyState).forEach(([pollId, counts]) => {
                const options = Object.keys(counts || {});
                legacyResult[pollId] = {
                  pollId,
                  question: '',
                  options,
                  counts: counts || {},
                  voters:
                    typeof payload.votersCount?.[pollId] === 'number'
                      ? payload.votersCount[pollId]
                      : 0,
                };
              });
              setPollState(legacyResult);
            }
            break;
          }

          case 'vote':
            setPollState((prev) => {
              const pollId = eventData.payload?.pollId;
              const option = eventData.payload?.option;
              if (typeof pollId !== 'string' || typeof option !== 'string') {
                return prev;
              }
              const nextState = { ...prev };
              const existing = nextState[pollId];
              if (!existing) {
                nextState[pollId] = {
                  pollId,
                  question: '',
                  options: [option],
                  counts: { [option]: 1 },
                  voters: 0,
                };
                return nextState;
              }
              const nextCounts = { ...existing.counts };
              nextCounts[option] = (nextCounts[option] || 0) + 1;
              const nextOptions = existing.options.includes(option)
                ? existing.options
                : [...existing.options, option];
              nextState[pollId] = {
                ...existing,
                options: nextOptions,
                counts: nextCounts,
              };
              return nextState;
            });
            break;

          case 'poll_created': {
            const poll = eventData.payload;
            if (poll && poll.pollId) {
              setPollState((prev) => {
                const pollId = String(poll.pollId);
                const countsRaw = poll.counts || {};
                const counts: Record<string, number> = {};
                Object.entries(countsRaw).forEach(([option, value]) => {
                  counts[option] =
                    typeof value === 'number'
                      ? value
                      : Number(value ?? 0) || 0;
                });
                const options = Array.isArray(poll.options)
                  ? poll.options
                      .map((opt: unknown) => String(opt ?? '').trim())
                      .filter((opt: string) => opt.length > 0)
                  : Object.keys(counts);
                return {
                  ...prev,
                  [pollId]: {
                    pollId,
                    question:
                      typeof poll.question === 'string' ? poll.question : '',
                    options,
                    counts,
                    voters:
                      typeof poll.voters === 'number'
                        ? poll.voters
                        : Number(poll.voters ?? 0) || 0,
                  },
                };
              });
            }
            break;
          }

          case 'question':
            setQuestions((prev) => [
              ...prev,
              {
                qId: eventData.payload.qId,
                text: eventData.payload.text,
                spectatorHash: eventData.payload.spectatorHash,
                timestamp: eventData.payload.timestamp,
              },
            ]);
            break;

          case 'reaction':
            setReactions((prev) => [
              ...prev.slice(-49),
              {
                reaction: eventData.payload.reaction,
                spectatorHash: eventData.payload.spectatorHash,
                timestamp: eventData.payload.timestamp,
              },
            ]);
            break;

          case 'presence': {
            const count = eventData.payload.connected || 0;
            setPresence(count);
            break;
          }

          default:
        }
      } catch (error) {
      }
      };

      socket.onerror = () => {
        if (socket !== wsRef.current) return;
        setWsStatus('error');
      };

      socket.onclose = () => {
        // ensure we only update state for the current socket
        if (socket !== wsRef.current) return;
        setWsStatus('disconnected');
        // cleanup handlers and null refs
        cleanupSocket(socket);
      };
    } catch (err) {
      // creation failed — ensure status updated
      try {
        setWsStatus('disconnected');
      } catch {}
    } finally {
      creatingRef.current = false;
    }

    return () => {
      // cleanup the active socket (if any) in a safe, sync manner
      try {
        cleanupSocket(wsRef.current);
      } catch {}
      try {
        setWsStatus('disconnected');
      } catch {}
    };
  // Note: `ws` and `setWs` intentionally omitted to avoid re-running
  // the effect when we update the atom inside the effect (prevents loops)
  }, [
    debateId,
    spectatorHash,
    setDebateId,
    setPollState,
    setQuestions,
    setReactions,
    setWsStatus,
    setLastEventId,
    setPresence,
  ]);

  const sendMessage = (type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, payload });
      wsRef.current.send(message);
    }
  };

  return {
    sendMessage,
    ws: wsRef.current,
  };
};

