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
  wsErrorAtom,          // <-- NEW
  PollInfo,
} from '../atoms/debateAtoms';
import ReconnectingWebSocket from 'reconnecting-websocket';

interface Event {
  type: string;
  payload: any;
  timestamp: number;
}

// Constants for error handling
const ERROR_THROTTLE_MS = 5000; // 5 seconds between error messages
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000; // 1 second initial delay

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
  const [, setWsError] = useAtom(wsErrorAtom);
  
  const wsRef = useRef<ReconnectingWebSocket | null>(null);
  const lastErrorTime = useRef(0);
  const retryCount = useRef(0);

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
    setWsError(null); // clear old errors when reconnecting

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

    const wsUrl = `${protocol}//${host}/ws/debate/${debateId}${
      spectatorId ? `?spectatorId=${spectatorId}` : ''
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

    const handleError = (error: unknown, context = 'WebSocket error') => {
      const now = Date.now();
      if (now - lastErrorTime.current > ERROR_THROTTLE_MS) {
        const errorMessage = error instanceof Error 
          ? `${context}: ${error.message}`
          : `${context}: An unknown error occurred`;
        
        console.error(errorMessage, error);
        setWsError(errorMessage);
        lastErrorTime.current = now;
      }
      setWsStatus('error');
    };

    const handleReconnect = () => {
      if (retryCount.current < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, retryCount.current);
        retryCount.current++;
        
        console.log(`Attempting to reconnect (${retryCount.current}/${MAX_RETRIES})...`);
        
        setTimeout(() => {
          if (wsRef.current) {
            wsRef.current.reconnect();
          }
        }, delay);
      } else {
        handleError(new Error('Max reconnection attempts reached'));
      }
    };

    rws.onopen = () => {
      // Reset retry counter on successful connection
      retryCount.current = 0;
      setWsStatus('connected');
      setWsError(null);

      const spectatorHashValue = spectatorHash || localStorage.getItem('spectatorHash') || '';

      try {
        const joinMessage = {
          type: 'join',
          payload: { spectatorHash: spectatorHashValue },
        };
        rws.send(JSON.stringify(joinMessage));
      } catch (error) {
        handleError(error, 'Failed to send join message');
      }
    };

    rws.onmessage = (event) => {
      try {
        if (!event.data) {
          throw new Error('Received empty message');
        }
        
        const eventData: Event = JSON.parse(event.data);
        
        // Reset error state on successful message
        if (retryCount.current > 0) {
          retryCount.current = 0;
          setWsError(null);
        }

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
                    counts[option] =
                      typeof value === 'number'
                        ? value
                        : Number(value ?? 0) || 0;
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

                nextState[pollId] = {
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
              });

              setPollState(nextState);
            } else if (payload.pollState) {
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
                      typeof poll.question === 'string'
                        ? poll.question
                        : '',
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
        handleError(error, 'Error processing WebSocket message');
        handleReconnect();
      }
    };

    rws.onerror = (error) => {
      handleError(error, 'WebSocket connection error');
      handleReconnect();
    };

    rws.onclose = (event) => {
      // Don't treat normal closure as error
      if (event.code !== 1000) { // 1000 is normal closure
        handleError(new Error(`Connection closed with code ${event.code}: ${event.reason || 'Unknown reason'}`));
        handleReconnect();
      } else {
        setWsStatus('disconnected');
        setWsError(null);
      }
      
      setWs(null);

      if (wsRef.current === rws) {
        wsRef.current = null;
      }
    };

    // Cleanup function
    return () => {
      if (ownsConnection) {
        try {
          if (rws.readyState === WebSocket.OPEN) {
            rws.close(1000, 'Component unmounting');
          }
          rws.close();
        } catch (error) {
          console.error('Error during WebSocket cleanup:', error);
        } finally {
          if (wsRef.current === rws) {
            wsRef.current = null;
          }
          setWs(null);
          setWsStatus('disconnected');
          setWsError(null);
        }
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
    setWsError,
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
