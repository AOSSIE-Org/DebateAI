import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import PlayerCard from "../components/PlayerCard";
import UserCamera from "../components/UserCamera";
import Chatbox, { ChatMessage, TypingIndicator } from "../components/Chatbox";

const Game: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [state, setState] = useState({
    cameraOn: true,
    micOn: true,
    loading: true,
    gameEnded: false,
    gameResult: {
      isReady: false,
      isWinner: false,
      points: false,
      totalPoints: 0,
      evaluationMessage: "no data",
    },
    isTurn: false,
    turnDuration: 0,
    messages: [
      { isUser: false, text: "Message from opponent." },
      { isUser: true, text: "Message from user." },
    ] as ChatMessage[],
    transcriptStatus: {
      loading: false,
      isUser: false,
    },
    typingIndicators: [] as TypingIndicator[],
  });

  const websocketRef = useRef<WebSocket | null>(null);
  const lastTypingStateRef = useRef<boolean>(false);
  const lastSpeakingStateRef = useRef<boolean>(false);

  const sendWebSocketMessage = useCallback((payload: Record<string, unknown>) => {
    const ws = websocketRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    } else {
      console.warn("Attempted to send message while WebSocket was not open.", payload);
    }
  }, []);

  type GameWebSocketMessage = {
    type: string;
    content?: string;
    [key: string]: unknown;
  };

  const parseContent = useCallback(
    <T,>(raw: string, messageType: string): T | null => {
      try {
        return JSON.parse(raw) as T;
      } catch (error) {
        console.error(`Failed to parse ${messageType} content:`, error);
        return null;
      }
    },
    []
  );

  const handleWebSocketMessage = useCallback(
    (message: GameWebSocketMessage) => {
      switch (message.type) {
        case "DEBATE_START":
          setState((prevState) => ({ ...prevState, loading: false }));
          break;
        case "DEBATE_END":
          setState((prevState) => ({ ...prevState, gameEnded: true }));
          break;
        case "TURN_START": {
          if (!message.content) {
            console.warn("TURN_START received without content");
            break;
          }
          const parsed = parseContent<{ currentTurn: string; duration: number }>(
            message.content,
            "TURN_START"
          );
          if (!parsed) {
            break;
          }
          const { currentTurn, duration } = parsed;
          setState((prevState) => ({
            ...prevState,
            isTurn: currentTurn === userId,
            turnDuration: duration,
          }));
          break;
        }
        case "TURN_END":
          setState((prevState) => ({
            ...prevState,
            isTurn: false,
            turnDuration: 0,
          }));
          break;
        case "CHAT_MESSAGE": {
          if (!message.content) {
            console.warn("CHAT_MESSAGE received without content");
            break;
          }
          const parsed = parseContent<{
            sender: string;
            message: string;
            username?: string;
          }>(message.content, "CHAT_MESSAGE");
          if (!parsed) {
            break;
          }
          const { sender, message: chatMessage } = parsed;
          const newMessage: ChatMessage = {
            isUser: sender === userId,
            text: chatMessage,
          };
          setState((prevState) => ({
            ...prevState,
            messages: [...prevState.messages, newMessage],
            transcriptStatus: { ...prevState.transcriptStatus, loading: false },
            typingIndicators: prevState.typingIndicators.filter(
              (indicator) => indicator.userId !== sender
            ),
          }));
          break;
        }
        case "GENERATING_TRANSCRIPT": {
          if (!message.content) {
            console.warn("GENERATING_TRANSCRIPT received without content");
            break;
          }
          const parsed = parseContent<{ sender: string }>(
            message.content,
            "GENERATING_TRANSCRIPT"
          );
          if (!parsed) {
            break;
          }
          const { sender } = parsed;
          setState((prevState) => ({
            ...prevState,
            transcriptStatus: { loading: true, isUser: sender === userId }, //transcript is getting generated
          }));
          break;
        }

        case "TYPING_START":
        case "TYPING_STOP": {
          if (!message.content) {
            console.warn(`${message.type} received without content`);
            break;
          }
          const parsed = parseContent<{
            userId: string;
            username?: string;
            partialText?: string;
          }>(message.content, message.type);
          if (!parsed || !parsed.userId || parsed.userId === userId) {
            break;
          }
          const isTyping = message.type === "TYPING_START";
          setState((prevState) => {
            const existing = prevState.typingIndicators.find(
              (indicator) => indicator.userId === parsed.userId
            );
            const others = prevState.typingIndicators.filter(
              (indicator) => indicator.userId !== parsed.userId
            );
            const baseIndicator: TypingIndicator =
              existing ?? {
                userId: parsed.userId,
                username: parsed.username ?? "Opponent",
                isTyping: false,
                isSpeaking: false,
              };
            const updatedIndicator: TypingIndicator = {
              ...baseIndicator,
              username: parsed.username ?? baseIndicator.username,
              isTyping,
              partialText: isTyping ? parsed.partialText : undefined,
            };
            if (!updatedIndicator.isTyping && !updatedIndicator.isSpeaking) {
              return { ...prevState, typingIndicators: others };
            }
            return {
              ...prevState,
              typingIndicators: [...others, updatedIndicator],
            };
          });
          break;
        }

        case "SPEAKING_START":
        case "SPEAKING_STOP": {
          if (!message.content) {
            console.warn(`${message.type} received without content`);
            break;
          }
          const parsed = parseContent<{
            userId: string;
            username?: string;
          }>(message.content, message.type);
          if (!parsed || !parsed.userId || parsed.userId === userId) {
            break;
          }
          const isSpeaking = message.type === "SPEAKING_START";
          setState((prevState) => {
            const existing = prevState.typingIndicators.find(
              (indicator) => indicator.userId === parsed.userId
            );
            const others = prevState.typingIndicators.filter(
              (indicator) => indicator.userId !== parsed.userId
            );
            const baseIndicator: TypingIndicator =
              existing ?? {
                userId: parsed.userId,
                username: parsed.username ?? "Opponent",
                isTyping: false,
                isSpeaking: false,
              };
            const updatedIndicator: TypingIndicator = {
              ...baseIndicator,
              username: parsed.username ?? baseIndicator.username,
              isSpeaking,
            };
            if (!updatedIndicator.isTyping && !updatedIndicator.isSpeaking) {
              return { ...prevState, typingIndicators: others };
            }
            return {
              ...prevState,
              typingIndicators: [...others, updatedIndicator],
            };
          });
          break;
        }

        case "GAME_RESULT": {
          console.log(message);
          if (!message.content) {
            console.warn("GAME_RESULT received without content");
            break;
          }
          const parsed = parseContent<{
            winnerUserId: string;
            points: number;
            totalPoints: number;
            evaluationMessage: string;
          }>(message.content, "GAME_RESULT");
          if (!parsed) {
            break;
          }
          const { winnerUserId, points, totalPoints, evaluationMessage } =
            parsed;
          setState((prevState) => ({
            ...prevState,
            gameResult: {
              isReady: true,
              isWinner: winnerUserId === userId,
              points: points,
              totalPoints: totalPoints,
              evaluationMessage: evaluationMessage,
            },
          }));
          break;
        }

        default:
          console.warn("Unhandled message type:", message.type);
      }
    },
    [userId, parseContent]
  );

  useEffect(() => {
    const wsURL = `${import.meta.env.VITE_BASE_URL}/ws?userId=${userId}`;
    const ws = new WebSocket(wsURL);
    ws.binaryType = "arraybuffer";
    websocketRef.current = ws;

    ws.onopen = () => console.log("WebSocket connection established");
    ws.onmessage = (event) => {
      try {
        handleWebSocketMessage(JSON.parse(event.data));
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };
    ws.onerror = (error) => console.error("WebSocket error:", error);
    ws.onclose = () => console.log("WebSocket connection closed");

    return () => ws.close();
  }, [userId, handleWebSocketMessage]);

  const handleSendChatMessage = useCallback(
    (messageText: string, mode: "type" | "speak") => {
      const trimmed = messageText.trim();
      if (!trimmed) {
        return;
      }

      sendWebSocketMessage({
        type: "CHAT_MESSAGE",
        content: JSON.stringify({
          sender: userId,
          message: trimmed,
          mode,
          timestamp: Date.now(),
        }),
      });
    },
    [sendWebSocketMessage, userId]
  );

  const handleTypingChange = useCallback(
    (isTyping: boolean, partialText?: string) => {
      if (lastTypingStateRef.current === isTyping && !partialText) {
        return;
      }

      lastTypingStateRef.current = isTyping;
      sendWebSocketMessage({
        type: "TYPING_STATUS",
        content: JSON.stringify({
          userId,
          isTyping,
          partialText,
        }),
      });
      setState((prevState) => ({
        ...prevState,
        typingIndicators: upsertIndicator(prevState.typingIndicators, {
          userId: userId ?? "local",
          username: "You",
          isTyping,
          partialText,
        }),
      }));
    },
    [sendWebSocketMessage, userId]
  );

  const handleSpeakingChange = useCallback(
    (isSpeaking: boolean) => {
      if (lastSpeakingStateRef.current === isSpeaking) {
        return;
      }

      lastSpeakingStateRef.current = isSpeaking;
      sendWebSocketMessage({
        type: "SPEAKING_STATUS",
        content: JSON.stringify({
          userId,
          isSpeaking,
        }),
      });
      setState((prevState) => ({
        ...prevState,
        typingIndicators: upsertIndicator(prevState.typingIndicators, {
          userId: userId ?? "local",
          username: "You",
          isSpeaking,
        }),
      }));
    },
    [sendWebSocketMessage, userId]
  );

  const renderGameContent = () => (
    <div className="w-screen h-screen flex justify-center items-center">
      {state.loading ? (
        <div className="flex flex-col w-full md:w-1/2 h-4/5 gap-y-2 border rounded justify-center items-center">
          finding a match ....
          {/*TODO: change the state name too*/}
        </div>
      ) : state.gameEnded ? (
        state.gameResult.isReady ? (
          <div className="flex flex-col w-full md:w-1/2 h-4/5 gap-y-2 border rounded justify-center items-center">
            <div>{state.gameResult.isWinner ? "You won!" : "You lost!"}</div>
            <div>
              {`You Got ${state.gameResult.points}/${state.gameResult.totalPoints}`}
            </div>
            <div>{`Evaluation: ${state.gameResult.evaluationMessage}`}</div>
          </div>
        ) : (
          <div className="flex flex-col w-full md:w-1/2 h-4/5 gap-y-2 border rounded justify-center items-center">
            Game Ended
          </div>
        )
      ) : (
        <div className="flex flex-col w-full md:w-1/2 h-4/5 gap-y-2 border rounded">
          <PlayerCard
            isUser={false}
            isTurn={!state.isTurn}
            turnDuration={state.turnDuration}
          />
          <div className="flex flex-col md:flex-row h-full">
            <div className="flex-1 h-full">
              <UserCamera
                cameraOn={true}
                micOn={true}
                sendData={false}
                websocket={websocketRef.current}
              />
            </div>
            <div className="flex-1 h-full">
              <UserCamera
                cameraOn={state.cameraOn}
                micOn={state.micOn}
                sendData={state.isTurn}
                websocket={websocketRef.current}
              />
            </div>
          </div>
          <PlayerCard
            isUser={true}
            cameraOn={state.cameraOn}
            micOn={state.micOn}
            setCameraOn={(value) =>
              setState((prev) => ({
                ...prev,
                cameraOn:
                  typeof value === "function" ? value(prev.cameraOn) : value,
              }))
            }
            setMicOn={(value) =>
              setState((prev) => ({
                ...prev,
                micOn: typeof value === "function" ? value(prev.micOn) : value,
              }))
            }
            isTurn={state.isTurn}
            turnDuration={state.turnDuration}
          />
        </div>
      )}
      <div className="w-full md:w-1/4 h-4/5 flex flex-col border rounded">
        <Chatbox
          messages={state.messages}
          transcriptStatus={state.transcriptStatus}
          onSendMessage={(message, mode) => {
            if (!message.trim()) return;
            const payload = {
              type: "CHAT_MESSAGE",
              content: JSON.stringify({
                sender: userId,
                message,
                mode,
              }),
              timestamp: Date.now(),
            };

            if (
              websocketRef.current &&
              websocketRef.current.readyState === WebSocket.OPEN
            ) {
              websocketRef.current.send(JSON.stringify(payload));
            }

            setState((prev) => ({
              ...prev,
              messages: [...prev.messages, { isUser: true, text: message }],
            }));
          }}
          onTypingChange={(isTyping, partialText) => {
            if (
              !websocketRef.current ||
              websocketRef.current.readyState !== WebSocket.OPEN
            ) {
              return;
            }

            websocketRef.current.send(
              JSON.stringify({
                type: isTyping ? "TYPING_START" : "TYPING_STOP",
                content: JSON.stringify({
                  userId,
                  partialText: isTyping ? partialText : undefined,
                }),
                timestamp: Date.now(),
              })
            );
          }}
          onSpeakingChange={(isSpeaking) => {
            if (
              !websocketRef.current ||
              websocketRef.current.readyState !== WebSocket.OPEN
            ) {
              return;
            }

            websocketRef.current.send(
              JSON.stringify({
                type: isSpeaking ? "SPEAKING_START" : "SPEAKING_STOP",
                content: JSON.stringify({
                  userId,
                }),
                timestamp: Date.now(),
              })
            );
          }}
          typingIndicators={state.typingIndicators}
          isMyTurn={state.isTurn}
          disabled={state.gameEnded || state.loading}
        />
      </div>
    </div>
  );

  return renderGameContent();
};

export default Game;
