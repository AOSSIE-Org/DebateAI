import { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAtomValue } from "jotai";
import { ArrowRight, KeyRound, Plus, RefreshCw, Users } from "lucide-react";
import { AuthContext } from "@/context/authContext";
import { userAtom } from "@/state/userAtom";
import { getTournamentRequest, joinTournament, listTournaments, requestTournamentAdmission, type CreatedTournament, type TournamentRequestStatus } from "@/services/tournamentService";

const message = (error: unknown) => error instanceof Error ? error.message : "Request failed.";

export default function TournamentHub() {
  const auth = useContext(AuthContext);
  const user = useAtomValue(userAtom);
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<CreatedTournament[]>([]);
  const [cache, setCache] = useState<{owner: string; requests: TournamentRequestStatus[]}>({owner: "", requests: []});
  const [filter, setFilter] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const generation = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    generation.current++;
    setTournaments([]); setLoading(true); setError(""); setBusy("");
    listTournaments(filter, controller.signal).then(next => {
      if (!controller.signal.aborted) setTournaments(next);
    }).catch((err: unknown) => {
      if (!controller.signal.aborted) setError(message(err));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [auth?.token, filter, refresh]);

  useEffect(() => {
    let requests: TournamentRequestStatus[] = [];
    if (user?.id) {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(`tournamentRequests:${user.id}`) || "[]");
        if (Array.isArray(saved)) requests = saved.filter((item): item is TournamentRequestStatus =>
          item && typeof item.tournamentId === "string" && /^[a-f0-9]{24}$/.test(item.tournamentId) && ["pending", "approved", "rejected"].includes(item.status)).slice(-20);
      } catch { /* Corrupt cache must not prevent admission. */ }
    }
    setCache({owner: user?.id || "", requests});
  }, [user?.id]);

  const requests = cache.owner === user?.id ? cache.requests : [];
  const requestIds = requests.filter(request => request.status === "pending").map(request => request.tournamentId).join(",");
  useEffect(() => {
    if (!requestIds) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      for (const id of requestIds.split(",")) {
        try {
          const next = await getTournamentRequest(id, controller.signal);
          if (!controller.signal.aborted) setCache(current => ({
            ...current, requests: current.requests.map(request => request.tournamentId === id ? next : request),
          }));
        } catch { /* Deleted requests remain dismissible. */ }
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 5000);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [requestIds, auth?.token]);

  useEffect(() => {
    if (!user?.id || cache.owner !== user.id) return;
    try { localStorage.setItem(`tournamentRequests:${user.id}`, JSON.stringify(cache.requests)); }
    catch { /* Browser storage is optional. */ }
  }, [cache, user?.id]);

  async function join(id: string) {
    const current = generation.current;
    setBusy(id); setError("");
    try { await joinTournament(id); if (current === generation.current) navigate(`/tournament/${id}`); }
    catch (err) { if (current === generation.current) setError(message(err)); }
    finally { if (current === generation.current) setBusy(""); }
  }

  async function requestAdmission(event: React.FormEvent) {
    event.preventDefault();
    const current = generation.current;
    setBusy("invite"); setError("");
    try {
      const next = await requestTournamentAdmission(inviteCode);
      if (current !== generation.current) return;
      setCache(existing => ({owner: user?.id || "", requests: [...existing.requests.filter(item => item.tournamentId !== next.tournamentId), next].slice(-20)}));
      setInviteCode("");
      if (next.status === "approved") navigate(`/tournament/${next.tournamentId}`);
    } catch (err) { if (current === generation.current) setError(message(err)); }
    finally { if (current === generation.current) setBusy(""); }
  }

  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <h1 className="text-2xl font-semibold">Tournaments</h1>
      <Link className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground" to="/tournament/create"><Plus size={18}/>Create tournament</Link>
    </header>
    <section className="flex flex-wrap items-end gap-4 border-b border-border pb-5">
      <form onSubmit={requestAdmission} className="flex max-w-full flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm">Private invite code<input aria-label="Private invite code" className="block w-44 rounded-md border border-input bg-background px-3 py-2" value={inviteCode} onChange={event => setInviteCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label>
        <button className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50" disabled={!!busy || !user?.id}><KeyRound size={16}/>Request admission</button>
      </form>
      <label className="space-y-1 text-sm">Status<select className="block rounded-md border border-input bg-background px-3 py-2" value={filter} onChange={event => setFilter(event.target.value)}><option value="">All</option><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="completed">Completed</option></select></label>
      <button type="button" title="Refresh tournaments" aria-label="Refresh tournaments" className="rounded-md border border-input p-2" onClick={() => setRefresh(value => value + 1)} disabled={loading || !!busy}><RefreshCw size={18}/></button>
    </section>
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    {requests.length > 0 && <section aria-label="Your admission requests" className="space-y-2"><h2 className="text-lg font-semibold">Your requests</h2>{requests.map(request => <div key={request.tournamentId} className="flex flex-wrap items-center gap-3 border-b border-border py-2 text-sm"><span className="min-w-0 break-all">{request.tournamentId}</span><span className="capitalize">{request.status}</span>{request.status === "approved" && <Link className="text-primary underline" to={`/tournament/${request.tournamentId}`}>Open tournament</Link>}<button className="ml-auto text-muted-foreground underline" onClick={() => setCache(current => ({...current, requests: current.requests.filter(item => item.tournamentId !== request.tournamentId)}))}>Dismiss</button></div>)}</section>}
    {loading ? <p role="status">Loading tournaments...</p> : tournaments.length === 0 ? <p className="text-muted-foreground">No tournaments found.</p> : <section aria-label="Tournament list" className="divide-y divide-border">
      {tournaments.map(tournament => {
        const member = tournament.participants.some(participant => participant.userId === user?.id);
        return <article key={tournament.id} className="flex flex-wrap items-start justify-between gap-4 py-5">
          <div className="min-w-0 flex-1 basis-64 space-y-2"><Link className="break-words text-lg font-semibold hover:underline" to={`/tournament/${tournament.id}`}>{tournament.topic}</Link><p className="break-words text-sm text-muted-foreground">{tournament.description}</p><div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><Users size={16}/>{tournament.participants.length}/{tournament.maxParticipants}</span><span className="capitalize">{tournament.status}</span><span className="capitalize">{tournament.visibility}</span>{tournament.scheduleAt && <time>{new Date(tournament.scheduleAt).toLocaleString()}</time>}</div></div>
          {member ? <Link className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm" to={`/tournament/${tournament.id}`}>Open lobby<ArrowRight size={16}/></Link> : tournament.visibility === "public" && <button className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={!!busy || !user?.id || !tournament.lobbyOpen || tournament.participants.length >= tournament.maxParticipants} onClick={() => void join(tournament.id)}><ArrowRight size={16}/>{tournament.participants.length >= tournament.maxParticipants ? "Full" : tournament.lobbyOpen ? "Join tournament" : "Closed"}</button>}
        </article>;
      })}
    </section>}
  </main>;
}
