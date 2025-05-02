import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import RoomBrowser from "./RoomBrowser";

interface DebatePopupProps {
  onClose: () => void;
}

const DebatePopup: React.FC<DebatePopupProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");

  // Handler to join a debate room by sending the room code via navigation.
  const handleJoinRoom = () => {
    if (roomCode.trim() === "") return;
    navigate(`/debate-room/${roomCode}`);
    onClose();
  };

  // Handler to create a new room by sending a POST request to the backend.
  const handleCreateRoom = async () => {
    const token = localStorage.getItem("token");
    try {
      // Sending a POST request to create a new room.
      // You might also send additional parameters (e.g., room type, settings).
      const response = await fetch("http://localhost:1313/rooms", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
         },
        // Here we send an example payload with the room type.
        body: JSON.stringify({ type: "public" }),
      });
      if (!response.ok) {
        alert("Error creating room.");
        return;
      }
      const room = await response.json();
      navigate(`/debate-room/${room.id}`);
      onClose();
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Error creating room.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      {/* Modal Card with a max-height so that it does not exceed the viewport */}
      <div className="relative bg-card text-foreground p-6 rounded-lg shadow-lg w-[42rem] flex flex-col max-h-[100vh]">
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

        {/* RoomBrowser wrapped in a scrollable container that kicks in once the height reaches 100vh */}
        <div
          className="mt-8 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 300px)" }}
        >
          <RoomBrowser />
        </div>
      </div>
    </div>
  );
};

export default DebatePopup;
