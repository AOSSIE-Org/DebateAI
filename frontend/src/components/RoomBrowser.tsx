import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Participant {
  id: string;
  username: string;
  elo: number;
}

interface Room {
  id: string;
  type: 'public' | 'private' | 'invite';
  participants: Participant[] | null;
}

const RoomBrowser: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRooms = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://localhost:1313/rooms', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        setLoading(false);
        return;
      }
      const data = await response.json();
      if (!data || !Array.isArray(data)) {
        setRooms([]);
        return;
      }

      // Ensure each room has participants as an array
      const normalizedRooms = data.map((room: Room) => ({
        ...room,
        participants: room.participants ?? [],
      }));

      setRooms(normalizedRooms);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000); // Poll every 10 seconds as specified
    return () => clearInterval(interval);
  }, []);

  const handleJoinMatch = async (roomId: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(
        `http://localhost:1313/rooms/${roomId}/join`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        alert(`Failed to join room ${roomId}.`);
        return;
      }
      navigate(`/debate-room/${roomId}`);
    } catch (error) {
      alert('An error occurred while joining the match.');
    }
  };

  const handleViewDebate = (roomId: string) => {
    // Navigate to the View Debate page for spectator mode
    navigate(`/view-debate/${roomId}`);
  };

  const getAverageElo = (participants: Participant[] | null): number => {
    if (!participants || participants.length === 0) return 0;
    const total = participants.reduce((sum, p) => sum + p.elo, 0);
    return Math.round(total / participants.length);
  };

  return (
    <div className='room-browser p-6 bg-card rounded-lg shadow-2xl'>
      <h2 className='text-3xl font-bold text-foreground mb-6 text-center'>
        Browse Live Debate Rooms
      </h2>
      {loading ? (
        <p className='text-center text-foreground'>Loading rooms...</p>
      ) : rooms.length === 0 ? (
        <p className='text-center text-foreground'>
          No rooms available at the moment.
        </p>
      ) : (
        <div className='overflow-x-auto'>
          <table className='min-w-full text-sm text-left text-foreground'>
            <thead className='bg-popover text-xs uppercase font-semibold'>
              <tr>
                <th className='px-6 py-3 border-b border-border'>Room ID</th>
                <th className='px-6 py-3 border-b border-border'>Room Type</th>
                <th className='px-6 py-3 border-b border-border'>Members</th>
                <th className='px-6 py-3 border-b border-border'>Avg. Elo</th>
                <th className='px-6 py-3 border-b border-border'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((room, index) => {
                const memberCount = room.participants?.length || 0;
                const avgElo = getAverageElo(room.participants);
                return (
                  <tr
                    key={room.id}
                    className={`border-b border-border ${
                      index % 2 === 0 ? 'bg-popover' : 'bg-background'
                    } hover:bg-muted transition-colors`}
                  >
                    <td className='px-6 py-4 font-medium'>{room.id}</td>
                    <td className='px-6 py-4'>{room.type.toUpperCase()}</td>
                    <td className='px-6 py-4'>
                      {memberCount > 0 ? (
                        <span className='font-semibold'>{memberCount}</span>
                      ) : (
                        <span className='italic text-destructive'>Empty</span>
                      )}
                    </td>
                    <td className='px-6 py-4'>
                      {memberCount > 0 ? avgElo : '--'}
                    </td>
                    <td className='px-6 py-4 flex flex-col sm:flex-row gap-2'>
                      <button
                        onClick={() => handleJoinMatch(room.id)}
                        className='bg-primary text-primary-foreground py-2 px-4 rounded shadow hover:bg-primary/90 transition'
                      >
                        Join Match
                      </button>
                      <button
                        onClick={() => handleViewDebate(room.id)}
                        className='bg-secondary text-secondary-foreground py-2 px-4 rounded shadow hover:bg-secondary/90 transition flex items-center gap-1'
                      >
                        {/* Inline SVG icon for debate (e.g., chat bubble icon) */}
                        <svg
                          xmlns='http://www.w3.org/2000/svg'
                          className='h-5 w-5'
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                          />
                        </svg>
                        View Debate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RoomBrowser;
