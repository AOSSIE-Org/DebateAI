import React, { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { analyzeDebate } from "@/services/vsbot";
import type { DebateMessage } from "@/services/vsbot";

// ─── Types ──────────────────────────────────────────────────────────────────

type Fallacy = {
  type: string;
  sender: string;
  quote: string;
  explanation: string;
  severity: string;
  phase: string;
};

type PillarScore = {
  score: number;
  feedback: string;
};

type PillarScores = {
  argument_strength: PillarScore;
  rebuttal_effectiveness: PillarScore;
  evidence_support: PillarScore;
  rhetorical_style: PillarScore;
};

type StrongPoint = {
  point: string;
  impact: string;
  phase: string;
};

type UnansweredArgument = {
  argument: string;
  made_by: string;
  suggestion: string;
};

type DecisiveArgument = {
  summary: string;
  made_by: string;
  why_decisive: string;
};

type CoachingTip = {
  category: string;
  title: string;
  tip: string;
  priority: string;
  example: string;
};

type OverallSummary = {
  debate_quality: string;
  key_takeaway: string;
  user_overall_score: number;
  bot_overall_score: number;
  improvement_potential: string;
};

type AnalyticsData = {
  fallacies: Fallacy[];
  pillar_scores: {
    user: PillarScores;
    bot: PillarScores;
  };
  argument_matrix: {
    user_strongest_points: StrongPoint[];
    bot_strongest_points: StrongPoint[];
    user_unanswered_arguments: UnansweredArgument[];
    bot_unanswered_arguments: UnansweredArgument[];
    decisive_argument: DecisiveArgument;
  };
  coaching_tips: CoachingTip[];
  overall_summary: OverallSummary;
};

type DebateAnalyticsReportProps = {
  history: DebateMessage[];
  topic: string;
  userStance: string;
  botName: string;
  userAvatar?: string;
  botAvatar?: string;
  onClose: () => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const fallacyIcons: Record<string, string> = {
  "Ad Hominem": "🎯",
  "Straw Man": "🌾",
  "False Dilemma": "⚖️",
  "Slippery Slope": "🏔️",
  "Appeal to Emotion": "💔",
  "Red Herring": "🐟",
  "Circular Reasoning": "🔄",
  "Hasty Generalization": "⚡",
  "Appeal to Authority": "👑",
  "Tu Quoque": "🪞",
};

const severityColors: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

const priorityColors: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

const categoryIcons: Record<string, string> = {
  Logic: "🧠",
  Evidence: "📚",
  Delivery: "🎤",
  Strategy: "♟️",
  Rebuttal: "🛡️",
};

const qualityGradients: Record<string, string> = {
  excellent: "linear-gradient(135deg, #10b981, #059669)",
  good: "linear-gradient(135deg, #3b82f6, #2563eb)",
  average: "linear-gradient(135deg, #f59e0b, #d97706)",
  poor: "linear-gradient(135deg, #ef4444, #dc2626)",
};

// ─── SVG Radar Chart ────────────────────────────────────────────────────────

const RadarChart: React.FC<{
  userScores: PillarScores;
  botScores: PillarScores;
  botName: string;
}> = ({ userScores, botScores, botName }) => {
  const pillars = [
    { key: "argument_strength", label: "Argument" },
    { key: "rebuttal_effectiveness", label: "Rebuttal" },
    { key: "evidence_support", label: "Evidence" },
    { key: "rhetorical_style", label: "Rhetoric" },
  ] as const;

  const cx = 150, cy = 150, maxR = 110;
  const angles = pillars.map((_, i) => (Math.PI * 2 * i) / pillars.length - Math.PI / 2);

  const getPoint = (angle: number, value: number) => ({
    x: cx + Math.cos(angle) * (value / 100) * maxR,
    y: cy + Math.sin(angle) * (value / 100) * maxR,
  });

  const makePolygon = (scores: PillarScores) =>
    pillars
      .map((p, i) => {
        const val = Number(scores?.[p.key]?.score) || 0;
        const pt = getPoint(angles[i], val);
        return `${pt.x},${pt.y}`;
      })
      .join(" ");

  const gridLevels = [25, 50, 75, 100];

  return (
    <svg viewBox="0 0 300 300" style={{ width: "100%", maxWidth: 320, margin: "0 auto", display: "block" }}>
      {/* Grid circles */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={angles.map((a) => `${getPoint(a, level).x},${getPoint(a, level).y}`).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
      ))}

      {/* Axis lines */}
      {angles.map((a, i) => (
        <line key={i} x1={cx} y1={cy} x2={getPoint(a, 100).x} y2={getPoint(a, 100).y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      ))}

      {/* Bot polygon */}
      <polygon points={makePolygon(botScores)} fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="2" />

      {/* User polygon */}
      <polygon points={makePolygon(userScores)} fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth="2.5" />

      {/* Score dots & labels */}
      {pillars.map((p, i) => {
        const val = Number(userScores?.[p.key]?.score) || 0;
        const userPt = getPoint(angles[i], val);
        const labelPt = getPoint(angles[i], 118);
        return (
          <g key={p.key}>
            <circle cx={userPt.x} cy={userPt.y} r="4" fill="#3b82f6" stroke="#fff" strokeWidth="1.5" />
            <text x={labelPt.x} y={labelPt.y} textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" fontSize="10" fontWeight="600">
              {p.label}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <circle cx={30} cy={275} r="5" fill="#3b82f6" />
      <text x={40} y={279} fill="#94a3b8" fontSize="10">You</text>
      <circle cx={80} cy={275} r="5" fill="#ef4444" />
      <text x={90} y={279} fill="#94a3b8" fontSize="10">{botName}</text>
    </svg>
  );
};

// ─── Animated Score Counter ─────────────────────────────────────────────────

const AnimatedScore: React.FC<{ target: number | string; color: string; label: string; size?: string }> = ({
  target,
  color,
  label,
  size = "large",
}) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const numTarget = Math.max(0, Math.min(100, Math.round(Number(target) || 0)));
    const duration = 1500;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(numTarget * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target]);

  const radius = size === "large" ? 54 : 34;
  const stroke = size === "large" ? 8 : 5;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (current / 100) * circumference;
  const svgSize = (radius + stroke) * 2;

  return (
    <div style={{ textAlign: "center" }}>
      <svg width={svgSize} height={svgSize} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.05s linear" }}
        />
      </svg>
      <div style={{ marginTop: -svgSize / 2 - (size === "large" ? 14 : 8), position: "relative" }}>
        <span style={{ fontSize: size === "large" ? 28 : 18, fontWeight: 800, color }}>{current}</span>
      </div>
      <div style={{ marginTop: size === "large" ? 24 : 12, fontSize: size === "large" ? 13 : 11, color: "#94a3b8", fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

const DebateAnalyticsReport: React.FC<DebateAnalyticsReportProps> = ({
  history,
  topic,
  userStance,
  botName,
  userAvatar,
  botAvatar,
  onClose,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "fallacies" | "matrix" | "coaching">("overview");
  const [expandedFallacy, setExpandedFallacy] = useState<number | null>(null);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await analyzeDebate({
        history,
        topic,
        userStance,
        botName,
      });

      let parsed: AnalyticsData;
      const raw = response.analytics;

      if (typeof raw === "string") {
        // Extract JSON from potential markdown fences
        let jsonStr = raw.trim();
        const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (fenceMatch) jsonStr = fenceMatch[1].trim();
        else {
          const objMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (objMatch) jsonStr = objMatch[0];
        }
        parsed = JSON.parse(jsonStr);
      } else {
        parsed = raw as unknown as AnalyticsData;
      }

      setAnalytics(parsed);
    } catch (err) {
      console.error("Analytics fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [history, topic, userStance, botName]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ─── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.overlay}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingPulse}>
            <div style={styles.spinnerRing} />
            <div style={{ ...styles.spinnerRing, animationDelay: "0.3s", width: 60, height: 60 }} />
            <div style={{ ...styles.spinnerRing, animationDelay: "0.6s", width: 40, height: 40 }} />
          </div>
          <h2 style={styles.loadingTitle}>🧠 AI Analyzing Your Debate</h2>
          <p style={styles.loadingText}>Scanning for logical fallacies, scoring your performance, and generating personalized coaching...</p>
          <div style={styles.loadingBar}>
            <div style={styles.loadingBarFill} />
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────────────────

  if (error || !analytics) {
    return (
      <div style={styles.overlay}>
        <div style={{ ...styles.container, maxWidth: 500, textAlign: "center" as const }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: "#ef4444", marginBottom: 12 }}>❌ Analysis Failed</h2>
          <p style={{ color: "#94a3b8", marginBottom: 20 }}>{error || "Unable to generate analytics"}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Button onClick={fetchAnalytics} style={{ background: "#3b82f6", color: "#fff", padding: "10px 24px", borderRadius: 12 }}>
              Retry Analysis
            </Button>
            <Button onClick={onClose} style={{ background: "#374151", color: "#fff", padding: "10px 24px", borderRadius: 12 }}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Derived Data ───────────────────────────────────────────────────────

  const { fallacies, pillar_scores, argument_matrix, coaching_tips, overall_summary } = analytics;
  const userPillars = pillar_scores?.user;
  const botPillars = pillar_scores?.bot;

  const userFallacyCount = fallacies?.filter((f) => f.sender === "User").length ?? 0;
  const botFallacyCount = fallacies?.filter((f) => f.sender === "Bot").length ?? 0;

  const tabs = [
    { id: "overview" as const, label: "📊 Overview", badge: null },
    { id: "fallacies" as const, label: "🚩 Fallacies", badge: fallacies?.length ?? 0 },
    { id: "matrix" as const, label: "⚔️ Matrix", badge: null },
    { id: "coaching" as const, label: "💡 Coaching", badge: coaching_tips?.length ?? 0 },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.mainTitle}>🏆 Debate Analytics Report</h1>
            <p style={styles.topicLabel}>
              <span style={{ color: "#64748b" }}>Topic:</span> {topic}
            </p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* ─── Quality Badge ──────────────────────────────────────────── */}
        {overall_summary && (
          <div style={{ ...styles.qualityBadge, background: qualityGradients[overall_summary.debate_quality] || qualityGradients.average }}>
            <span style={{ fontSize: 18 }}>
              {overall_summary.debate_quality === "excellent" ? "🌟" : overall_summary.debate_quality === "good" ? "✅" : overall_summary.debate_quality === "average" ? "📝" : "⚠️"}
            </span>
            <span style={{ fontWeight: 700 }}>
              {overall_summary.debate_quality?.charAt(0).toUpperCase() + overall_summary.debate_quality?.slice(1)} Debate
            </span>
            <span style={{ opacity: 0.9, fontSize: 13 }}>— {overall_summary.key_takeaway}</span>
          </div>
        )}

        {/* ─── VS Avatars ─────────────────────────────────────────────── */}
        <div style={styles.vsSection}>
          <div style={styles.vsPlayer}>
            <img src={userAvatar || "https://api.dicebear.com/9.x/big-ears/svg?seed=Felix"} alt="You" style={styles.vsAvatar} />
            <span style={styles.vsName}>You</span>
            {overall_summary && (
              <AnimatedScore target={overall_summary.user_overall_score} color="#3b82f6" label="Overall" size="small" />
            )}
          </div>
          <div style={styles.vsBadge}>VS</div>
          <div style={styles.vsPlayer}>
            <img src={botAvatar || "https://api.dicebear.com/9.x/big-ears/svg?seed=Nolan"} alt={botName} style={{ ...styles.vsAvatar, borderColor: "#ef4444" }} />
            <span style={styles.vsName}>{botName}</span>
            {overall_summary && (
              <AnimatedScore target={overall_summary.bot_overall_score} color="#ef4444" label="Overall" size="small" />
            )}
          </div>
        </div>

        {/* ─── Tab Navigation ─────────────────────────────────────────── */}
        <div style={styles.tabBar}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {}),
              }}
            >
              {tab.label}
              {tab.badge !== null && tab.badge > 0 && (
                <span style={styles.tabBadge}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ─── Tab Content ────────────────────────────────────────────── */}
        <div style={styles.tabContent}>
          {/* ═══ OVERVIEW TAB ═══ */}
          {activeTab === "overview" && userPillars && botPillars && (
            <div>
              {/* Radar Chart */}
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>📊 4-Pillar Performance Radar</h3>
                <RadarChart userScores={userPillars} botScores={botPillars} botName={botName} />
              </div>

              {/* Pillar Score Cards */}
              <div style={styles.pillarGrid}>
                {(["argument_strength", "rebuttal_effectiveness", "evidence_support", "rhetorical_style"] as const).map((key) => {
                  const labels: Record<string, { icon: string; name: string }> = {
                    argument_strength: { icon: "📊", name: "Argument Strength" },
                    rebuttal_effectiveness: { icon: "🛡️", name: "Rebuttal Effectiveness" },
                    evidence_support: { icon: "🔍", name: "Evidence & Facts" },
                    rhetorical_style: { icon: "🗣️", name: "Rhetorical Style" },
                  };
                  const { icon, name } = labels[key];
                  const userScore = userPillars[key];
                  const botScore = botPillars[key];

                  return (
                    <div key={key} style={styles.pillarCard}>
                      <div style={styles.pillarHeader}>
                        <span style={{ fontSize: 20 }}>{icon}</span>
                        <span style={styles.pillarName}>{name}</span>
                      </div>
                      <div style={styles.pillarScores}>
                        <div style={styles.pillarScoreItem}>
                          <span style={{ fontSize: 24, fontWeight: 800, color: "#3b82f6" }}>{userScore?.score ?? 0}</span>
                          <span style={{ fontSize: 11, color: "#64748b" }}>You</span>
                        </div>
                        <div style={styles.pillarVs}>vs</div>
                        <div style={styles.pillarScoreItem}>
                          <span style={{ fontSize: 24, fontWeight: 800, color: "#ef4444" }}>{botScore?.score ?? 0}</span>
                          <span style={{ fontSize: 11, color: "#64748b" }}>{botName}</span>
                        </div>
                      </div>
                      <div style={styles.pillarBar}>
                        <div style={{ ...styles.pillarBarUser, width: `${userScore?.score ?? 0}%` }} />
                      </div>
                      <p style={styles.pillarFeedback}>{userScore?.feedback}</p>
                    </div>
                  );
                })}
              </div>

              {/* Fallacy Summary */}
              {fallacies && fallacies.length > 0 && (
                <div style={styles.card}>
                  <h3 style={styles.cardTitle}>🚩 Fallacy Summary</h3>
                  <div style={styles.fallacySummary}>
                    <div style={styles.fallacyStat}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: "#3b82f6" }}>{userFallacyCount}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>Your Fallacies</span>
                    </div>
                    <div style={styles.fallacyStat}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: "#ef4444" }}>{botFallacyCount}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{botName}'s Fallacies</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ FALLACIES TAB ═══ */}
          {activeTab === "fallacies" && (
            <div>
              {(!fallacies || fallacies.length === 0) ? (
                <div style={{ ...styles.card, textAlign: "center" as const }}>
                  <span style={{ fontSize: 48 }}>✨</span>
                  <h3 style={{ ...styles.cardTitle, marginTop: 12 }}>No Logical Fallacies Detected!</h3>
                  <p style={{ color: "#64748b" }}>Both debaters maintained strong logical reasoning throughout the debate.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
                  {fallacies.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        ...styles.fallacyCard,
                        borderLeftColor: severityColors[f.severity] || "#f59e0b",
                        cursor: "pointer",
                      }}
                      onClick={() => setExpandedFallacy(expandedFallacy === i ? null : i)}
                    >
                      <div style={styles.fallacyTop}>
                        <div style={styles.fallacyLeft}>
                          <span style={{ fontSize: 20 }}>{fallacyIcons[f.type] || "🚩"}</span>
                          <div>
                            <span style={styles.fallacyType}>{f.type}</span>
                            <span style={{ ...styles.fallacySender, color: f.sender === "User" ? "#3b82f6" : "#ef4444" }}>
                              — {f.sender === "User" ? "You" : botName}
                            </span>
                          </div>
                        </div>
                        <div style={styles.fallacyBadges}>
                          <span style={{ ...styles.severityBadge, background: severityColors[f.severity] || "#f59e0b" }}>
                            {f.severity}
                          </span>
                          <span style={styles.phaseBadge}>{f.phase}</span>
                          <span style={{ fontSize: 14, color: "#64748b" }}>{expandedFallacy === i ? "▲" : "▼"}</span>
                        </div>
                      </div>
                      {expandedFallacy === i && (
                        <div style={styles.fallacyDetails}>
                          <div style={styles.quoteBlock}>
                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" as const }}>
                              Flagged Quote
                            </span>
                            <p style={styles.quoteText}>"{f.quote}"</p>
                          </div>
                          <div style={{ marginTop: 12 }}>
                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" as const }}>
                              Why This Is a Fallacy
                            </span>
                            <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, marginTop: 4 }}>{f.explanation}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ ARGUMENT MATRIX TAB ═══ */}
          {activeTab === "matrix" && argument_matrix && (
            <div>
              {/* Decisive Argument */}
              {argument_matrix.decisive_argument && (
                <div style={{ ...styles.card, borderLeft: "4px solid #f59e0b" }}>
                  <h3 style={styles.cardTitle}>🏅 Decisive Argument</h3>
                  <p style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
                    <strong style={{ color: argument_matrix.decisive_argument.made_by === "User" ? "#3b82f6" : "#ef4444" }}>
                      {argument_matrix.decisive_argument.made_by === "User" ? "You" : botName}
                    </strong>
                    {" "}{argument_matrix.decisive_argument.summary}
                  </p>
                  <p style={{ fontSize: 12, color: "#64748b", marginTop: 8, fontStyle: "italic" }}>
                    {argument_matrix.decisive_argument.why_decisive}
                  </p>
                </div>
              )}

              {/* Strong Points Comparison */}
              <div style={styles.matrixGrid}>
                <div style={{ ...styles.card, flex: 1 }}>
                  <h4 style={{ ...styles.cardTitle, fontSize: 15, color: "#3b82f6" }}>💪 Your Strongest Points</h4>
                  {argument_matrix.user_strongest_points?.map((p, i) => (
                    <div key={i} style={styles.matrixItem}>
                      <span style={{ ...styles.impactDot, background: p.impact === "high" ? "#22c55e" : p.impact === "medium" ? "#f59e0b" : "#64748b" }} />
                      <div>
                        <p style={{ fontSize: 13, color: "#e2e8f0" }}>{p.point}</p>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{p.phase}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ ...styles.card, flex: 1 }}>
                  <h4 style={{ ...styles.cardTitle, fontSize: 15, color: "#ef4444" }}>💪 {botName}'s Strongest Points</h4>
                  {argument_matrix.bot_strongest_points?.map((p, i) => (
                    <div key={i} style={styles.matrixItem}>
                      <span style={{ ...styles.impactDot, background: p.impact === "high" ? "#22c55e" : p.impact === "medium" ? "#f59e0b" : "#64748b" }} />
                      <div>
                        <p style={{ fontSize: 13, color: "#e2e8f0" }}>{p.point}</p>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{p.phase}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unanswered Arguments */}
              {argument_matrix.user_unanswered_arguments && argument_matrix.user_unanswered_arguments.length > 0 && (
                <div style={{ ...styles.card, borderLeft: "4px solid #ef4444" }}>
                  <h4 style={{ ...styles.cardTitle, fontSize: 15 }}>⚠️ Arguments You Didn't Address</h4>
                  {argument_matrix.user_unanswered_arguments.map((a, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 13, color: "#e2e8f0" }}>❌ {a.argument}</p>
                      <p style={{ fontSize: 12, color: "#22c55e", marginTop: 4 }}>💡 <em>{a.suggestion}</em></p>
                    </div>
                  ))}
                </div>
              )}

              {argument_matrix.bot_unanswered_arguments && argument_matrix.bot_unanswered_arguments.length > 0 && (
                <div style={{ ...styles.card, borderLeft: "4px solid #22c55e" }}>
                  <h4 style={{ ...styles.cardTitle, fontSize: 15 }}>✅ Arguments {botName} Couldn't Answer</h4>
                  {argument_matrix.bot_unanswered_arguments.map((a, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 13, color: "#e2e8f0" }}>🎯 {a.argument}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ COACHING TAB ═══ */}
          {activeTab === "coaching" && (
            <div>
              {overall_summary?.improvement_potential && (
                <div style={{ ...styles.card, borderLeft: "4px solid #8b5cf6" }}>
                  <h3 style={styles.cardTitle}>🎯 Your Biggest Growth Area</h3>
                  <p style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.6 }}>{overall_summary.improvement_potential}</p>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
                {coaching_tips?.map((tip, i) => (
                  <div
                    key={i}
                    style={{ ...styles.coachingCard, cursor: "pointer" }}
                    onClick={() => setExpandedTip(expandedTip === i ? null : i)}
                  >
                    <div style={styles.coachingTop}>
                      <div style={styles.coachingLeft}>
                        <span style={{ fontSize: 24 }}>{categoryIcons[tip.category] || "💡"}</span>
                        <div>
                          <span style={styles.coachingTitle}>{tip.title}</span>
                          <span style={styles.coachingCategory}>{tip.category}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ ...styles.priorityBadge, background: priorityColors[tip.priority] || "#f59e0b" }}>
                          {tip.priority} priority
                        </span>
                        <span style={{ fontSize: 14, color: "#64748b" }}>{expandedTip === i ? "▲" : "▼"}</span>
                      </div>
                    </div>
                    {expandedTip === i && (
                      <div style={styles.coachingDetails}>
                        <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7 }}>{tip.tip}</p>
                        {tip.example && (
                          <div style={styles.exampleBlock}>
                            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>💡 EXAMPLE</span>
                            <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, marginTop: 4 }}>{tip.example}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer ─────────────────────────────────────────────────── */}
        <div style={styles.footer}>
          <Button onClick={onClose} style={styles.closeButton}>
            ← Back to Results
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes analytics-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes analytics-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes analytics-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes analytics-fill {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 95%; }
        }
      `}</style>
    </div>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 100001,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.85)",
    backdropFilter: "blur(12px)",
    padding: 16,
  },
  container: {
    background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    width: "100%",
    maxWidth: 900,
    maxHeight: "92vh",
    overflowY: "auto",
    boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 100px rgba(59,130,246,0.06)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "24px 28px 0",
  },
  headerLeft: {},
  mainTitle: {
    fontSize: 26,
    fontWeight: 800,
    color: "#f1f5f9",
    margin: 0,
    letterSpacing: "-0.5px",
  },
  topicLabel: {
    fontSize: 14,
    color: "#e2e8f0",
    marginTop: 6,
  },
  closeBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#94a3b8",
    borderRadius: 10,
    width: 36,
    height: 36,
    cursor: "pointer",
    fontSize: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  qualityBadge: {
    margin: "16px 28px 0",
    padding: "10px 20px",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#fff",
    fontSize: 14,
    flexWrap: "wrap" as const,
  },
  vsSection: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
    padding: "20px 28px",
  },
  vsPlayer: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 8,
  },
  vsAvatar: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    border: "3px solid #3b82f6",
    objectFit: "cover" as const,
  },
  vsName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#e2e8f0",
  },
  vsBadge: {
    fontSize: 18,
    fontWeight: 900,
    color: "#f59e0b",
    background: "rgba(245,158,11,0.1)",
    padding: "8px 16px",
    borderRadius: 12,
    border: "1px solid rgba(245,158,11,0.2)",
  },
  tabBar: {
    display: "flex",
    gap: 4,
    padding: "0 28px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    overflowX: "auto" as const,
  },
  tab: {
    padding: "12px 18px",
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    display: "flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap" as const,
    transition: "color 0.2s, border-color 0.2s",
  },
  tabActive: {
    color: "#3b82f6",
    borderBottomColor: "#3b82f6",
  },
  tabBadge: {
    background: "rgba(59,130,246,0.2)",
    color: "#3b82f6",
    padding: "2px 7px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
  },
  tabContent: {
    padding: "20px 28px",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "#f1f5f9",
    margin: 0,
    marginBottom: 16,
  },
  pillarGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 16,
  },
  pillarCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 16,
  },
  pillarHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  pillarName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#cbd5e1",
  },
  pillarScores: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 12,
  },
  pillarScoreItem: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
  },
  pillarVs: {
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
  },
  pillarBar: {
    height: 4,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    marginBottom: 12,
    overflow: "hidden",
  },
  pillarBarUser: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
    borderRadius: 2,
    transition: "width 1.5s ease-out",
  },
  pillarFeedback: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 1.5,
    margin: 0,
  },
  fallacySummary: {
    display: "flex",
    gap: 24,
    justifyContent: "center",
  },
  fallacyStat: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 4,
  },
  fallacyCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderLeft: "4px solid",
    borderRadius: 12,
    padding: 16,
    transition: "background 0.2s",
  },
  fallacyTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 8,
  },
  fallacyLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  fallacyType: {
    fontSize: 14,
    fontWeight: 700,
    color: "#f1f5f9",
  },
  fallacySender: {
    fontSize: 12,
    fontWeight: 600,
    marginLeft: 6,
  },
  fallacyBadges: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  severityBadge: {
    padding: "3px 10px",
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
    color: "#fff",
    textTransform: "uppercase" as const,
  },
  phaseBadge: {
    padding: "3px 10px",
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 600,
    color: "#94a3b8",
    background: "rgba(255,255,255,0.06)",
  },
  fallacyDetails: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  quoteBlock: {
    background: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    padding: 14,
    borderLeft: "3px solid #f59e0b",
  },
  quoteText: {
    fontSize: 13,
    color: "#e2e8f0",
    fontStyle: "italic",
    lineHeight: 1.6,
    marginTop: 6,
    margin: 0,
  },
  matrixGrid: {
    display: "flex",
    gap: 12,
    marginBottom: 16,
  },
  matrixItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  impactDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    marginTop: 6,
    flexShrink: 0,
  },
  coachingCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 16,
    transition: "background 0.2s",
  },
  coachingTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 8,
  },
  coachingLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  coachingTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#f1f5f9",
    display: "block",
  },
  coachingCategory: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 600,
  },
  priorityBadge: {
    padding: "3px 10px",
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
    color: "#fff",
    textTransform: "uppercase" as const,
  },
  coachingDetails: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  exampleBlock: {
    marginTop: 12,
    background: "rgba(34,197,94,0.06)",
    borderRadius: 10,
    padding: 14,
    borderLeft: "3px solid #22c55e",
  },
  footer: {
    padding: "16px 28px 24px",
    display: "flex",
    justifyContent: "center",
  },
  closeButton: {
    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
    color: "#fff",
    padding: "12px 32px",
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
  },
  // Loading styles
  loadingContainer: {
    background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "48px 40px",
    maxWidth: 500,
    textAlign: "center" as const,
  },
  loadingPulse: {
    position: "relative" as const,
    width: 80,
    height: 80,
    margin: "0 auto 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerRing: {
    position: "absolute" as const,
    width: 80,
    height: 80,
    border: "3px solid transparent",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "analytics-spin 1.2s linear infinite",
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#f1f5f9",
    margin: "0 0 10px",
  },
  loadingText: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.6,
    margin: "0 0 24px",
  },
  loadingBar: {
    height: 4,
    background: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  loadingBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)",
    borderRadius: 2,
    animation: "analytics-fill 8s ease-in-out infinite",
  },
};

export default DebateAnalyticsReport;
