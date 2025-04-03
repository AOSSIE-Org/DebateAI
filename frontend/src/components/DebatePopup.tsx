import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

interface DebatePopupProps {
  onClose: () => void;
}

const DebatePopup: React.FC<DebatePopupProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");

  const generateRoomCode = () => Math.random().toString(36).substring(2, 8);

  const handleJoinRoom = () => {
    if (roomCode.trim() === "") return;
    navigate(`/debate-room/${roomCode}`);
    onClose();
  };

  const handleCreateRoom = () => {
    const newRoomCode = generateRoomCode();
    navigate(`/debate-room/${newRoomCode}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="relative bg-card text-foreground p-6 rounded-lg shadow-lg w-[32rem] flex flex-col">
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col sm:flex-row">
          <div className="w-full sm:w-1/2 border-r border-border pr-4 flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-3">Create a Debate</h2>
            <p className="text-muted-foreground text-sm text-center mb-4">
              Start a new debate and invite others with a unique room code.
            </p>
          </div>

          <div className="w-full sm:w-1/2 pl-4 flex flex-col items-center mt-4 sm:mt-0">
            <h2 className="text-xl font-semibold mb-3">Join a Debate</h2>
            <p className="text-muted-foreground text-sm text-center mb-4">
              Enter a room code to join an ongoing debate.
            </p>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Enter Room Code"
              className="w-full p-2 border border-border rounded-lg text-center bg-input text-foreground"
            />
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <button
            onClick={handleCreateRoom}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition w-1/2 mr-2"
          >
            Create Room
          </button>
          <button
            onClick={handleJoinRoom}
            className="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg hover:bg-secondary/90 transition w-1/2"
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebatePopup;
