import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import { ArrowLeft, Check, Clock, Mic, MicOff, RefreshCw, Send, Trophy } from "lucide-react";
import { AuthContext } from "@/context/authContext";
import { userAtom } from "@/state/userAtom";
import { getTournamentExecution, submitTournamentTranscript, TournamentRequestError, type TournamentExecution, type TournamentPhase, type TournamentReceipt } from "@/services/tournamentService";
import { tournamentPhaseNames as phaseNames } from "@/components/tournament/phaseNames";

const bytes = (text: string) => new TextEncoder().encode(text).length;

function readDraft(key: string) {
  try { const text = localStorage.getItem(key) || ""; return bytes(text) <= 8192 ? text : ""; }
  catch { return ""; }
}

function PhaseEditor({ id, runId, userId, phase, allowed, onAccepted }: {
  id: string; runId: string; userId: string; phase: TournamentPhase; allowed: boolean; onAccepted: () => void;
}) {
  const prefix = `debateai:tournament-draft:v1:${userId}:`;
  const key = `${prefix}${id}:${runId}:${phase.round}`;
  const [draft, setDraft] = useState(() => readDraft(key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [receipt, setReceipt] = useState<TournamentReceipt | null>(null);
  const [listening, setListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("");
  const draftRef = useRef(draft);
  const recognition = useRef<SpeechRecognition | null>(null);
  const alive = useRef(true);
  const accepted = receipt !== null || phase.mySubmission?.status === "submitted";
  const editable = allowed && !accepted && !busy;
  const editableRef = useRef(editable);
  editableRef.current = editable;
  const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

  const updateDraft = useCallback((text: string) => {
    draftRef.current = text; setDraft(text);
    try {
      if (text) {
        localStorage.setItem(key, text);
        const keys = Object.keys(localStorage).filter(item => item.startsWith(prefix) && item !== key);
        for (const old of keys.slice(0, Math.max(0, keys.length - 15))) localStorage.removeItem(old);
      } else localStorage.removeItem(key);
      setStorageError("");
    } catch { setStorageError("Draft could not be saved on this device."); }
  }, [key, prefix]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const active = recognition.current;
      if (active) { active.onresult = null; active.onerror = null; active.onend = null; active.abort(); }
    };
  }, []);

  useEffect(() => {
    if (!editable) recognition.current?.abort();
  }, [editable]);

  function toggleSpeech() {
    if (listening) { recognition.current?.stop(); return; }
    if (!SpeechCtor || !editable) return;
    const active = new SpeechCtor();
    recognition.current = active;
    active.continuous = true; active.interimResults = true; active.lang = "en-US";
    const finalized = new Set<number>();
    active.onstart = () => { if (!alive.current || !editableRef.current || recognition.current !== active) { active.abort(); return; } setListening(true); setSpeechStatus("Listening..."); };
    active.onend = () => { if (alive.current && recognition.current === active) { setListening(false); setSpeechStatus(current => current === "Listening..." ? "Microphone stopped." : current); recognition.current = null; } };
    active.onerror = event => { if (alive.current && recognition.current === active) { setListening(false); setSpeechStatus((event as SpeechRecognitionErrorEvent).error === "not-allowed" ? "Microphone permission denied." : "Speech capture stopped. Text entry remains available."); recognition.current = null; active.abort(); } };
    active.onresult = event => {
      if (!alive.current || !editableRef.current || recognition.current !== active) return;
      const final: string[] = []; const interim: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal && !finalized.has(index)) { finalized.add(index); final.push(result[0].transcript); }
        else if (!result.isFinal) interim.push(result[0].transcript);
      }
      if (final.length) {
        const text = [draftRef.current, ...final].filter(Boolean).join(" ");
        if (bytes(text) <= 8192) updateDraft(text);
        else { setSpeechStatus("Transcript limit reached."); active.abort(); return; }
      }
      setSpeechStatus(interim.length ? interim.join(" ") : "Listening...");
    };
    try { active.start(); } catch { setSpeechStatus("Microphone could not start."); }
  }

  async function submit() {
    if (!editable || listening || !draft.trim() || bytes(draft) > 8192) return;
    setBusy(true); setError("");
    try {
      const next = await submitTournamentTranscript(id, runId, phase.round, draft);
      if (alive.current) {
        setReceipt(next);
        try { localStorage.removeItem(key); } catch { setStorageError("Saved draft could not be cleared."); }
        onAccepted();
      }
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : "Submission failed."); }
    finally { if (alive.current) setBusy(false); }
  }

  if (accepted) return <section className="space-y-2 border-t border-border pt-5"><p role="status" className="inline-flex items-center gap-2 text-sm text-green-600"><Check size={18}/>Transcript accepted</p><p className="break-all font-mono text-xs text-muted-foreground">Receipt: {receipt?.contentHash || phase.mySubmission?.contentHash}</p><p className="whitespace-pre-wrap break-words text-sm">{phase.mySubmission?.content || draft}</p></section>;
  return <section className="space-y-3 border-t border-border pt-5">
    <label htmlFor="tournament-transcript" className="block text-sm font-semibold">Your transcript</label>
    <textarea id="tournament-transcript" rows={7} maxLength={8192} className="w-full resize-y rounded-md border border-input bg-background p-3 text-sm disabled:opacity-60" value={draft} disabled={!editable} onChange={event => { if (bytes(event.target.value) > 8192) { setError("Transcript limit is 8192 UTF-8 bytes."); return; } setError(""); updateDraft(event.target.value); }}/>
    <div className="flex flex-wrap items-center justify-between gap-3"><span className={`text-xs tabular-nums ${bytes(draft) > 8192 ? "text-destructive" : "text-muted-foreground"}`}>{bytes(draft)}/8192 bytes</span><div className="flex items-center gap-2"><button type="button" className="rounded-md border border-input p-2 disabled:opacity-40" title={!SpeechCtor ? "Speech capture unavailable" : listening ? "Stop microphone" : "Start microphone"} aria-label={listening ? "Stop microphone" : "Start microphone"} disabled={!editable || !SpeechCtor} onClick={toggleSpeech}>{listening ? <MicOff size={18}/> : <Mic size={18}/>}</button><button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={!editable || listening || !draft.trim() || bytes(draft) > 8192} onClick={() => void submit()}><Send size={16}/>{busy ? "Submitting..." : "Submit transcript"}</button></div></div>
    {!allowed && <p role="status" className="text-sm text-muted-foreground">Phase deadline reached. Waiting for server state.</p>}
    {speechStatus && <p role="status" className="break-words text-sm text-muted-foreground">{speechStatus}</p>}
    {!SpeechCtor && <p className="text-xs text-muted-foreground">Speech capture unavailable in this browser.</p>}
    {storageError && <p role="status" className="text-sm text-destructive">{storageError}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}

