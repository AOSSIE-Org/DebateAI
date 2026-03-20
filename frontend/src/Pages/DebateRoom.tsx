import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { sendDebateMessage, judgeDebate, concedeDebate } from "@/services/vsbot";
import JudgmentPopup from "@/components/JudgementPopup";
import { Mic, MicOff } from "lucide-react";
import { useAtom } from "jotai";
import { userAtom } from "@/state/userAtom";

interface Bot { name: string; level: string; desc: string; avatar: string; quote: string; rating: number }

const allBots: Bot[] = [
  { name: "Rookie Rick", level: "Easy", desc: "A beginner who stumbles over logic.", avatar: "/images/rookie_rick.jpg", quote: "Uh, wait, what's your point again?", rating: 1200 },
  { name: "Casual Casey", level: "Easy", desc: "Friendly but not too sharp.", avatar: "/images/casual_casey.jpg", quote: "Let's just chill and chat, okay?", rating: 1300 },
  { name: "Moderate Mike", level: "Medium", desc: "Balanced and reasonable.", avatar: "/images/moderate_mike.jpg", quote: "I see your side, but here's mine.", rating: 1500 },
  { name: "Sassy Sarah", level: "Medium", desc: "Witty with decent arguments.", avatar: "/images/sassy_sarah.jpg", quote: "Oh honey, you're in for it now!", rating: 1600 },
  { name: "Innovative Iris", level: "Medium", desc: "A creative thinker", avatar: "/images/innovative_iris.jpg", quote: "Fresh ideas fuel productive debates.", rating: 1550 },
  { name: "Tough Tony", level: "Hard", desc: "Logical and relentless.", avatar: "/images/tough_tony.jpg", quote: "Prove it or step aside.", rating: 1700 },
  { name: "Expert Emma", level: "Hard", desc: "Master of evidence and rhetoric.", avatar: "/images/expert_emma.jpg", quote: "Facts don't care about your feelings.", rating: 1800 },
  { name: "Grand Greg", level: "Expert", desc: "Unbeatable debate titan.", avatar: "/images/grand_greg.jpg", quote: "Checkmate. Your move.", rating: 2000 },
  { name: "Yoda", level: "Legends", desc: "Wise, cryptic, and patient.", avatar: "/images/yoda.jpeg", quote: "Hmm, strong your point is.", rating: 2400 },
  { name: "Tony Stark", level: "Legends", desc: "Witty, arrogant, and clever.", avatar: "/images/tony.webp", quote: "Nice try, but your logic's running on fumes.", rating: 2200 },
  { name: "Professor Dumbledore", level: "Legends", desc: "Calm, strategic, and insightful.", avatar: "/images/dumbledore.avif", quote: "A valid point, but have you considered its ripple effects?", rating: 2500 },
  { name: "Rafiki", level: "Legends", desc: "Quirky, playful, and humorous.", avatar: "/images/rafiki.jpeg", quote: "Haha! You think too hard, my friend!", rating: 1800 },
  { name: "Darth Vader", level: "Legends", desc: "Powerful, stern, and intimidating.", avatar: "/images/darthvader.jpg", quote: "Your reasoning falters.", rating: 2300 },
];

type Message = { sender: "User" | "Bot" | "Judge"; text: string; phase: string };
type DebateProps = { userId: string; botName: string; botLevel: string; topic: string; stance: string; phaseTimings: { name: string; time: number }[]; debateId: string };
type DebateState = { messages: Message[]; currentPhase: number; phaseStep: number; isBotTurn: boolean; userStance: string; botStance: string; timer: number; isDebateEnded: boolean };
type JudgmentData = {
  opening_statement: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  cross_examination: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  answers: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  closing: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  total: { user: number; bot: number };
  verdict: { winner: string; reason: string; congratulations: string; opponent_analysis: string };
};

type Theme = "light" | "dark" | "high-contrast";

// Proper types for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance;
}

// localStorage key "Theme": "0"=light, "1"=dark, "2"=high-contrast
function detectTheme(): Theme {
  const val = localStorage.getItem("Theme");
  if (val === "0") return "light";
  if (val === "1") return "dark";
  if (val === "2") return "high-contrast";
  return "light";
}

