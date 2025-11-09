import React, { useState, useEffect, useRef } from "react";
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

  const upsertIndicator = (
    indicators: TypingIndicator[],
    update: {
      userId: string;
      username?: string;
      isTyping?: boolean;
      isSpeaking?: boolean;
      partialText?: string;
    }
  ) => {
    const existing = indicators.find(
      (indicator) => indicator.userId === update.userId
    );
    const nextIndicator: TypingIndicator = {
      userId: update.userId,
      username: update.username ?? existing?.username ?? "Opponent",
      isTyping: update.isTyping ?? existing?.isTyping ?? false,
      isSpeaking: update.isSpeaking ?? existing?.isSpeaking ?? false,
      partialText:
        update.partialText !== undefined
          ? update.partialText
          : existing?.partialText,
    };

    if (
      !nextIndicator.isTyping &&
      !nextIndicator.isSpeaking &&
      !nextIndicator.partialText
    ) {
      return indicators.filter(
        (indicator) => indicator.userId !== update.userId
      );
    }

    const filtered = indicators.filter(
      (indicator) => indicator.userId !== update.userId
    );
    return [...filtered, nextIndicator];
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case "DEBATE_START":
        setState((prevState) => ({ ...prevState, loading: false }));
        break;
      case "DEBATE_END":
        setState((prevState) => ({ ...prevState, gameEnded: true }));
        break;
      case "TURN_START": {
        const { currentTurn, duration } = JSON.parse(message.content);
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
        const { sender, message: chatMessage } = JSON.parse(message.content);
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
      case "TYPING_STATUS": {
        const data = JSON.parse(message.content);
        setState((prevState) => ({
          ...prevState,
          typingIndicators: upsertIndicator(prevState.typingIndicators, {
            userId: data.userId,
            username: data.username,
            isTyping: data.isTyping,
            partialText: data.partialText,
          }),
        }));
        break;
      }
      case "SPEAKING_STATUS": {
        const data = JSON.parse(message.content);
        setState((prevState) => ({
          ...prevState,
          typingIndicators: upsertIndicator(prevState.typingIndicators, {
            userId: data.userId,
            username: data.username,
            isSpeaking: data.isSpeaking,
          }),
        }));
        break;
      }
      case "GENERATING_TRANSCRIPT": {
        const { sender } = JSON.parse(message.content);
        setState((prevState) => ({
          ...prevState,
          transcriptStatus: { loading: true, isUser: sender === userId }, //transcript is getting generated
        }));
        break;
      }

      case "GAME_RESULT": {
        const { winnerUserId, points, totalPoints, evaluationMessage } =
          JSON.parse(message.content);
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
    }
  };

  useEffect(() => {
    const wsURL = `${import.meta.env.VITE_BASE_URL}/ws?userId=${userId}`;
    const ws = new WebSocket(wsURL);
    ws.binaryType = "arraybuffer";
    websocketRef.current = ws;

    ws.onmessage = (event) => handleWebSocketMessage(JSON.parse(event.data));

    return () => ws.close();
  }, [userId]);

  const sendPayload = (type: string, content: Record<string, unknown>) => {
    const ws = websocketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    ws.send(
      JSON.stringify({
        type,
        content: JSON.stringify(content),
      })
    );
  };

  const handleSendChatMessage = (message: string, mode: "type" | "speak") => {
    if (!message.trim()) {
      return;
    }
    sendPayload("CHAT_MESSAGE", {
      sender: userId,
      message,
      mode,
      timestamp: Date.now(),
    });
  };

  const handleTypingChange = (isTyping: boolean, partialText?: string) => {
    sendPayload("TYPING_STATUS", {
      userId,
      isTyping,
      partialText,
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
  };

  const handleSpeakingChange = (isSpeaking: boolean) => {
    sendPayload("SPEAKING_STATUS", {
      userId,
      isSpeaking,
    });
    setState((prevState) => ({
      ...prevState,
      typingIndicators: upsertIndicator(prevState.typingIndicators, {
        userId: userId ?? "local",
        username: "You",
        isSpeaking,
      }),
    }));
  };

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
          onSendMessage={handleSendChatMessage}
          onTypingChange={handleTypingChange}
          onSpeakingChange={handleSpeakingChange}
          typingIndicators={state.typingIndicators}
          isMyTurn={state.isTurn}
          disabled={false}
        />
      </div>
    </div>
  );

  return renderGameContent();
};

export default Game;
