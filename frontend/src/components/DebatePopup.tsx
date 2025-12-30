import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import RoomBrowser from './RoomBrowser';
import Matchmaking from './Matchmaking';

interface DebatePopupProps {
  onClose: () => void;
}

const DebatePopup: React.FC<DebatePopupProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'matchmaking'>(
    'create'
  );

  // Handler to join a debate room by sending the room code via navigation.
  const handleJoinRoom = () => {
    if (roomCode.trim() === '') return;
    navigate(`/debate-room/${roomCode}`);
    onClose();
  };

  // Handler to create a new room by sending a POST request to the backend.
  const handleCreateRoom = async () => {
    const API_BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1313';
    const token = localStorage.getItem('token');

    if (!token) {
      alert('You must be signed in to create a room. Please sign in first.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'public' }),
      });

      if (!response.ok) {
        // Try to parse an error message from the backend
        let errMsg = 'Error creating room.';
        try {
          const payload = await response.json();
          if (payload?.error) errMsg = payload.error;
          else if (payload?.message) errMsg = payload.message;
        } catch (e) {
          // Not JSON, fallback to text
          try {
            const text = await response.text();
            if (text) errMsg = text;
          } catch {}
        }
        console.error('Create room failed:', response.status, errMsg);
        alert(errMsg);
        return;
      }

      const room = await response.json();
      navigate(`/debate-room/${room.id}`);
      onClose();
    } catch (error) {
      console.error('Create room request failed:', error);
      alert('Error creating room. See console for details.');
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
            <button
              onClick={handleCreateRoom}
              className='bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition w-full'
            >
              Create Room
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
            <button
              onClick={handleJoinRoom}
              className='bg-secondary text-secondary-foreground px-6 py-3 rounded-lg hover:bg-secondary/90 transition w-full'
            >
              Join Room
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
