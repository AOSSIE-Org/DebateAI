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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      if (!Array.isArray(data)) return;

      setRooms(
        data.map((room: Room) => ({
          ...room,
          participants: room.participants ?? [],
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleJoinMatch = async (roomId: string) => {
    const token = localStorage.getItem('token');

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

    if (response.ok) {
      navigate(`/debate-room/${roomId}`);
    } else {
      alert('Failed to join room');
    }
  };

  const handleViewDebate = (roomId: string) => {
    navigate(`/view-debate/${roomId}`);
  };

  const getAverageElo = (participants: Participant[] | null) => {
    if (!participants || participants.length === 0) return '--';
    const total = participants.reduce((sum, p) => sum + p.elo, 0);
    return Math.round(total / participants.length);
  };

  return (
    <div className="p-6 bg-card rounded-lg shadow-2xl">
      <h2 className="text-3xl font-bold text-center mb-6">
        Browse Live Debate Rooms
      </h2>

      {loading ? (
        <p className="text-center">Loading rooms...</p>
      ) : rooms.length === 0 ? (
        <p className="text-center">No rooms available</p>
      ) : (
        <>
          {/* ===================== */}
          {/* 📱 Mobile Card Layout */}
          {/* ===================== */}
          <div className="sm:hidden space-y-4">
            {rooms.map((room) => {
              const members = room.participants?.length ?? 0;
              return (
                <div
                  key={room.id}
                  className="border border-border rounded-lg p-4 bg-background shadow"
                >
                  <p className="text-xs text-muted-foreground">Room ID</p>
                  <p className="font-mono break-all mb-2">{room.id}</p>

                  <div className="flex justify-between text-sm mb-1">
                    <span>Type</span>
                    <span className="font-semibold">
                      {room.type.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm mb-1">
                    <span>Members</span>
                    <span>{members || 'Empty'}</span>
                  </div>

                  <div className="flex justify-between text-sm mb-4">
                    <span>Avg Elo</span>
                    <span>{getAverageElo(room.participants)}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleJoinMatch(room.id)}
                      className="flex-1 bg-primary text-primary-foreground py-2 rounded"
                    >
                      Join
                    </button>
                    <button
                      onClick={() => handleViewDebate(room.id)}
                      className="flex-1 bg-secondary text-secondary-foreground py-2 rounded"
                    >
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===================== */}
          {/* 🖥 Desktop Table View */}
          {/* ===================== */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-popover uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Room ID</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Members</th>
                  <th className="px-6 py-3">Avg Elo</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room, index) => {
                  const members = room.participants?.length ?? 0;
                  return (
                    <tr
                      key={room.id}
                      className={`border-b ${
                        index % 2 === 0 ? 'bg-popover' : 'bg-background'
                      }`}
                    >
                      <td className="px-6 py-4 font-mono">{room.id}</td>
                      <td className="px-6 py-4">
                        {room.type.toUpperCase()}
                      </td>
                      <td className="px-6 py-4">
                        {members || 'Empty'}
                      </td>
                      <td className="px-6 py-4">
                        {getAverageElo(room.participants)}
                      </td>
                      <td className="px-6 py-4 flex gap-2">
                        <button
                          onClick={() => handleJoinMatch(room.id)}
                          className="bg-primary text-primary-foreground px-4 py-2 rounded"
                        >
                          Join
                        </button>
                        <button
                          onClick={() => handleViewDebate(room.id)}
                          className="bg-secondary text-secondary-foreground px-4 py-2 rounded"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default RoomBrowser;
