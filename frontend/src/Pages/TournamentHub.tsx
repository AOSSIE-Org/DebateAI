// TournamentHub.tsx
import React, { useState, useEffect, FormEvent } from 'react';
import { Users, Calendar, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface Tournament {
  id: string;
  name: string;
  maxParticipants: number;
  currentParticipants: number;
  date: string;
  description: string;
}

export default function TournamentPage() {
  const initialTournaments: Tournament[] = [
    {
      id: "1",
      name: "Spring Showdown",
      maxParticipants: 8,
      currentParticipants: 6,
      date: "2025-04-20",
      description:
        "Compete in our annual spring debate championship with top contenders from around the globe.",
    },
    {
      id: "2",
      name: "Summer Slam",
      maxParticipants: 8,
      currentParticipants: 8,
      date: "2025-06-15",
      description:
        "A heated summer debate tournament featuring live audience polls and special guest judges.",
    },
    {
      id: "3",
      name: "Rapid Fire Blitz",
      maxParticipants: 8,
      currentParticipants: 3,
      date: "2025-05-05",
      description:
        "Quick-thinking, lightning round debates — think you can keep up?",
    },
  ];

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setTournaments(initialTournaments);
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name) {
      setError("Tournament name is required.");
      return;
    }

    const newTournament: Tournament = {
      id: Date.now().toString(),
      name,
      maxParticipants: 8,
      currentParticipants: 0,
      date,
      description,
    };

    setTournaments([newTournament, ...tournaments]);
    setName("");
    setDate("");
    setDescription("");
    setError("");
  };

  const handleJoin = (tournament: Tournament) => {
    if (tournament.currentParticipants < tournament.maxParticipants) {
      const updatedTournaments = tournaments.map((t) =>
        t.id === tournament.id
          ? { ...t, currentParticipants: t.currentParticipants + 1 }
          : t
      );
      setTournaments(updatedTournaments);
      const updatedTournament = updatedTournaments.find(
        (t) => t.id === tournament.id
      );
      if (updatedTournament) {
        navigate(`/tournament/${tournament.id}/bracket`, {
          state: { tournament: updatedTournament },
        });
      }
    }
  };

  const handleViewBracket = (tournament: Tournament) => {
    navigate(`/tournament/${tournament.id}/bracket`, { state: { tournament } });
  };

  const renderAvatars = (current: number, max: number) => {
    const avatars = [];
    for (let i = 0; i < max; i++) {
      const isActive = i < current;
      avatars.push(
        <div
          key={i}
          className="relative flex-shrink-0"
          style={{ marginLeft: i > 0 ? "-1.25rem" : "0" }}
        >
          {isActive ? (
            <img
              src={`https://i.pravatar.cc/32?u=${i}`}
              alt="Participant"
              className="w-8 h-8 rounded-full border-2 border-primary bg-background"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted border-2 border-border flex items-center justify-center text-muted-foreground text-xs">
              ?
            </div>
          )}
        </div>
      );
    }
    return avatars;
  };

  if (isLoading) {
    // Skeleton Loader
    return (
      <div className="min-h-screen bg-background text-foreground py-12">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-10 text-center text-primary animate-pulse">
          Tournament Arena
        </h1>
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card rounded-xl p-6 border border-border animate-pulse">
                <div className="h-8 bg-muted rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-muted rounded w-1/2 mb-6"></div>
                <div className="h-4 bg-muted rounded w-full mb-2"></div>
                <div className="h-4 bg-muted rounded w-5/6 mb-6"></div>
                <div className="h-10 bg-muted rounded-md w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Actual Tournament Hub Page
  return (
    <div className="min-h-screen bg-background text-foreground">
      <h1 className="text-4xl sm:text-5xl font-extrabold mb-10 text-center text-primary animate-pulse">
        Tournament Arena
      </h1>
      <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto">
        {/* Tournament Cards */}
        <div className="flex-1">
          {tournaments.length === 0 ? (
            <p className="text-center text-muted-foreground text-lg">
              No live tournaments yet. Create one to start the debate!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournaments.map((t) => (
                <div
                  key={t.id}
                  className="relative bg-card rounded-xl p-6 border border-border shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-gradient-to-br from-primary/10 to-secondary/10 overflow-visible flex flex-col"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-bl-full"></div>
                  <h2 className="text-2xl font-bold mb-2 text-accent-foreground tracking-tight">
                    {t.name}
                  </h2>
                  <button
                    onClick={() => handleViewBracket(t)}
                    className="flex items-center gap-2 text-primary hover:text-primary/80 transition-all duration-200 mb-3 text-sm font-medium"
                  >
                    <Eye className="w-5 h-5" />
                    Spectate
                  </button>
                  <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>{new Date(t.date).toLocaleDateString()}</span>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-primary" />
                      <span>
                        {t.currentParticipants}/{t.maxParticipants} Participants
                      </span>
                    </div>
                    <div className="flex mt-2 px-4">
                      {renderAvatars(t.currentParticipants, t.maxParticipants)}
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            (t.currentParticipants / t.maxParticipants) * 100
                          }%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-base text-foreground mb-4">
                    {t.description}
                  </p>
                  <button
                    onClick={() => handleJoin(t)}
                    className="w-full bg-primary text-primary-foreground py-2.5 rounded-md hover:bg-primary/90 transition-colors duration-200 font-semibold disabled:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground mt-auto"
                    disabled={t.currentParticipants >= t.maxParticipants}
                  >
                    {t.currentParticipants >= t.maxParticipants
                      ? "Full"
                      : "Join Tournament"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Tournament Form */}
        <div className="w-full lg:w-1/3 space-y-8">
          <div className="bg-popover rounded-lg p-6 border border-border shadow-md">
            <h2 className="text-2xl font-semibold mb-6 text-foreground">
              Create New Tournament
            </h2>
            {error && (
              <p className="text-destructive mb-4 bg-destructive/10 p-2 rounded-md">
                {error}
              </p>
            )}
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Tournament Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 block w-full border border-input rounded-md p-3 bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  placeholder="e.g. Autumn Argument Arena"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="mt-1 block w-full border border-input rounded-md p-3 bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="mt-1 block w-full border border-input rounded-md p-3 bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent transition"
                  placeholder="Describe your epic tournament..."
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary text-primary-foreground font-medium rounded-lg px-4 py-3 hover:bg-primary/90 transition-colors duration-200 transform hover:scale-105"
              >
                Create Tournament
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
