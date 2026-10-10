import { useState } from "react";
import { Users, Calendar, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CreateTournamentForm } from "@/components/tournament/CreateTournamentForm";

export interface Tournament {
  id: string;
  title: string;
  maxParticipants: number;
  currentParticipants: number;
  date: string;
  description: string;
}

export default function TournamentPage() {
  const initialTournaments: Tournament[] = [
    {
      id: "1",
      title: "Spring Showdown",
      maxParticipants: 8,
      currentParticipants: 6,
      date: "2025-04-20",
      description:
        "Compete in our annual spring debate championship with top contenders from around the globe.",
    },
    {
      id: "2",
      title: "Summer Slam",
      maxParticipants: 8,
      currentParticipants: 8,
      date: "2025-06-15",
      description:
        "A heated summer debate tournament featuring live audience polls and special guest judges.",
    },
    {
      id: "3",
      title: "Rapid Fire Blitz",
      maxParticipants: 8,
      currentParticipants: 3,
      date: "2025-05-05",
      description:
        "Quick-thinking, lightning round debates — think you can keep up?",
    },
  ];

  const [tournaments, setTournaments] =
    useState<Tournament[]>(initialTournaments);
  const navigate = useNavigate();

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
    const MAX_VISIBLE = 6;
    const visible = Math.min(max, MAX_VISIBLE);
    const overflow = max - MAX_VISIBLE;

    for (let i = 0; i < visible; i++) {
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

    if (overflow > 0) {
      avatars.push(
        <div
          key="overflow"
          className="relative flex-shrink-0"
          style={{ marginLeft: "-1.25rem" }}
        >
          <div className="w-8 h-8 rounded-full bg-muted border-2 border-border flex items-center justify-center text-muted-foreground text-xs font-medium">
            +{overflow}
          </div>
        </div>
      );
    }

    return avatars;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <h1 className="text-4xl sm:text-5xl font-extrabold mb-10 text-center text-primary animate-pulse">
        Tournament Arena
      </h1>
      <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto">
        {/* Left: Dummy Tournament List */}
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
                  className="relative bg-card rounded-xl p-6 border border-border shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-gradient-to-br from-primary/10 to-secondary/10 overflow-hidden flex flex-col"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-bl-full"></div>
                  <h2 className="text-2xl font-bold mb-2 text-card-foreground tracking-tight">
                    {t.title}
                  </h2>
                  <button
                    onClick={() => handleViewBracket(t)}
                    className="flex items-center gap-2 text-primary hover:text-primary/80 transition-all duration-200 mb-3 text-sm font-medium"
                    aria-label="View Tournament Bracket with Logs"
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

        {/* Right: Create Tournament Form */}
        <div className="w-full lg:w-1/3 space-y-8">
          <div className="bg-card rounded-lg border border-border shadow-md p-2">
            <CreateTournamentForm />
          </div>
        </div>
      </div>
    </div>
  );
}