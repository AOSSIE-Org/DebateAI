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
  const [devilAdvocateEnabled, setDevilAdvocateEnabled] = useState(false);
  const [devilAdvocateFrequency, setDevilAdvocateFrequency] = useState(5);

  // Handler to join a debate room by sending the room code via navigation.
  const handleJoinRoom = () => {
    if (roomCode.trim() === '') return;
    navigate(`/debate-room/${roomCode}`);
    onClose();
  };

  // Handler to create a new room by sending a POST request to the backend.
  const handleCreateRoom = async () => {
    const token = localStorage.getItem('token');
    try {
      // Sending a POST request to create a new room.
      // You might also send additional parameters (e.g., room type, settings).
      const response = await fetch('http://localhost:1313/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // Here we send an example payload with the room type.
        body: JSON.stringify({
          type: 'public',
          devilAdvocateEnabled,
          devilAdvocateFrequency,
        }),
      });
      if (!response.ok) {
        alert('Error creating room.');
        return;
      }
      const room = await response.json();
      navigate(`/debate-room/${room.id}`);
      onClose();
    } catch (error) {
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
            className={`px-4 py-2 font-medium transition ${activeTab === 'create'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Create Room
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={`px-4 py-2 font-medium transition ${activeTab === 'join'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            Join Room
          </button>
          <button
            onClick={() => setActiveTab('matchmaking')}
            className={`px-4 py-2 font-medium transition ${activeTab === 'matchmaking'
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

            {/* AI Devil's Advocate Settings */}
            <div className='w-full mb-6 p-4 border border-border rounded-lg bg-secondary/10'>
              <div className='flex items-center justify-between mb-4'>
                <div className='flex flex-col'>
                  <span className='font-medium'>AI Devil's Advocate</span>
                  <span className='text-xs text-muted-foreground'>
                    AI periodically asks neutral, critical questions.
                  </span>
                </div>
                <label className='relative inline-flex items-center cursor-pointer'>
                  <input
                    type='checkbox'
                    className='sr-only peer'
                    checked={devilAdvocateEnabled}
                    onChange={(e) => setDevilAdvocateEnabled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {devilAdvocateEnabled && (
                <div className='flex items-center justify-between animate-in fade-in slide-in-from-top-1'>
                  <span className='text-sm font-medium'>Frequency</span>
                  <div className='flex items-center space-x-2'>
                    <input
                      type='number'
                      min='3'
                      max='20'
                      value={devilAdvocateFrequency}
                      onChange={(e) =>
                        setDevilAdvocateFrequency(parseInt(e.target.value))
                      }
                      className='w-16 p-1 text-center bg-input border border-border rounded'
                    />
                    <span className='text-xs text-muted-foreground'>
                      messages
                    </span>
                  </div>
                </div>
              )}
            </div>

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
