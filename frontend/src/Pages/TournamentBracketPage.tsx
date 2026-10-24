import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getTournamentById,
  type Tournament,
  type TournamentParticipant,
} from "@/services/tournamentService";

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const Participant = ({
  participant,
}: {
  participant?: TournamentParticipant;
}) => {
  if (!participant) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full border-2 border-dashed border-border bg-muted flex items-center justify-center text-muted-foreground">
          ?
        </div>
        <span className="text-xs text-muted-foreground">Open slot</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        title={participant.name}
        className="w-10 h-10 rounded-full border-2 border-primary bg-card flex items-center justify-center text-xs font-semibold text-foreground"
      >
        {getInitials(participant.name)}
      </div>

      <span className="text-xs text-foreground text-center">
        {participant.name}
      </span>

      {participant.stance && (
        <span className="text-[10px] text-muted-foreground capitalize">
          {participant.stance}
        </span>
      )}
    </div>
  );
};

/**
 * Displays participants for the tournament selected by the route ID.
 */
export default function TournamentBracket() {
  const { id } = useParams<{ id: string }>();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Tournament ID is missing.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadTournament = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await getTournamentById(id);

        if (!cancelled) {
          setTournament(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load tournament."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadTournament();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
        Loading tournament...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">
        Tournament not found.
      </div>
    );
  }

  const slots = Array.from(
    { length: tournament.maxParticipants },
    (_, index) => tournament.participants[index]
  );

  const firstRoundMatches = [];

  for (let index = 0; index < slots.length; index += 2) {
    firstRoundMatches.push({
      player1: slots[index],
      player2: slots[index + 1],
      hasSecondSlot: index + 1 < slots.length,
      isBye: index + 1 >= slots.length && Boolean(slots[index]),
      matchNumber: index / 2 + 1,
    });
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
          {tournament.topic}
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          {tournament.description}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-sm">
          <span className="px-3 py-1 rounded-full bg-primary/20 text-primary capitalize">
            {tournament.status}
          </span>

          <span className="text-muted-foreground">
            {tournament.participants.length}/{tournament.maxParticipants} participants
          </span>

          {tournament.scheduleAt && (
            <span className="text-muted-foreground">
              {new Date(tournament.scheduleAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {tournament.status === "upcoming" && (
        <div className="mb-8 rounded-lg border border-border bg-card p-4 text-center">
          <h3 className="font-semibold text-foreground">
            Bracket has not started yet
          </h3>

          <p className="text-sm text-muted-foreground mt-1">
            Participants will fill the available tournament slots as they join.
          </p>
        </div>
      )}

      {tournament.status === "live" && (
        <div className="mb-8 rounded-lg border border-border bg-card p-4 text-center">
          <h3 className="font-semibold text-foreground">
            Tournament is live
          </h3>

          <p className="text-sm text-muted-foreground mt-1">
            Showing the real registered participants for this tournament.
          </p>
        </div>
      )}

      {tournament.status === "completed" && (
        <div className="mb-8 rounded-lg border border-border bg-card p-4 text-center">
          <h3 className="font-semibold text-foreground">
            Tournament completed
          </h3>

          <p className="text-sm text-muted-foreground mt-1">
            The current tournament API does not yet provide persisted match winners
            or champion data, so no winner is fabricated here.
          </p>
        </div>
      )}

      <div>
        <h3 className="text-xl font-bold text-foreground mb-6 text-center">
          First Round
        </h3>

        {tournament.participants.length === 0 && (
          <p className="text-center text-muted-foreground mb-6">
            No participants have joined this tournament yet.
          </p>
        )}

        {firstRoundMatches.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {firstRoundMatches.map((match) => (
              <div
                key={match.matchNumber}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="text-center text-xs font-semibold text-muted-foreground mb-5">
                  Match {match.matchNumber}
                </div>

                <div className="flex items-center justify-around gap-4">
                  <Participant participant={match.player1} />

                  {(match.hasSecondSlot || match.isBye) && (
                    <span className="text-xs font-semibold text-muted-foreground">
                      VS
                    </span>
                  )}

                  {match.isBye ? (
                    <span className="text-xs text-muted-foreground">Bye</span>
                  ) : match.hasSecondSlot ? (
                    <Participant participant={match.player2} />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
