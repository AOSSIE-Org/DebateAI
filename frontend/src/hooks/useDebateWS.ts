import { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import {
  wsAtom,
  debateIdAtom,
  pollStateAtom,
  questionsAtom,
  reactionsAtom,
  wsStatusAtom,
  lastEventIdAtom,
  presenceAtom,
  spectatorHashAtom,
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
  const [, setLastEventId] = useAtom(lastEventIdAtom);
  const [, setPresence] = useAtom(presenceAtom);
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

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = 'localhost:1313';
    if (import.meta.env.VITE_API_URL) {
      host = import.meta.env.VITE_API_URL.replace(/^https?:\/\//, '');
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
          case 'poll_snapshot':
            if (eventData.payload.pollState) {
              setPollState(eventData.payload.pollState);
            }
            break;

          case 'vote':
            setPollState((prev) => {
              const newState = { ...prev };
              const pollId = eventData.payload.pollId;
              const option = eventData.payload.option;
              if (!newState[pollId]) {
                newState[pollId] = {};
              }
              newState[pollId][option] =
                (newState[pollId][option] || 0) + 1;
              return newState;
            });
            break;

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
    } else {
    }
  };

  return {
    sendMessage,
    ws: wsRef.current,
  };
};

