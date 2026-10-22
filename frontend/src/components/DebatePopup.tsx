import config from "../config/config";
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import RoomBrowser from './RoomBrowser';
import Matchmaking from './Matchmaking';

interface DebatePopupProps {
  onClose: () => void;
}

const baseURL = config.baseUrl || 'http://localhost:1313';

const DebatePopup: React.FC<DebatePopupProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'matchmaking'>(
    'create'
  );

  // Handler to join a debate room — redirects via speech-test for audio calibration.
  const handleJoinRoom = async () => {
    const trimmedRoomCode = roomCode.trim();
    if (!trimmedRoomCode) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please sign in again.');
      return;
    }

    try {
      const response = await fetch(
        `${baseURL}/rooms/${encodeURIComponent(trimmedRoomCode)}/join`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        alert(data?.error || 'Unable to join this room.');
        return;
      }

      // Go to speech-test first, then enter debate room
      navigate('/speech-test', {
        state: { roomId: trimmedRoomCode, returnUrl: `/debate-room/${trimmedRoomCode}` },
      });
      onClose();
    } catch {
      alert('Unable to connect to the server.');
    }
  };

  // Handler to create a new room — redirects via speech-test for audio calibration.
  const handleCreateRoom = async () => {
    const token = localStorage.getItem('token');
    try {
      // Sending a POST request to create a new room.
      const response = await fetch(`${baseURL}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // Here we send an example payload with the room type.
        body: JSON.stringify({ type: 'public' }),
      });
      if (!response.ok) {
        alert('Error creating room.');
        return;
      }
      const room = await response.json();
      // Go to speech-test first, then enter the newly created debate room
      navigate('/speech-test', {
        state: { roomId: room.id, returnUrl: `/debate-room/${room.id}` },
      });
      onClose();
    } catch {
      alert('Error creating room.');
    }
  };

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center'>
      {/* Modal Card with a max-height so that it does not exceed the viewport */}
      <div className='relative bg-card text-foreground p-6 rounded-lg shadow-lg w-[42rem] flex flex-col max-h-[100vh]'>
        <button
          onClick={onClose}
          className='absolute top-3 right-3 text-muted-foreground hover:text-foreground'
        >
          <X size={20} />
        </button>

        {/* Tab Navigation */}
        <div className='flex mb-6 border-b border-border'>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'create'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Create Room
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'join'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Join Room
          </button>
          <button
            onClick={() => setActiveTab('matchmaking')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'matchmaking'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🎯 Matchmaking
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'create' && (
          <div className='flex flex-col items-center'>
            <h2 className='text-xl font-semibold mb-3'>Create a Debate</h2>
            <p className='text-muted-foreground text-sm text-center mb-6'>
              Start a new debate and invite others with a unique room code.
            </p>
            <p className='text-xs text-muted-foreground mb-4 bg-primary/10 border border-primary/30 rounded-lg px-4 py-2 text-center'>
              🎤 You'll be taken to a quick <strong>Audio Check</strong> before entering the room.
            </p>
            <button
              onClick={handleCreateRoom}
              className='bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition w-full font-medium'
            >
              Create Room & Check Audio
            </button>
          </div>
        )}

        {activeTab === 'join' && (
          <div className='flex flex-col items-center'>
            <h2 className='text-xl font-semibold mb-3'>Join a Debate</h2>
            <p className='text-muted-foreground text-sm text-center mb-6'>
              Enter a room code to join an ongoing debate.
            </p>
            <input
              type='text'
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder='Enter Room Code'
              className='w-full p-3 border border-border rounded-lg text-center bg-input text-foreground mb-4'
            />
            <p className='text-xs text-muted-foreground mb-4 bg-primary/10 border border-primary/30 rounded-lg px-4 py-2 text-center w-full'>
              🎤 You'll be taken to a quick <strong>Audio Check</strong> before entering the room.
            </p>
            <button
              onClick={handleJoinRoom}
              className='bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition w-full font-medium'
            >
              Join Room & Check Audio
            </button>
          </div>
        )}

        {activeTab === 'matchmaking' && (
          <div className='flex flex-col'>
            <h2 className='text-xl font-semibold mb-3 text-center'>
              Smart Matchmaking
            </h2>
            <p className='text-muted-foreground text-sm text-center mb-6'>
              Get automatically matched with opponents of similar skill level.
            </p>
            <div
              className='overflow-y-auto'
              style={{ maxHeight: 'calc(100vh - 400px)' }}
            >
              <Matchmaking />
            </div>
          </div>
        )}

        {/* RoomBrowser - only show when not in matchmaking tab */}
        {activeTab !== 'matchmaking' && (
          <div
            className='mt-8 overflow-y-auto'
            style={{ maxHeight: 'calc(100vh - 300px)' }}
          >
            <RoomBrowser />
          </div>
        )}
      </div>
    </div>
  );
};

export default DebatePopup;
