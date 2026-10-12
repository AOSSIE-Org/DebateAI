import { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import { ArrowLeft, Check, Copy, Play, RefreshCw, Trash2, Trophy, X } from "lucide-react";
import { AuthContext } from "@/context/authContext";
import { userAtom } from "@/state/userAtom";
import { chooseTournamentStance, decideTournamentRequest, deleteTournament, getTournament, joinTournament, startTournament, type CreatedTournament } from "@/services/tournamentService";

export default function TournamentDetails() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const user = useAtomValue(userAtom);
  const [record, setRecord] = useState<CreatedTournament | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    generation.current++;
    setRecord(null); setError(""); setNotice(""); setBusy(false); setLoading(true);
    async function poll() {
      try {
        const next = await getTournament(id, controller.signal);
        if (!controller.signal.aborted) setRecord(current => !current || next.revision >= current.revision ? next : current);
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load tournament."); }
      finally { if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(poll, 5000); } }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, auth?.token, refresh]);

  async function action(operation: () => Promise<CreatedTournament>) {
    const current = generation.current;
    setBusy(true); setError("");
    try {
      const next = await operation();
      if (current === generation.current) setRecord(previous => !previous || next.revision >= previous.revision ? next : previous);
    } catch (err) { if (current === generation.current) setError(err instanceof Error ? err.message : "Request failed."); }
    finally { if (current === generation.current) setBusy(false); }
  }

  async function remove() {
    if (!window.confirm("Delete this tournament?")) return;
    const current = generation.current;
    setBusy(true); setError("");
    try { await deleteTournament(id); if (current === generation.current) navigate("/tournaments"); }
    catch (err) { if (current === generation.current) { setError(err instanceof Error ? err.message : "Delete failed."); setBusy(false); } }
  }

  async function begin() {
    const current = generation.current;
    setBusy(true); setError("");
    try { await startTournament(id); if (current === generation.current) navigate(`/tournament/${id}/room`); }
    catch (err) { if (current === generation.current) setError(err instanceof Error ? err.message : "Start failed."); }
    finally { if (current === generation.current) setBusy(false); }
  }

  const host = !!user?.id && record?.hostId === user.id;
  const me = record?.participants.find(participant => participant.userId === user?.id);
  const pending = record?.joinRequests?.filter(request => request.status === "pending") || [];
  const canJoin = record?.lobbyOpen && !!user?.id && !me && record.visibility === "public" && record.participants.length < record.maxParticipants;
  const readiness = record ? [
    ...(record.participants.length < record.minParticipants ? [`${record.minParticipants - record.participants.length} more participant(s) needed`] : []),
    ...(record.participants.some(participant => !participant.stance) ? ["Stance selection pending"] : []),
    ...(!record.participants.some(participant => participant.stance === "for") || !record.participants.some(participant => participant.stance === "against") ? ["Both sides need participants"] : []),
  ] : [];

  return <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
    <header className="flex items-center justify-between gap-3 border-b border-border pb-4"><Link className="inline-flex items-center gap-2 text-sm" to="/tournaments"><ArrowLeft size={18}/>Tournaments</Link><div className="flex gap-2"><button aria-label="Refresh tournament" title="Refresh tournament" className="rounded-md border border-input p-2" disabled={busy || loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18}/></button>{host && record?.lobbyOpen && <button aria-label="Delete tournament" title="Delete tournament" className="rounded-md border border-input p-2 text-destructive" disabled={busy} onClick={() => void remove()}><Trash2 size={18}/></button>}</div></header>
    {busy && <p role="status" className="text-sm text-muted-foreground">Saving changes...</p>}
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {loading && <p role="status">Loading tournament...</p>}
    {record && <>
      <section className="space-y-3 border-b border-border pb-5"><h1 className="break-words text-2xl font-semibold">{record.topic}</h1><p className="whitespace-pre-wrap break-words text-muted-foreground">{record.description}</p><div className="flex flex-wrap gap-4 text-sm"><span className="capitalize">{record.status}</span><span className="capitalize">{record.visibility}</span><span>Moderator: {record.moderatorName}</span>{record.scheduleAt && <time>{new Date(record.scheduleAt).toLocaleString()}</time>}</div>
      {host && record.inviteCode && <div className="flex flex-wrap items-center gap-2 text-sm"><span>Invite code:</span><code className="font-mono text-lg">{record.inviteCode}</code><button aria-label="Copy invite code" title="Copy invite code" className="rounded-md border border-input p-2" onClick={() => { void navigator.clipboard.writeText(record.inviteCode!).then(() => setNotice("Invite code copied.")).catch(() => setNotice("Copy failed. Select the invite code to copy it.")); }}><Copy size={16}/></button></div>}
      {canJoin && <button className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={busy} onClick={() => void action(() => joinTournament(id))}>Join tournament</button>}
      {me && record.executionState && <Link className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground" to={`/tournament/${id}/room`}><Play size={16}/>Open debate</Link>}
      {(me || host) && (record.executionState === "finished" || record.status === "completed") && <Link className="ml-3 inline-flex items-center gap-2 text-sm underline underline-offset-4" to={`/tournament/${id}/results`}><Trophy size={16}/>View results</Link>}
      </section>
      {me && record.lobbyOpen && <fieldset className="space-y-2" disabled={busy}><legend className="text-sm font-semibold">Your stance</legend><div className="flex gap-4">{(["for", "against"] as const).map(stance => <label key={stance} className="inline-flex items-center gap-2 capitalize"><input type="radio" name="stance" value={stance} checked={me.stance === stance} onChange={() => void action(() => chooseTournamentStance(id, stance))}/>{stance}</label>)}</div></fieldset>}
      <section className="space-y-3"><h2 className="text-lg font-semibold">Participants <span className="text-sm font-normal text-muted-foreground">{record.participants.length}/{record.maxParticipants}</span></h2><ul className="divide-y divide-border">{record.participants.map(participant => <li key={participant.userId} className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="min-w-0 break-words">{participant.name}{participant.userId === record.hostId ? " (host)" : ""}{participant.userId === user?.id ? " (you)" : ""}</span><span className="text-sm capitalize text-muted-foreground">{participant.stance || "Stance pending"}</span></li>)}</ul></section>
      {host && <section className="space-y-3 border-t border-border pt-5"><h2 className="text-lg font-semibold">Admission requests</h2>{pending.length === 0 ? <p className="text-sm text-muted-foreground">No pending requests.</p> : <ul className="divide-y divide-border">{pending.map(request => <li key={request.userId} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0 break-words">{request.name}</span><div className="flex shrink-0 gap-2"><button title={`Approve ${request.name}`} aria-label={`Approve ${request.name}`} className="rounded-md border border-input p-2 text-green-600 disabled:opacity-50" disabled={busy || !record.lobbyOpen || record.participants.length >= record.maxParticipants} onClick={() => void action(() => decideTournamentRequest(id, request.userId, "approved", request.createdAt))}><Check size={18}/></button><button title={`Reject ${request.name}`} aria-label={`Reject ${request.name}`} className="rounded-md border border-input p-2 text-destructive disabled:opacity-50" disabled={busy || !record.lobbyOpen} onClick={() => void action(() => decideTournamentRequest(id, request.userId, "rejected", request.createdAt))}><X size={18}/></button></div></li>)}</ul>}</section>}
      {host && record.lobbyOpen && <section className="space-y-2 border-t border-border pt-5"><h2 className="text-lg font-semibold">Roster readiness</h2>{readiness.length ? <ul className="space-y-1 text-sm text-muted-foreground">{readiness.map(reason => <li key={reason}>{reason}</li>)}</ul> : <p className="text-sm text-green-600">Roster ready.</p>}<button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={busy || readiness.length > 0} onClick={() => void begin()}><Play size={16}/>Start debate</button></section>}
    </>}
  </main>;
}
