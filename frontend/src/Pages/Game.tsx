import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import PlayerCard from "../components/PlayerCard";
import UserCamera from "../components/UserCamera";
import Chatbox, { ChatMessage } from "../components/Chatbox";

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
      points: 0,
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
    cameraError: false,
  });

  const websocketRef = useRef<WebSocket | null>(null);

  // Camera initialization and error handling
  useEffect(() => {
    const initCamera = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (error) {
        console.error("Camera access error:", error);
        setState(prev => ({ ...prev, cameraError: true, cameraOn: false }));
      }
    };

    initCamera();
  }, []);

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
        }));
        break;
      }
      case "GENERATING_TRANSCRIPT": {
        const { sender } = JSON.parse(message.content);
        setState((prevState) => ({
          ...prevState,
          transcriptStatus: { loading: true, isUser: sender === userId },
        }));
        break;
      }
      case "GAME_RESULT": {
        const { winnerUserId, points, totalPoints, evaluationMessage } = JSON.parse(message.content);
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
  };

  useEffect(() => {
    const wsURL = `${import.meta.env.VITE_BASE_URL}/ws?userId=${userId}`;
    const ws = new WebSocket(wsURL);
    ws.binaryType = "arraybuffer";
    websocketRef.current = ws;

    ws.onopen = () => console.log("WebSocket connection established");
    ws.onmessage = (event) => handleWebSocketMessage(JSON.parse(event.data));
    ws.onerror = (error) => console.error("WebSocket error:", error);
    ws.onclose = () => console.log("WebSocket connection closed");

    return () => ws.close();
  }, [userId]);

  // Handle camera toggle with error recovery attempt
  const handleCameraToggle = async (value: boolean) => {
    if (value && state.cameraError) {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setState(prev => ({ ...prev, cameraError: false, cameraOn: true }));
      } catch (error) {
        console.error("Camera access still failed:", error);
        setState(prev => ({ ...prev, cameraError: true, cameraOn: false }));
      }
    } else {
      setState(prev => ({ ...prev, cameraOn: value }));
    }
  };

  const renderGameContent = () => (
    <div className="w-screen h-screen flex justify-center items-center bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200">
      {state.loading ? (
        <div className="flex flex-col w-full md:w-1/2 h-4/5 gap-y-2 border border-blue-400 dark:border-blue-600 rounded justify-center items-center bg-white dark:bg-neutral-800 shadow-md">
          <div className="text-blue-600 dark:text-blue-400 font-semibold">Finding a match...</div>
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        </div>
      ) : state.gameEnded ? (
        state.gameResult.isReady ? (
          <div className="flex flex-col w-full md:w-1/2 h-4/5 gap-y-4 border border-blue-400 dark:border-blue-600 rounded justify-center items-center bg-white dark:bg-neutral-800 p-6 shadow-md">
            <div className={`text-2xl font-bold ${state.gameResult.isWinner ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {state.gameResult.isWinner ? "You won!" : "You lost!"}
            </div>
            <div className="text-xl">
              {`You Got ${state.gameResult.points}/${state.gameResult.totalPoints}`}
            </div>
            <div className="text-center mt-4 p-4 bg-neutral-100 dark:bg-neutral-700 rounded">{`Evaluation: ${state.gameResult.evaluationMessage}`}</div>
          </div>
        ) : (
          <div className="flex flex-col w-full md:w-1/2 h-4/5 gap-y-2 border border-blue-400 dark:border-blue-600 rounded justify-center items-center bg-white dark:bg-neutral-800 shadow-md">
            <div className="text-xl">Game Ended</div>
          </div>
        )
      ) : (
        <div className="flex flex-col w-full md:w-1/2 h-4/5 gap-y-2 border border-blue-400 dark:border-blue-600 rounded bg-white dark:bg-neutral-800 shadow-md overflow-hidden">
          <PlayerCard
            isUser={false}
            isTurn={!state.isTurn}
            turnDuration={state.turnDuration}
          />
          <div className="flex flex-col md:flex-row h-full">
            <div className="flex-1 h-full border-r border-blue-200 dark:border-blue-800">
              <UserCamera
                cameraOn={true}
                micOn={true}
                sendData={false}
                websocket={websocketRef.current}
              />
            </div>
            <div className="flex-1 h-full relative">
              <UserCamera
                cameraOn={state.cameraOn}
                micOn={state.micOn}
                sendData={state.isTurn}
                websocket={websocketRef.current}
              />
              {state.cameraError && !state.cameraOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 dark:bg-neutral-700 bg-opacity-90 dark:bg-opacity-90">
                  <div className="text-center p-4">
                    <div className="text-red-600 dark:text-red-400 font-bold mb-2">Camera access error</div>
                    <button 
                      onClick={() => handleCameraToggle(true)}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      Retry Camera Access
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <PlayerCard
            isUser={true}
            cameraOn={state.cameraOn}
            micOn={state.micOn}
            setCameraOn={handleCameraToggle}
            setMicOn={(value) =>
              setState((prev) => ({ ...prev, micOn: value }))
            }
            isTurn={state.isTurn}
            turnDuration={state.turnDuration}
          />
        </div>
      )}
      <div className="w-full md:w-1/4 h-4/5 flex flex-col border border-blue-400 dark:border-blue-600 rounded ml-4 bg-white dark:bg-neutral-800 shadow-md">
        <Chatbox
          messages={state.messages}
          transcriptStatus={state.transcriptStatus}
        />
      </div>
    </div>
  );

  return renderGameContent();
};

export default Game;