export default function TournamentRoom() {
  const { id = "" } = useParams();
  const auth = useContext(AuthContext);
  const user = useAtomValue(userAtom);
  const owner = `${id}:${auth?.token || ""}:${user?.id || ""}`;
  const [sample, setSample] = useState<{ owner: string; record: TournamentExecution; sampledAt: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [tick, setTick] = useState(() => performance.now());
  const fetchNow = useRef<() => void>(() => {});
  const record = sample?.owner === owner && sample.record.viewerId === user?.id ? sample.record : null;

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let fetching = false;
    let requested = false;
    let stopped = false;
    let failures = 0;
    let backingOff = false;
    let revision = -1;
    setSample(null); setError(""); setLoading(true);
    async function poll() {
      if (controller.signal.aborted || stopped || backingOff) return;
      if (fetching) { requested = true; return; }
      fetching = true; clearTimeout(timer);
      let delay = 1500;
      const sentAt = performance.now();
      try {
        const next = await getTournamentExecution(id, controller.signal);
        const receivedAt = performance.now();
        if (!controller.signal.aborted) {
          if (next.revision >= revision) {
            revision = next.revision;
            stopped = next.state === "finished";
          }
          setSample(current => !current || current.owner !== owner || next.revision >= current.record.revision ? { owner, record: next, sampledAt: (sentAt + receivedAt) / 2 } : current);
          setError("");
          failures = 0;
          backingOff = false;
          if (requested) delay = 0;
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          stopped = err instanceof TournamentRequestError && [400, 401, 403, 404].includes(err.status);
          setError(err instanceof Error ? err.message : "Unable to load execution.");
          delay = Math.min(30000, 5000 * 2 ** Math.min(failures++, 3));
          backingOff = true;
        }
      }
      finally {
        fetching = false;
        requested = false;
        if (!controller.signal.aborted) {
          setLoading(false);
          if (!stopped) timer = setTimeout(() => { backingOff = false; void poll(); }, delay);
        }
      }
    }
    fetchNow.current = () => { void poll(); };
    const reconnect = () => { if (!document.hidden) void poll(); };
    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", reconnect);
    void poll();
    return () => { controller.abort(); clearTimeout(timer); fetchNow.current = () => {}; window.removeEventListener("online", reconnect); document.removeEventListener("visibilitychange", reconnect); };
  }, [id, owner, refresh]);

  useEffect(() => { const timer = setInterval(() => setTick(performance.now()), 250); return () => clearInterval(timer); }, []);
  const phase = record?.phases[record.phaseIndex];
  const serverNow = record && sample ? Date.parse(record.serverTime) + Math.max(0, tick - sample.sampledAt) : 0;
  const remaining = phase?.deadlineAt ? Math.max(0, Math.ceil((Date.parse(phase.deadlineAt) - serverNow) / 1000)) : 0;
  const me = record?.roster.find(member => member.userId === user?.id);
  const acceptedCount = phase?.slots.filter(slot => slot.status === "submitted").length || 0;

  return <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
    <header className="flex items-center justify-between gap-3 border-b border-border pb-4"><Link className="inline-flex items-center gap-2 text-sm" to={`/tournament/${id}`}><ArrowLeft size={18}/>Tournament</Link><button aria-label="Refresh debate" title="Refresh debate" className="rounded-md border border-input p-2" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18}/></button></header>
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    {(loading || (!record && !error)) && <p role="status">Loading debate...</p>}
    {record && <>
      <section className="space-y-2"><h1 className="break-words text-2xl font-semibold">{record.topic}</h1>{me && <p className="text-sm text-muted-foreground">{me.name} <span className="capitalize">({me.stance})</span></p>}{record.runId && <p className="break-all font-mono text-xs text-muted-foreground">Run: {record.runId}</p>}</section>
      {record.state === "lobby" && <p role="status">Debate has not started.</p>}
      {record.state === "running" && phase && <>
        <section className="flex flex-wrap items-start justify-between gap-4 border-t border-border pt-5"><div className="space-y-2"><p className="text-xs text-muted-foreground">Phase {record.phaseIndex + 1} of 8</p><h2 className="break-words text-lg font-semibold">{phaseNames[phase.round]}</h2><p className="text-sm text-muted-foreground">{acceptedCount}/{phase.slots.length} transcripts accepted</p></div><div className="inline-flex h-10 w-28 shrink-0 items-center justify-center gap-2 rounded-md border border-border font-mono text-lg tabular-nums" aria-label="Phase time remaining"><Clock size={18}/>{`${Math.floor(remaining / 60)}`.padStart(2, "0")}:{`${remaining % 60}`.padStart(2, "0")}</div></section>
        {phase.mySubmission && user?.id && record.runId ? <PhaseEditor key={`${owner}:${record.runId}:${phase.round}`} id={id} runId={record.runId} userId={user.id} phase={phase} allowed={remaining > 0} onAccepted={() => fetchNow.current()}/> : <p role="status" className="text-sm text-muted-foreground">Waiting for the other side's submissions.</p>}
      </>}
      {record.state === "finished" && <section className="space-y-2 border-t border-border pt-5"><h2 className="text-lg font-semibold">Debate finished</h2><p role="status" className="text-sm text-muted-foreground">Evaluation {record.evaluationState || "pending"}.</p><Link className="inline-flex items-center gap-2 text-sm underline underline-offset-4" to={`/tournament/${id}/results`}><Trophy size={16}/>View results</Link></section>}
      {record.phases.length > 0 && <section className="space-y-3 border-t border-border pt-5"><h2 className="text-lg font-semibold">Phase history</h2><ol className="divide-y divide-border">{record.phases.map((entry, index) => <li key={entry.round} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="break-words">{index + 1}. {phaseNames[entry.round]}</span><span className="shrink-0 capitalize text-muted-foreground">{entry.status}</span></div>{entry.mySubmission?.status === "submitted" && entry.status === "closed" && <details className="mt-2 text-sm"><summary className="cursor-pointer text-green-600">Your accepted transcript</summary><p className="mt-2 whitespace-pre-wrap break-words">{entry.mySubmission.content}</p><p className="mt-2 break-all font-mono text-xs text-muted-foreground">Receipt: {entry.mySubmission.contentHash}</p></details>}{entry.mySubmission?.status === "missing" && <p className="mt-2 text-xs text-muted-foreground">Your submission: missing</p>}</li>)}</ol></section>}
    </>}
  </main>;
}
