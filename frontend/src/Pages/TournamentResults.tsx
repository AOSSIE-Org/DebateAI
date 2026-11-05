import { Fragment, useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import { ArrowLeft, Clock, RefreshCw, Trophy } from "lucide-react";
import { AuthContext } from "@/context/authContext";
import { userAtom } from "@/state/userAtom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tournamentPhases } from "@/components/tournament/phaseNames";
import { getTournamentEvaluation, TournamentRequestError, type TournamentEvaluation, type TournamentRound } from "@/services/tournamentService";

const criteria = [
  { key: "reasoning", label: "Reasoning", maximum: 35, description: "Logical argument, justification and supporting evidence." },
  { key: "relevance", label: "Relevance", maximum: 25, description: "Connection to the motion and assigned stance." },
  { key: "phaseSkill", label: "Phase skill", maximum: 25, description: "Opening, questioning, answering or closing performance for this phase." },
  { key: "clarity", label: "Clarity", maximum: 15, description: "Clear, coherent and understandable expression." },
] as const;
const score = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2);

function CompletedResults({ evaluation }: { evaluation: TournamentEvaluation }) {
  const [round, setRound] = useState<TournamentRound>("opening_statement_for");
  const names = new Map(evaluation.roster.map(person => [person.userId, person.name]));
  const sides = new Map(evaluation.roster.map(person => [person.userId, person.stance]));
  const name = (id: string) => names.get(id) || `Participant ${id.slice(-6)}`;
  const { result, winner, totals, sideMeans } = evaluation;
  if (!result || !winner || !totals || !sideMeans || tournamentPhases.some(phase => !Array.isArray(result[phase.round]?.scores))) {
    return <p role="alert" className="border-l-2 border-destructive pl-3">The completed result is incomplete. Refresh to check again.</p>;
  }
  const missing = tournamentPhases.flatMap(phase => result[phase.round].scores).filter(item => item.submissionStatus === "missing").length;
  const fixture = evaluation.provider === "fixture" || evaluation.provider?.startsWith("mock");
  return <div className="space-y-7">
    {fixture && <p role="note" className="border-l-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-sm">Validation fixture: mock evaluation, not live AI judging.</p>}
    <section className="grid gap-5 border-y border-border py-5 sm:grid-cols-2" aria-label="Winners">
      <div><h2 className="text-sm text-muted-foreground">Winning side</h2><p className="mt-1 flex items-center gap-2 text-xl font-semibold"><Trophy size={20} className="shrink-0 text-emerald-600"/>{winner.side === "draw" ? "Draw" : winner.side === "for" ? "For" : "Against"}</p></div>
      <div><h2 className="text-sm text-muted-foreground">Top individual</h2><p className="mt-1 break-words text-lg font-semibold [overflow-wrap:anywhere]">{winner.individual ? name(winner.individual.userId) : "Tie"}</p><p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{winner.individual ? `${score(winner.individual.totalScore)} / 400` : winner.tiedIndividuals.map(person => `${name(person.userId)} (${score(person.totalScore)})`).join(", ")}</p></div>
    </section>
    <section aria-labelledby="totals-heading" className="space-y-3">
      <h2 id="totals-heading" className="text-lg font-semibold">Participant totals</h2>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Participant totals table">
        <table className="w-full text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="py-2 pr-3 font-medium">Participant</th><th className="px-2 font-medium">Side</th><th className="hidden px-2 font-medium sm:table-cell">Submitted</th><th className="pl-2 text-right font-medium">Total / 400</th></tr></thead>
          <tbody>{totals.map(person => {
            const submitted = tournamentPhases.flatMap(phase => result[phase.round].scores).filter(item => item.userId === person.userId && item.submissionStatus === "submitted").length;
            return <tr key={person.userId} className="border-b border-border/60"><th scope="row" className="max-w-48 break-words py-3 pr-3 font-medium [overflow-wrap:anywhere]">{name(person.userId)}<span className="mt-1 block text-xs font-normal text-muted-foreground sm:hidden">{submitted} / 4 submitted</span></th><td className="px-2 capitalize">{sides.get(person.userId)}</td><td className="hidden px-2 sm:table-cell">{submitted} / 4</td><td className="pl-2 text-right font-semibold tabular-nums">{score(person.totalScore)}</td></tr>;
          })}</tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{sideMeans.map(side => <p key={side.side} className="text-sm"><span className="font-medium capitalize">{side.side}</span> mean: <strong className="tabular-nums">{score(side.mean)} / 400</strong><span className="text-muted-foreground"> ({side.participantCount} {side.participantCount === 1 ? "participant" : "participants"}; {score(side.totalScore)} total)</span></p>)}</div>
      <p className="text-sm text-muted-foreground">Sides are compared by mean participant total. Individual winners are independent of the winning side. {missing > 0 ? `${missing} missing submissions scored zero.` : "No missing submissions."}</p>
    </section>
    <section aria-labelledby="phases-heading" className="space-y-3">
      <h2 id="phases-heading" className="text-lg font-semibold">Phase scores</h2>
      <Tabs value={round} onValueChange={value => setRound(value as TournamentRound)}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-md p-1 md:grid-cols-4" aria-label="Debate phases">{tournamentPhases.map(phase => <TabsTrigger key={phase.round} value={phase.round} className="min-h-10 whitespace-normal rounded-md px-2 py-2 text-xs">{phase.shortLabel}</TabsTrigger>)}</TabsList>
        {tournamentPhases.map(phase => <TabsContent key={phase.round} value={phase.round} className="mt-4 space-y-3">
          <h3 className="font-medium">{phase.label}</h3>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${phase.label} scores table`}>
            <table className="w-full text-left text-sm sm:min-w-[560px]"><thead className="border-b border-border text-muted-foreground"><tr><th className="py-2 pr-3 font-medium">Participant</th>{criteria.map(item => <th key={item.key} className="hidden px-2 text-right text-xs font-medium sm:table-cell">{item.label}<br/>/ {item.maximum}</th>)}<th className="pl-2 text-right font-medium">Score / 100</th></tr></thead>
              <tbody>{result[phase.round].scores.map(person => <Fragment key={person.userId}><tr><th scope="row" className="max-w-48 break-words py-3 pr-3 font-medium [overflow-wrap:anywhere]">{name(person.userId)}{person.submissionStatus === "missing" && <span className="mt-1 block text-xs font-normal text-amber-600 dark:text-amber-400">Missing submission</span>}</th>{criteria.map(item => <td key={item.key} className="hidden px-2 text-right tabular-nums sm:table-cell">{score(person.criteria[item.key])}</td>)}<td className="pl-2 text-right font-semibold tabular-nums">{score(person.score)}</td></tr><tr className="border-b border-border/60"><td colSpan={6} className="max-w-0 break-words pb-3 text-muted-foreground [overflow-wrap:anywhere]"><dl className="mb-3 grid grid-cols-2 gap-2 text-xs sm:hidden">{criteria.map(item => <div key={item.key}><dt>{item.label}</dt><dd className="font-medium tabular-nums text-foreground">{score(person.criteria[item.key])} / {item.maximum}</dd></div>)}</dl>{person.explanation || (person.submissionStatus === "missing" ? "No transcript was submitted for this phase." : "No explanation provided.")}</td></tr></Fragment>)}</tbody>
            </table>
          </div>
        </TabsContent>)}
      </Tabs>
    </section>
    <section className="space-y-3 border-t border-border pt-5" aria-labelledby="rubric-heading"><h2 id="rubric-heading" className="text-lg font-semibold">Scoring rubric</h2><dl className="grid gap-4 sm:grid-cols-2">{criteria.map(item => <div key={item.key}><dt className="text-sm font-medium">{item.label} / {item.maximum}</dt><dd className="mt-1 text-sm text-muted-foreground">{item.description}</dd></div>)}</dl><p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">Rubric: {evaluation.rubricVersion || "Unknown"} | Judge: {evaluation.provider || "Unknown"} / {evaluation.model || "Unknown"}{evaluation.completedAt ? ` | Completed: ${new Date(evaluation.completedAt).toLocaleString()}` : ""}</p></section>
  </div>;
}

export default function TournamentResults() {
  const { id = "" } = useParams();
  const auth = useContext(AuthContext);
  const token = auth?.token || "";
  const user = useAtomValue(userAtom);
  const viewerId = user?.id || "";
  const owner = `${id}:${token}:${viewerId}`;
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<{ owner: string; record: TournamentEvaluation | null; error: string; busy: boolean }>({ owner: "", record: null, error: "", busy: true });
  const current = snapshot.owner === owner ? snapshot : { record: null, error: "", busy: true };

  useEffect(() => {
    if (!id || !token || !viewerId) return;
    let alive = true;
    let inflight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let revision = -1;
    let failures = 0;
    setSnapshot({ owner, record: null, error: "", busy: true });
    async function poll() {
      if (!alive || inflight) return;
      clearTimeout(timer);
      inflight = true;
      controller = new AbortController();
      const active = controller;
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; active.abort(); }, 15000);
      setSnapshot(previous => previous.owner === owner ? { ...previous, busy: true } : previous);
      try {
        const record = await getTournamentEvaluation(id, active.signal);
        if (!alive) return;
        if (record.viewerId !== viewerId || record.tournamentId !== id || !Array.isArray(record.roster) || !Number.isFinite(record.revision)) throw new Error("Results identity could not be verified.");
        if (record.revision < revision) { timer = setTimeout(poll, 5000); return; }
        revision = record.revision;
        failures = 0;
        setSnapshot({ owner, record, error: "", busy: false });
        if (["pending", "running", "not_ready"].includes(record.state)) timer = setTimeout(poll, 5000);
      } catch (error) {
        if (!alive) return;
        const fatal = error instanceof TournamentRequestError && [400, 401, 403, 404].includes(error.status);
        const message = fatal ? error.message : timedOut ? "Results request timed out. Reconnecting..." : "Results are unavailable. Reconnecting...";
        setSnapshot({ owner, record: null, error: message, busy: false });
        if (!fatal) timer = setTimeout(poll, Math.min(30000, 5000 * 2 ** Math.min(failures++, 3)));
      } finally {
        clearTimeout(timeout);
        inflight = false;
        if (alive) setSnapshot(previous => previous.owner === owner ? { ...previous, busy: false } : previous);
      }
    }
    const reconnect = () => { if (document.visibilityState !== "hidden") void poll(); };
    window.addEventListener("online", reconnect);
    document.addEventListener("visibilitychange", reconnect);
    void poll();
    return () => { alive = false; clearTimeout(timer); controller?.abort(); window.removeEventListener("online", reconnect); document.removeEventListener("visibilitychange", reconnect); };
  }, [id, token, viewerId, owner, refresh]);

  const record = current.record;
  return <main className="mx-auto w-full max-w-5xl space-y-6 px-2 py-4 sm:px-4 sm:py-6">
    <Link to={`/tournament/${id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={16}/>Tournament</Link>
    <header className="flex items-start justify-between gap-3"><div className="min-w-0"><h1 className="text-2xl font-semibold">Tournament results</h1>{record && <p className="mt-2 break-words text-muted-foreground [overflow-wrap:anywhere]">{record.topic}</p>}</div><button type="button" title="Refresh results" aria-label="Refresh results" disabled={current.busy} onClick={() => setRefresh(value => value + 1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border disabled:opacity-50"><RefreshCw size={16} className={current.busy ? "animate-spin" : ""}/></button></header>
    {current.error && <p role="alert" className="border-l-2 border-destructive pl-3 text-sm">{current.error}</p>}
    {!record && !current.error && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Clock size={16}/>Loading results...</p>}
    {record && record.state !== "completed" && <section className="space-y-2 border-y border-border py-5" aria-live="polite"><h2 className="text-lg font-semibold">{record.state === "pending" ? record.retrying ? "Evaluation retry scheduled" : "Evaluation pending" : record.state === "running" ? "Evaluation in progress" : record.state === "failed" ? "Evaluation failed" : record.state === "legacy_no_evaluation" ? "Legacy tournament" : "Results not ready"}</h2><p className="text-sm text-muted-foreground">{record.state === "failed" ? `No scores were published.${record.retryable ? " The judge encountered a temporary failure." : " The evaluation could not be completed."}` : record.state === "legacy_no_evaluation" ? "This tournament predates the scored debate workflow. No evaluation is available." : record.state === "not_ready" ? "The debate must finish before it can be evaluated." : record.retrying ? "A temporary judge failure occurred. The worker will retry automatically." : "Scores and winners will appear after judging is complete."}</p>{record.errorCode && <p className="text-xs text-muted-foreground">Status: {record.errorCode}</p>}{record.runId && <Link className="inline-flex items-center gap-2 text-sm underline underline-offset-4" to={`/tournament/${id}/room`}>Debate room</Link>}</section>}
    {record?.state === "completed" && <CompletedResults key={`${owner}:${record.runId}`} evaluation={record}/>}
  </main>;
}