interface Palette {
  pageBg: string; headerBg: string; headerBorder: string;
  cardBg: string; cardBorder: string; cardHeaderBg: string;
  text: string; sub: string;
  msgBg: string; msgText: string; msgLabel: string;
  inputBg: string; inputBorder: string; inputText: string;
  accent: string; sendBg: string; sendText: string;
  popupBg: string; popupBorder: string; popupTitle: string; popupText: string;
  overlay: string; timerOk: string; glowColor: string;
}

const palettes: Record<Theme, Palette> = {
  light: {
    pageBg: "linear-gradient(135deg, #f5f0eb 0%, #e8e0d8 100%)",
    headerBg: "linear-gradient(90deg, #ffedd5 0%, #ffffff 50%, #ffedd5 100%)",
    headerBorder: "#fed7aa",
    cardBg: "#ffffff", cardBorder: "#e5e7eb", cardHeaderBg: "#f9fafb",
    text: "#111827", sub: "#6b7280",
    msgBg: "#f3f4f6", msgText: "#1f2937", msgLabel: "#9ca3af",
    inputBg: "#ffffff", inputBorder: "#d1d5db", inputText: "#111827",
    accent: "#ea580c", sendBg: "#f97316", sendText: "#ffffff",
    popupBg: "#ffffff", popupBorder: "#fed7aa", popupTitle: "#ea580c", popupText: "#374151",
    overlay: "rgba(0,0,0,0.5)", timerOk: "#6b7280", glowColor: "rgba(249,115,22,0.5)",
  },
  dark: {
    pageBg: "#0f1422",
    headerBg: "#1a2035", headerBorder: "#2d3748",
    cardBg: "#1a2035", cardBorder: "#2d3748", cardHeaderBg: "#222c42",
    text: "#f1f5f9", sub: "#94a3b8",
    msgBg: "#222c42", msgText: "#e2e8f0", msgLabel: "#64748b",
    inputBg: "#222c42", inputBorder: "#3d4f6e", inputText: "#f1f5f9",
    accent: "#fb923c", sendBg: "#f97316", sendText: "#ffffff",
    popupBg: "#1a2035", popupBorder: "#fb923c", popupTitle: "#fb923c", popupText: "#cbd5e1",
    overlay: "rgba(0,0,0,0.85)", timerOk: "#94a3b8", glowColor: "rgba(251,146,60,0.7)",
  },
  "high-contrast": {
    pageBg: "#000000",
    headerBg: "#111111", headerBorder: "#ffffff",
    cardBg: "#0a0a0a", cardBorder: "#ffffff", cardHeaderBg: "#111111",
    text: "#ffffff", sub: "#d1d5db",
    msgBg: "#1a1a1a", msgText: "#ffffff", msgLabel: "#9ca3af",
    inputBg: "#000000", inputBorder: "#ffffff", inputText: "#ffffff",
    accent: "#facc15", sendBg: "#facc15", sendText: "#000000",
    popupBg: "#000000", popupBorder: "#ffffff", popupTitle: "#facc15", popupText: "#e5e7eb",
    overlay: "rgba(0,0,0,0.92)", timerOk: "#d1d5db", glowColor: "rgba(250,204,21,0.7)",
  },
};

const phaseSequences = [["For","Against"],["For","Against","Against","For"],["For","Against"]];
const turnTypes = [["statement","statement"],["question","answer","question","answer"],["statement","statement"]];

const extractJSON = (r: string): string => {
  if (!r) return "{}";
  const m = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(r);
  if (m?.[1]) return m[1].trim();
  const m2 = r.match(/\{[\s\S]*\}/);
  return m2 ? m2[0] : "{}";
};

