import React from "react";
import { Camera, CameraOff, Mic, MicOff } from "lucide-react";

interface PlayerCardProps {
  isUser: boolean;
  cameraOn?: boolean;
  micOn?: boolean;
  setCameraOn?: (value: boolean) => void;
  setMicOn?: (value: boolean) => void;
  isTurn: boolean;
  turnDuration: number;
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  isUser,
  cameraOn = true,
  micOn = true,
  setCameraOn,
  setMicOn,
  isTurn,
  turnDuration,
}) => {
  // Calculate progress percentage
  const progressPercentage = Math.max(0, Math.min(100, (turnDuration / 60) * 100));

  return (
    <div 
      className={`flex items-center justify-between p-3 ${
        isTurn 
          ? "bg-blue-100 dark:bg-blue-900 border-b border-blue-300 dark:border-blue-700" 
          : "bg-white dark:bg-neutral-800 border-b border-neutral-300 dark:border-neutral-700"
      }`}
    >
      <div className="flex items-center">
        <div className={`font-medium ${isTurn ? "text-blue-700 dark:text-blue-300" : ""}`}>
          {isUser ? "You" : "Opponent"}
        </div>
        {isTurn && (
          <div className="ml-2 px-2 py-0.5 rounded-full bg-blue-500 dark:bg-blue-600 text-white text-xs">
            Speaking
          </div>
        )}
      </div>

      <div className="flex items-center">
        {isTurn && (
          <div className="mr-4 w-32 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-1000"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        )}

        {isUser && setCameraOn && setMicOn ? (
          <>
            <button
              onClick={() => setCameraOn(!cameraOn)}
              className={`p-2 rounded-lg mr-2 ${
                cameraOn
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
                  : "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400"
              }`}
              aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
            >
              {cameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
            </button>
            <button
              onClick={() => setMicOn(!micOn)}
              className={`p-2 rounded-lg ${
                micOn
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
                  : "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400"
              }`}
              aria-label={micOn ? "Turn microphone off" : "Turn microphone on"}
            >
              {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
          </>
        ) : (
          <>
            <div className={`p-2 rounded-lg mr-2 ${cameraOn ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}>
              {cameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
            </div>
            <div className={`p-2 rounded-lg ${micOn ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}>
              {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PlayerCard;