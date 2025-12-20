import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { FiCamera, FiCameraOff } from "react-icons/fi";
import { IoMdMic, IoMdMicOff } from "react-icons/io";
import Timer from "./Timer";
import avatar1 from "../assets/avatar2.jpg"; // Adjust the path as necessary

interface PlayerCardProps {
  isUser: boolean;
  cameraOn?: boolean;
  micOn?: boolean;
  setCameraOn?: React.Dispatch<React.SetStateAction<boolean>>;
  setMicOn?: React.Dispatch<React.SetStateAction<boolean>>;
  isTurn: boolean;
  turnDuration?: number;
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  isUser,
  cameraOn = true,
  micOn = true,
  setCameraOn,
  setMicOn,
  isTurn,
  turnDuration = 0,
}) => {
  return (
    <div className="flex justify-between items-center border rounded w-full p-2 ">
      {/* Player Details Section */}
      <div className="flex items-center">
        <Avatar className="bg-primary mx-2">
          <AvatarImage src={avatar1} alt="@name" className="object-cover" />
          <AvatarFallback>SL</AvatarFallback>
        </Avatar>
        <span>Sofia Dev</span>
        <Separator orientation="vertical" className="mx-2 h-5 bg-muted" />
        <span>1000</span>
      </div>
      {/* Icons for user */}
      {isUser && (
        <div className="flex items-center gap-x-2">
          <button onClick={() => setCameraOn && setCameraOn((prev) => !prev)}>
            {cameraOn ? <FiCamera size={24} /> : <FiCameraOff size={24} />}
          </button>
          <button onClick={() => setMicOn && setMicOn((prev) => !prev)}>
            {micOn ? <IoMdMic size={24} /> : <IoMdMicOff size={24} />}
          </button>
        </div>
      )}
      {/* Timer */}
      <Timer key={isTurn ? 'turn' : 'not-turn'} initialTime={isTurn ? turnDuration : 0} />
    </div>
  );
};

export default PlayerCard;