const DebateRoom: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const debateData = location.state as DebateProps;
  const phases = debateData.phaseTimings;
  const debateKey = `debate_${debateData.userId}_${debateData.topic}_${debateData.debateId}`;
  const [user] = useAtom(userAtom);

  const [theme, setTheme] = useState<Theme>(detectTheme);
  const p = palettes[theme];

  // Poll localStorage for theme changes every 300ms
  useEffect(() => {
    const interval = setInterval(() => {
      const detected = detectTheme();
      setTheme(prev => (prev !== detected ? detected : prev));
    }, 300);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "Theme") setTheme(detectTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const [state, setState] = useState<DebateState>(() => {
    const s = localStorage.getItem(debateKey);
    return s
      ? (JSON.parse(s) as DebateState)
      : { messages: [], currentPhase: 0, phaseStep: 0, isBotTurn: false, userStance: "", botStance: "", timer: phases[0].time, isDebateEnded: false };
  });

  const [finalInput, setFinalInput] = useState("");
  const [interimInput, setInterimInput] = useState("");
  const [popup, setPopup] = useState<{ show: boolean; message: string; isJudging?: boolean }>({ show: false, message: "" });
  const [judgmentData, setJudgmentData] = useState<JudgmentData | null>(null);
  const [showJudgment, setShowJudgment] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [nextTurnPending, setNextTurnPending] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const botTurnRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Fixed: typed as SpeechRecognitionInstance instead of any
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const bot = allBots.find(b => b.name === debateData.botName) ?? allBots[0];
  const userAvatar = user?.avatarUrl ?? "https://avatar.iran.liara.run/public/10";

  // ── advanceTurn wrapped in useCallback to satisfy exhaustive-deps ──────────
  const advanceTurn = useCallback((cur: DebateState) => {
    const seq = phaseSequences[cur.currentPhase];
    if (cur.phaseStep + 1 < seq.length) {
      const ns = cur.phaseStep + 1;
      setState({ ...cur, phaseStep: ns, isBotTurn: cur.userStance !== seq[ns], timer: phases[cur.currentPhase].time });
      setNextTurnPending(false);
    } else if (cur.currentPhase < phases.length - 1) {
      const np = cur.currentPhase + 1;
      setPopup({ show: true, message: `${phases[cur.currentPhase].name} completed. Next: ${phases[np].name}` });
      setTimeout(() => {
        setPopup({ show: false, message: "" });
        setState(pr => ({ ...pr, currentPhase: np, phaseStep: 0, isBotTurn: pr.userStance !== phaseSequences[np][0], timer: phases[np].time }));
        setNextTurnPending(false);
      }, 4000);
    } else {
      setPopup({ show: true, message: "Calculating scores and judging results...", isJudging: true });
      setState({ ...cur, isDebateEnded: true });
      judgeDebateResult(cur.messages);
      setNextTurnPending(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases]);

  const stopRec = useCallback(() => {
    if (recognitionRef.current && isRecognizing) {
      recognitionRef.current.stop();
      setIsRecognizing(false);
    }
  }, [isRecognizing]);

  const startRec = useCallback(() => {
    if (recognitionRef.current && !isRecognizing) {
      recognitionRef.current.start();
      setIsRecognizing(true);
    }
  }, [isRecognizing]);

  // ── Speech recognition setup ───────────────────────────────────────────────
  useEffect(() => {
    // Fixed: properly typed instead of (window as any)
    const SR: SpeechRecognitionConstructor | undefined =
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition ??
      (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;

    if (!SR) return;

    const instance = new SR();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = "en-US";

    instance.onresult = (e: SpeechRecognitionEvent) => {
      let fin = "", inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + " ";
        else inter = e.results[i][0].transcript;
      }
      if (fin) {
        setFinalInput(pr => pr ? pr + " " + fin.trim() : fin.trim());
        setInterimInput("");
      } else {
        setInterimInput(inter);
      }
    };
    instance.onend = () => setIsRecognizing(false);
    instance.onerror = () => setIsRecognizing(false);

    // Fixed: assigned to ref properly — no null dereference
    recognitionRef.current = instance;

    return () => {
      instance.stop();
    };
  }, []);

  useEffect(() => { localStorage.setItem(debateKey, JSON.stringify(state)); }, [state, debateKey]);
  useEffect(() => () => { localStorage.removeItem(debateKey); }, [debateKey]);

  useEffect(() => {
    if (!state.userStance) {
      const norm = debateData.stance.toLowerCase() === "for" ? "For" : "Against";
      setState(pr => ({ ...pr, userStance: norm, botStance: norm === "For" ? "Against" : "For", isBotTurn: norm === "Against" }));
    }
  }, [state.userStance, debateData.stance]);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.timer > 0 && !state.isDebateEnded) {
      timerRef.current = setInterval(() => {
        setState(pr => {
          if (pr.timer <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            if (!pr.isBotTurn) {
              stopRec();
              setPopup({ show: true, message: "Time's up! Moving to next turn." });
              setTimeout(() => setPopup({ show: false, message: "" }), 2000);
              const u = { ...pr, timer: 0 };
              advanceTurn(u);
              return u;
            }
            setNextTurnPending(true);
            return { ...pr, timer: 0 };
          }
          return { ...pr, timer: pr.timer - 1 };
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.timer, state.isDebateEnded, state.isBotTurn, advanceTurn, stopRec]);

  // ── Bot turn ───────────────────────────────────────────────────────────────
  const handleBotTurn = useCallback(async () => {
    try {
      const tt = turnTypes[state.currentPhase][state.phaseStep];
      const ctx =
        tt === "question" ? "Ask a clear and concise question challenging your opponent."
        : tt === "answer" ? `Answer this question: ${state.messages.at(-1)?.text ?? ""}`
        : "Make your statement";
      const { response } = await sendDebateMessage({
        botLevel: debateData.botLevel, topic: debateData.topic,
        history: state.messages, botName: debateData.botName,
        stance: state.botStance, context: ctx,
      });
      const botMsg: Message = { sender: "Bot", text: response || "I need to think about that...", phase: phases[state.currentPhase].name };
      setState(pr => {
        const u = { ...pr, messages: [...pr.messages, botMsg] };
        setTimeout(() => advanceTurn(u), 100);
        return u;
      });
    } catch (e) {
      console.error(e);
      setState(pr => {
        const u = { ...pr, messages: [...pr.messages, { sender: "Bot" as const, text: "I encountered an error.", phase: phases[pr.currentPhase].name }], isBotTurn: false };
        advanceTurn(u);
        return u;
      });
    } finally {
      botTurnRef.current = false;
    }
  }, [state.currentPhase, state.phaseStep, state.messages, state.botStance, debateData, phases, advanceTurn]);

  useEffect(() => {
    if (state.isBotTurn && !state.isDebateEnded && !botTurnRef.current) {
      botTurnRef.current = true;
      handleBotTurn();
    }
  }, [state.isBotTurn, state.currentPhase, state.phaseStep, state.isDebateEnded, handleBotTurn]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [state.messages]);

  const handleConcede = async () => {
    if (!window.confirm("Are you sure you want to concede? This will count as a loss.")) return;
    try {
      if (debateData.debateId) await concedeDebate(debateData.debateId, state.messages);
      setState(prev => ({ ...prev, isDebateEnded: true }));
      setPopup({ show: true, message: "You have conceded the debate." });
      setTimeout(() => navigate("/game"), 2000);
    } catch (e) { console.error(e); }
  };

  const sendMessage = async () => {
    if (!finalInput.trim() || state.isBotTurn || state.timer === 0) return;
    const msg: Message = { sender: "User", text: finalInput, phase: phases[state.currentPhase].name };
    setState(pr => {
      const u = { ...pr, messages: [...pr.messages, msg], timer: phases[pr.currentPhase].time };
      if (timerRef.current) clearInterval(timerRef.current);
      advanceTurn(u);
      return u;
    });
    setFinalInput("");
    setInterimInput("");
    stopRec();
  };

  const judgeDebateResult = async (messages: Message[]) => {
    try {
      const { result } = await judgeDebate({ history: messages, userId: debateData.userId });
      setJudgmentData(JSON.parse(extractJSON(result)) as JudgmentData);
      setPopup({ show: false, message: "" });
      setShowJudgment(true);
    } catch (e) {
      console.error(e);
      setJudgmentData({
        opening_statement: { user: { score:0, reason:"Error" }, bot: { score:0, reason:"Error" } },
        cross_examination: { user: { score:0, reason:"Error" }, bot: { score:0, reason:"Error" } },
        answers: { user: { score:0, reason:"Error" }, bot: { score:0, reason:"Error" } },
        closing: { user: { score:0, reason:"Error" }, bot: { score:0, reason:"Error" } },
        total: { user:0, bot:0 },
        verdict: { winner:"None", reason: String(e), congratulations:"", opponent_analysis:"" },
      });
      setTimeout(() => { setPopup({ show:false, message:"" }); setShowJudgment(true); }, 3000);
    }
  };

  const fmtTime = (s: number) => (
    <span style={{ fontFamily:"monospace", color: s <= 5 ? "#ef4444" : p.timerOk }} className={s <= 5 ? "animate-pulse" : ""}>
      {Math.floor(s/60)}:{(s%60).toString().padStart(2,"0")}
    </span>
  );

  const renderMsgs = (sender: "User" | "Bot") =>
    state.messages.filter(m => m.sender === sender).map((m, i) => (
      <div key={i} style={{
        background: p.msgBg, color: p.msgText,
        border: `1px solid ${p.cardBorder}`, borderRadius:"0.5rem",
        padding:"0.75rem", marginBottom:"0.75rem",
        // Fixed: "break-word" is the correct CSS value (not "break-words")
        wordBreak: "break-word" as const,
      }}>
        <span style={{ color: p.msgLabel, fontSize:"0.75rem", display:"block", marginBottom:"0.25rem" }}>{m.phase}</span>
        {m.text}
      </div>
    ));

  const curStance = phaseSequences[state.currentPhase][state.phaseStep];
  const curEntity = state.userStance === curStance ? "User" : "Bot";
  const curTT = turnTypes[state.currentPhase][state.phaseStep];

  const cardStyle = (active: boolean): React.CSSProperties => ({
    flex: "1 1 45%",
    background: p.cardBg,
    border: `1px solid ${active ? p.accent : p.cardBorder}`,
    borderRadius: "0.5rem",
    height: "540px",
    display: "flex",
    flexDirection: "column",
    boxShadow: active ? `0 0 0 2px ${p.accent}, 0 0 24px ${p.glowColor}` : "none",
    transition: "box-shadow 0.3s, border-color 0.3s",
  });

  const cardHeaderStyle: React.CSSProperties = {
    padding: "0.5rem 0.75rem",
    background: p.cardHeaderBg,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    borderRadius: "0.5rem 0.5rem 0 0",
    borderBottom: `1px solid ${p.cardBorder}`,
  };

  const avatarStyle: React.CSSProperties = {
    width: 48, height: 48, borderRadius: "50%",
    border: `2px solid ${p.accent}`,
    objectFit: "cover" as const,
    flexShrink: 0,
  };

  const btnBase: React.CSSProperties = {
    border: "none", borderRadius: "0.375rem",
    padding: "0.4rem 0.85rem", fontSize: "0.875rem",
    fontWeight: 600, cursor: "pointer",
  };

  return (
    <div style={{ minHeight: "100vh", padding: "1rem", background: p.pageBg }}>

      {/* Header */}
      <div style={{ maxWidth: "64rem", margin: "0 auto 0.75rem" }}>
        <div style={{ background: p.headerBg, border: `1px solid ${p.headerBorder}`, borderRadius: "0.75rem", padding: "1rem", textAlign: "center" }}>
          <h1 style={{ color: p.text, fontSize: "1.875rem", fontWeight: 700 }}>
            Debate: {debateData.topic}
          </h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: p.sub }}>
            Phase: <span style={{ fontWeight: 500 }}>{phases[state.currentPhase]?.name ?? "Finished"}</span>
            {" "}| Current Turn:{" "}
            <span style={{ fontWeight: 600, color: p.accent }}>
              {curEntity === "User" ? "You" : debateData.botName} to{" "}
              {curTT === "statement" ? "make a statement" : curTT === "question" ? "ask a question" : "answer"}
            </span>
          </p>
        </div>
      </div>

      {/* Popup */}
      {popup.show && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: p.overlay }}>
          <div style={{ background: p.popupBg, border: `2px solid ${p.popupBorder}`, borderRadius: "0.75rem", padding: "1.5rem", maxWidth: "28rem", width: "100%" }}>
            {popup.isJudging ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mb-4" />
                <h2 style={{ color: p.text, fontSize: "1.25rem", fontWeight: 600 }}>{popup.message}</h2>
              </div>
            ) : (
              <>
                <h3 style={{ color: p.popupTitle, fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>Phase Transition</h3>
                <p style={{ color: p.popupText, textAlign: "center", fontSize: "0.875rem" }}>{popup.message}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Judgment */}
      {showJudgment && judgmentData && (
        <JudgmentPopup
          judgment={judgmentData} userAvatar={userAvatar} botAvatar={bot.avatar}
          botName={debateData.botName} userStance={state.userStance} botStance={state.botStance}
          botDesc={bot.desc} onClose={() => setShowJudgment(false)}
        />
      )}

      {/* Cards */}
      <div style={{ maxWidth: "64rem", margin: "0 auto", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>

        {/* Bot Card */}
        <div style={cardStyle(state.isBotTurn)}>
          <div style={cardHeaderStyle}>
            <img src={bot.avatar} alt={debateData.botName} style={avatarStyle} />
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: p.text }}>{debateData.botName}</div>
              <div style={{ fontSize: "0.75rem", color: p.sub }}>{bot.desc}</div>
              <div style={{ fontSize: "0.75rem", color: p.sub }}>Rating: {bot.rating}</div>
            </div>
            {nextTurnPending && (
              <button
                onClick={() => setState(pr => { advanceTurn(pr); return pr; })}
                style={{ ...btnBase, marginLeft: "auto", background: "#22c55e", color: "#fff" }}
              >
                Next Turn
              </button>
            )}
          </div>
          <div style={{ padding: "0.75rem", flex: 1, overflowY: "auto" }}>
            <p style={{ fontSize: "0.875rem", fontWeight: 600, color: p.accent, marginBottom: "0.25rem" }}>Stance: {state.botStance}</p>
            <p style={{ fontSize: "0.75rem", marginBottom: "0.5rem", color: p.sub }}>
              Time: {fmtTime(state.isBotTurn ? state.timer : phases[state.currentPhase]?.time ?? 0)}
            </p>
            {renderMsgs("Bot")}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* User Card */}
        <div style={cardStyle(!state.isBotTurn && !state.isDebateEnded)}>
          <div style={cardHeaderStyle}>
            <img src={userAvatar} alt="You" style={avatarStyle} />
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: p.text }}>{user?.displayName ?? "You"}</div>
              <div style={{ fontSize: "0.75rem", color: p.sub }}>{user?.bio ?? "Debater"}</div>
              <div style={{ fontSize: "0.75rem", color: p.sub }}>{user?.rating ? `Rating: ${user.rating}` : "Ready to argue!"}</div>
            </div>
            {!state.isDebateEnded && (
              <button onClick={handleConcede} style={{ ...btnBase, marginLeft: "auto", background: "#ef4444", color: "#fff" }}>
                Concede
              </button>
            )}
          </div>
          <div style={{ padding: "0.75rem", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <p style={{ fontSize: "0.875rem", fontWeight: 600, color: p.accent, marginBottom: "0.25rem" }}>Stance: {state.userStance}</p>
            <p style={{ fontSize: "0.75rem", marginBottom: "0.5rem", color: p.sub }}>
              Time: {fmtTime(!state.isBotTurn ? state.timer : phases[state.currentPhase]?.time ?? 0)}
            </p>
            <div style={{ flex: 1, overflowY: "auto" }}>{renderMsgs("User")}</div>

            {!state.isDebateEnded && (
              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  value={isRecognizing ? finalInput + (interimInput ? " " + interimInput : "") : finalInput}
                  onChange={e => !isRecognizing && setFinalInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  readOnly={isRecognizing}
                  disabled={state.isBotTurn || state.timer === 0 || nextTurnPending}
                  placeholder={curTT === "statement" ? "Make your statement" : curTT === "question" ? "Ask your question" : "Provide your answer"}
                  style={{
                    flex: 1, padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
                    fontSize: "0.875rem", background: p.inputBg, color: p.inputText,
                    border: `1px solid ${p.inputBorder}`, outline: "none",
                  }}
                />
                <button
                  onClick={isRecognizing ? stopRec : startRec}
                  disabled={state.isBotTurn || state.timer === 0 || nextTurnPending}
                  style={{ ...btnBase, background: "#3b82f6", color: "#fff", padding: "0.5rem", display: "flex", alignItems: "center" }}
                >
                  {isRecognizing ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button
                  onClick={sendMessage}
                  disabled={state.isBotTurn || state.timer === 0 || nextTurnPending}
                  style={{ ...btnBase, background: p.sendBg, color: p.sendText }}
                >
                  Send
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DebateRoom;