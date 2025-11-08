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
    setWsStatus('connecting');

    // Get WebSocket URL - use localhost:1313 directly for development
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use localhost:1313 directly or construct from VITE_API_URL
    let host = 'localhost:1313';
    if (import.meta.env.VITE_API_URL) {
      host = import.meta.env.VITE_API_URL.replace(/^https?:\/\//, '');
    }
    
    // Ensure we have a spectator ID
    let spectatorId = localStorage.getItem('spectatorId');
    if (!spectatorId) {
      spectatorId = crypto.randomUUID();
      localStorage.setItem('spectatorId', spectatorId);
    }
    
    const wsUrl = `${protocol}//${host}/ws/debate/${debateId}${spectatorId ? `?spectatorId=${spectatorId}` : ''}`;

    // Create reconnecting WebSocket
    const rws = new ReconnectingWebSocket(wsUrl, [], {
      connectionTimeout: 4000,
      maxRetries: Infinity,
      maxReconnectionDelay: 10000,
      minReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1.3,
    });

    wsRef.current = rws;

    rws.onopen = () => {
      setWsStatus('connected');
      setWs(rws as any);

      // Send join message
      const spectatorHashValue = spectatorHash || localStorage.getItem('spectatorHash') || '';
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

        // Update last event ID
        if (eventData.type !== 'poll_snapshot') {
          // Store for replay if needed
        }

        // Route messages to atoms
        switch (eventData.type) {
          case 'poll_snapshot':
            if (eventData.payload.pollState) {
              setPollState(eventData.payload.pollState);
            }
            break;

          case 'vote':
            // Update poll state
            setPollState((prev) => {
              const newState = { ...prev };
              const pollId = eventData.payload.pollId;
              const option = eventData.payload.option;
              if (!newState[pollId]) {
                newState[pollId] = {};
              }
              newState[pollId][option] = (newState[pollId][option] || 0) + 1;
              return newState;
            });
            break;

          case 'question':
            setQuestions((prev) => {
              const newQuestions = [
                ...prev,
                {
                  qId: eventData.payload.qId,
                  text: eventData.payload.text,
                  spectatorHash: eventData.payload.spectatorHash,
                  timestamp: eventData.payload.timestamp,
                },
              ];
              return newQuestions;
            });
            break;

          case 'reaction':
            setReactions((prev) => {
              const newReactions = [
                ...prev.slice(-49), // Keep last 50
                {
                  reaction: eventData.payload.reaction,
                  spectatorHash: eventData.payload.spectatorHash,
                  timestamp: eventData.payload.timestamp,
                },
              ];
              return newReactions;
            });
            break;

          case 'presence':
            const count = eventData.payload.connected || 0;
            setPresence(count);
            break;

          default:
        }
      } catch (error) {
      }
    };

    rws.onerror = (error) => {
      setWsStatus('error');
    };

    rws.onclose = (event) => {
      setWsStatus('disconnected');
      setWs(null);
    };

    return () => {
      if (rws) {
        rws.close();
        wsRef.current = null;
        setWs(null);
        setWsStatus('disconnected');
      }
    };
  }, [debateId, spectatorHash, setWs, setDebateId, setPollState, setQuestions, setReactions, setWsStatus, setLastEventId, setPresence]);

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

