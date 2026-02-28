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

  useEffect(() => {
    if (!debateId) return;

    setDebateId(debateId);

    if (wsRef.current) {
      return;
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

    // Get WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const apiUrl = import.meta.env.VITE_API_URL;
    let host = window.location.host;
    if (apiUrl) {
      try {
        host = new URL(apiUrl).host;
      } catch {
        host = apiUrl.replace(/^https?:\/\//, '');
      }
    }

    let spectatorId = localStorage.getItem('spectatorId');
    if (!spectatorId) {
      spectatorId = crypto.randomUUID();
      localStorage.setItem('spectatorId', spectatorId);
    }

    const wsUrl = `${protocol}//${host}/ws/debate/${debateId}${spectatorId ? `?spectatorId=${spectatorId}` : ''
      }`;

    const rws = new ReconnectingWebSocket(wsUrl, [], {
      connectionTimeout: 4000,
      maxRetries: Infinity,
      maxReconnectionDelay: 10000,
      minReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1.3,
    });

    wsRef.current = rws;
    setWs(rws as unknown as WebSocket);
    let ownsConnection = true;

    rws.onopen = () => {
      setWsStatus('connected');

      const spectatorHashValue =
        spectatorHash || localStorage.getItem('spectatorHash') || '';
      const joinMessage = {
        type: 'join',
        payload: {
          spectatorHash: spectatorHashValue,
        },
      };
      rws.send(JSON.stringify(joinMessage));
    };

    rws.onmessage = (event) => {
      try {
        const eventData: Event = JSON.parse(event.data);

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
                type: 'question',
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

    rws.onerror = () => {
      setWsStatus('error');
    };

    rws.onclose = () => {
      setWsStatus('disconnected');
      setWs(null);
      if (wsRef.current === rws) {
        wsRef.current = null;
      }
    };

    return () => {
      if (ownsConnection) {
        rws.close();
        if (wsRef.current === rws) {
          wsRef.current = null;
        }
        setWs(null);
        setWsStatus('disconnected');
      }
      ownsConnection = false;
    };
  }, [
    debateId,
    spectatorHash,
    ws,
    setWs,
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
