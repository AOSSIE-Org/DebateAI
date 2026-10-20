import { useEffect, useState } from "react";
import { Users, Calendar, Eye, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/useUser";
import { CreateTournamentForm } from "@/components/tournament/CreateTournamentForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getTournaments,
  joinPublicTournament,
  type Tournament as ApiTournament,
} from "@/services/tournamentService";

type TournamentStatus = "live" | "upcoming";
const STATUS_LABELS: Record<ApiTournament["status"], string> = {
  live: "Live",
  upcoming: "Upcoming",
  completed: "Completed",
};

export default function TournamentPage() {
  const [tournaments, setTournaments] = useState<ApiTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | "all">(
    "all"
  );
  const navigate = useNavigate();
  const { user } = useUser();
  const loadTournaments = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getTournaments();
      setTournaments(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load tournaments."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTournaments();
  }, []);

  const visibleTournaments = tournaments.filter(
    (t) =>
      t.status !== "completed" &&
      (statusFilter === "all" || t.status === statusFilter)
  );

  const pastTournaments = tournaments.filter(
    (t) => t.status === "completed"
  );

  const handleJoin = async (tournament: ApiTournament) => {
    try {
      setError(null);

      await joinPublicTournament(tournament.id);

      await loadTournaments();

      navigate(`/tournament/${tournament.id}/bracket`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to join tournament."
      );
    }
  };

  const handleViewBracket = (tournament: ApiTournament) => {
    navigate(`/tournament/${tournament.id}/bracket`);
  };

  const renderAvatars = (
    participants: ApiTournament["participants"],
    max: number
  ) => {
    const avatars = [];
    const MAX_VISIBLE = 6;
    const visible = Math.min(max, MAX_VISIBLE);
    const overflow = Math.max(max - MAX_VISIBLE, 0);

    for (let i = 0; i < visible; i++) {
      const participant = participants[i];

      avatars.push(
        <div
          key={participant?.userId ?? `empty-${i}`}
          className="relative flex-shrink-0"
          style={{ marginLeft: i > 0 ? "-1.25rem" : "0" }}
        >
          {participant ? (
            <div
              title={participant.name}
              className="w-8 h-8 rounded-full border-2 border-primary bg-card flex items-center justify-center text-xs font-semibold text-foreground"
            >
              {participant.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
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
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 max-w-7xl mx-auto mb-6 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-primary animate-pulse">
          Tournament Arena
        </h1>
        <Select
          value={statusFilter}
          onValueChange={(val) =>
            setStatusFilter(val as TournamentStatus | "all")
          }
        >
          <SelectTrigger
            className="w-32 h-9 px-3 bg-background text-foreground border-border"
            aria-label="Filter tournaments"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="live">{STATUS_LABELS.live}</SelectItem>
            <SelectItem value="upcoming">{STATUS_LABELS.upcoming}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto">
        {/* Left: Tournament List */}
        <div className="flex-1">
          {loading && (
            <p className="mb-4 text-muted-foreground">
              Loading tournaments...
            </p>
          )}

          {error && (
            <p className="mb-4 text-destructive">
              {error}
            </p>
          )}
          {visibleTournaments.length === 0 ? (
            <p className="text-center text-muted-foreground text-lg">
              {statusFilter === "all"
                ? "No tournaments available yet."
                : `No ${statusFilter} tournaments available yet.`}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleTournaments.map((t) => {
                const isParticipant = t.participants.some(
                  (participant) => participant.userId === user?.id
                );

                const isHost = t.hostId === user?.id;
                const isFull = t.participants.length >= t.maxParticipants;

                return (
                <div
                  key={t.id}
                  className="relative bg-card rounded-xl p-6 border border-border shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-gradient-to-br from-primary/10 to-secondary/10 overflow-hidden flex flex-col"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-primary/20 rounded-bl-full"></div>
                  {t.status && (
                    <span className="self-start mb-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary text-primary-foreground">
                      {STATUS_LABELS[t.status]}
                    </span>
                  )}
                  <h2 className="text-2xl font-bold mb-2 text-card-foreground tracking-tight">
                    {t.topic} 
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
                    <span>
                      {new Date(t.scheduleAt ?? t.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-primary" />
                      <span>
                        {t.participants.length}/{t.maxParticipants} Participants
                      </span>
                    </div>
                    <div className="flex mt-2 px-4">
                      {renderAvatars(t.participants, t.maxParticipants)}
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${
                            (t.participants.length / t.maxParticipants) * 100
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
                    disabled={
                      isHost ||
                      isParticipant ||
                      isFull ||
                      t.status !== "upcoming"
                    }
                  >
                    {isHost
                      ? "Hosting"
                      : isParticipant
                        ? "Joined"
                        : isFull
                          ? "Full"
                          : t.status === "live"
                            ? "In Progress"
                            : "Join Tournament"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

          {/* Past Tournaments */}
          <section className="mt-12">
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                  Past Tournaments
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Relive the battles and see who claimed the crown.
                </p>
              </div>
              <span className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary">
                {pastTournaments.length} completed
              </span>
            </div>
            <div className="space-y-4">
              {pastTournaments.map((t) => (
                <div
                  key={t.id}
                  className="group relative overflow-hidden flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 bg-card bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl border border-border shadow-lg hover:shadow-2xl hover:border-primary/60 transition-all duration-300 transform hover:-translate-y-1"
                >
                  <div className="absolute -top-6 -right-6 w-20 h-20 bg-primary/20 rounded-full"></div>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 ring-2 ring-primary/40 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      <Trophy className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-card-foreground tracking-tight truncate">
                          {t.topic}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                          Completed
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-primary" />
                          {new Date(t.scheduleAt ?? t.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-primary" />
                          {t.participants.length} Participants
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="relative w-full sm:w-auto flex-shrink-0 bg-primary text-primary-foreground px-5 py-2.5 rounded-md hover:bg-primary/90 transition-colors duration-200 font-semibold text-sm"
                  >
                    View Tournament
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Create Tournament Form */}
        <div className="w-full lg:w-1/3 space-y-8">
          <div className="bg-card rounded-lg border border-border shadow-md p-2">
            <CreateTournamentForm/>
          </div>
        </div>
      </div>
    </div>
  );
}
