import React, { forwardRef } from 'react';
import { DebateVictoryCardData, CardTheme } from './types';
import { Trophy, Crown, Swords, Scale, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';

interface DebateVictoryCardProps {
  data: DebateVictoryCardData;
  theme?: CardTheme;
  className?: string;
}

const themeStyles: Record<
  CardTheme,
  {
    bg: string;
    border: string;
    glowWinner: string;
    glowOpponent: string;
    accentGradient: string;
    badgeWinnerBg: string;
    badgeOpponentBg: string;
    winnerRing: string;
    topicBg: string;
    scoreWinnerColor: string;
    scoreOpponentColor: string;
  }
> = {
  championship: {
    bg: 'bg-gradient-to-br from-[#0c101c] via-[#11192b] to-[#1e152f]',
    border: 'border-amber-500/30',
    glowWinner: 'from-amber-500/20 via-yellow-500/10 to-transparent',
    glowOpponent: 'from-blue-500/10 via-slate-500/5 to-transparent',
    accentGradient: 'from-amber-400 via-orange-400 to-yellow-500',
    badgeWinnerBg: 'bg-gradient-to-r from-amber-500 to-yellow-600 text-black',
    badgeOpponentBg: 'bg-slate-800/80 text-slate-300 border border-slate-700',
    winnerRing: 'ring-4 ring-amber-400/80 shadow-[0_0_35px_rgba(251,191,36,0.35)]',
    topicBg: 'bg-white/[0.04] border-white/10',
    scoreWinnerColor: 'text-amber-300',
    scoreOpponentColor: 'text-slate-300',
  },
  cyber: {
    bg: 'bg-gradient-to-br from-[#060b17] via-[#09152e] to-[#170c2e]',
    border: 'border-cyan-500/30',
    glowWinner: 'from-cyan-500/20 via-fuchsia-500/10 to-transparent',
    glowOpponent: 'from-violet-500/10 via-slate-500/5 to-transparent',
    accentGradient: 'from-cyan-400 via-teal-300 to-fuchsia-400',
    badgeWinnerBg: 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black',
    badgeOpponentBg: 'bg-slate-900/80 text-cyan-200 border border-cyan-800/60',
    winnerRing: 'ring-4 ring-cyan-400/80 shadow-[0_0_35px_rgba(34,211,238,0.4)]',
    topicBg: 'bg-cyan-950/20 border-cyan-500/20',
    scoreWinnerColor: 'text-cyan-300',
    scoreOpponentColor: 'text-slate-300',
  },
  obsidian: {
    bg: 'bg-gradient-to-br from-[#09090b] via-[#131418] to-[#09090b]',
    border: 'border-emerald-500/30',
    glowWinner: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    glowOpponent: 'from-slate-700/20 via-zinc-800/10 to-transparent',
    accentGradient: 'from-emerald-400 via-teal-400 to-green-500',
    badgeWinnerBg: 'bg-gradient-to-r from-emerald-400 to-teal-500 text-black',
    badgeOpponentBg: 'bg-zinc-800/80 text-zinc-300 border border-zinc-700',
    winnerRing: 'ring-4 ring-emerald-400/80 shadow-[0_0_35px_rgba(52,211,153,0.35)]',
    topicBg: 'bg-white/[0.03] border-white/10',
    scoreWinnerColor: 'text-emerald-300',
    scoreOpponentColor: 'text-zinc-300',
  },
};

const formatDate = (dateInput?: string | Date): string => {
  if (!dateInput) return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(dateInput);
  }
};

const getInitials = (name?: string): string => {
  if (!name) return 'D';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export const DebateVictoryCard = forwardRef<HTMLDivElement, DebateVictoryCardProps>(
  ({ data, theme = 'championship', className = '' }, ref) => {
    const activeTheme = themeStyles[theme] || themeStyles.championship;
    const isDraw = Boolean(data.isDraw);
    const dateFormatted = formatDate(data.date);

    return (
      <div
        ref={ref}
        className={`relative box-border select-none text-white font-sans overflow-hidden border ${activeTheme.border} ${activeTheme.bg} ${className}`}
        style={{
          width: 1200,
          height: 630,
          minWidth: 1200,
          minHeight: 630,
          maxWidth: 1200,
          maxHeight: 630,
        }}
      >
        {/* Ambient Radial Lights */}
        <div
          className={`absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-radial ${activeTheme.glowWinner} blur-3xl pointer-events-none`}
        />
        <div
          className={`absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gradient-radial ${activeTheme.glowOpponent} blur-3xl pointer-events-none`}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-white/[0.015] rounded-full blur-2xl pointer-events-none" />

        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Inner Content Padding Container */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between p-8">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30 border border-white/20">
                <Scale className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black tracking-tight text-white">
                    Debate<span className={`bg-gradient-to-r ${activeTheme.accentGradient} bg-clip-text text-transparent`}>AI</span>
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10 tracking-wider">
                    AOSSIE
                  </span>
                </div>
                <p className="text-xs text-white/50 tracking-wider uppercase font-medium">Competitive Debate Platform</p>
              </div>
            </div>

            {/* Match Type Badge & Date */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.08] border border-white/15 backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white/90">
                  {data.matchType || '1v1 Ranked Match'}
                </span>
              </div>
              <div className="px-3.5 py-1.5 rounded-full bg-black/40 border border-white/10 text-xs font-semibold text-white/60 tracking-wider">
                {dateFormatted}
              </div>
            </div>
          </div>

          {/* Topic / Motion Box */}
          <div className={`mt-3 px-6 py-4 rounded-2xl border ${activeTheme.topicBg} backdrop-blur-md shadow-inner flex flex-col justify-center`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-widest text-amber-400/90">
                Debate Motion
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-white leading-tight line-clamp-2 tracking-normal drop-shadow-sm">
              "{data.topic || 'Competitive Debate Motion'}"
            </h2>
          </div>

          {/* Head-to-Head Clash Layout */}
          <div className="my-auto grid grid-cols-11 items-center gap-4 py-2">
            {/* Winner / Left Side */}
            <div className="col-span-5 flex items-center justify-start gap-5 bg-white/[0.03] border border-white/10 rounded-2xl p-4 backdrop-blur-md">
              {/* Avatar + Crown */}
              <div className="relative flex-shrink-0">
                {!isDraw && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 drop-shadow-[0_4px_8px_rgba(245,158,11,0.6)] animate-bounce">
                    <Crown className="w-8 h-8 text-amber-400 fill-amber-400" />
                  </div>
                )}
                <div className={`w-24 h-24 rounded-full overflow-hidden ${activeTheme.winnerRing} bg-slate-800 flex items-center justify-center relative`}>
                  {data.winner.avatarUrl ? (
                    <img
                      src={data.winner.avatarUrl}
                      alt={data.winner.name}
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span className="text-2xl font-black text-amber-300">
                    {getInitials(data.winner.name)}
                  </span>
                </div>
              </div>

              {/* Winner Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${activeTheme.badgeWinnerBg} font-mono shadow-sm`}>
                    {isDraw ? 'Debater' : 'VICTOR'}
                  </span>
                  {data.winner.stance && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-white/80 border border-white/10">
                      {data.winner.stance}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-black text-white truncate tracking-tight drop-shadow-sm">
                  {data.winner.name || 'Debater'}
                </h3>

                {/* Score & Rating Change */}
                <div className="mt-2 flex items-baseline gap-3">
                  {data.winner.score !== undefined && data.winner.score !== null ? (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-white/50 block">Score</span>
                      <span className={`text-3xl font-black leading-none ${activeTheme.scoreWinnerColor}`}>
                        {data.winner.score}
                        <span className="text-sm font-semibold text-white/40">/{data.winner.maxScore || 100}</span>
                      </span>
                    </div>
                  ) : null}

                  {data.winner.eloChange !== undefined && data.winner.eloChange !== null ? (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{data.winner.eloChange >= 0 ? `+${data.winner.eloChange}` : data.winner.eloChange} ELO</span>
                    </div>
                  ) : data.winner.eloRating !== undefined && data.winner.eloRating !== null ? (
                    <div className="text-xs text-white/60 font-semibold">
                      Rating: <span className="text-white font-bold">{Math.round(data.winner.eloRating)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* VS Center Emblem */}
            <div className="col-span-1 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-500 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.5)] border-2 border-white/40">
                  <Swords className="w-7 h-7 text-white" />
                </div>
              </div>
              <span className="mt-2 text-[10px] font-black uppercase tracking-widest text-white/60">
                {isDraw ? 'TIE' : 'VS'}
              </span>
            </div>

            {/* Opponent / Right Side */}
            <div className="col-span-5 flex items-center justify-start gap-5 bg-white/[0.02] border border-white/10 rounded-2xl p-4 backdrop-blur-md">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-slate-600/80 bg-slate-800 flex items-center justify-center relative">
                  {data.opponent.avatarUrl ? (
                    <img
                      src={data.opponent.avatarUrl}
                      alt={data.opponent.name}
                      crossOrigin="anonymous"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span className="text-2xl font-black text-slate-300">
                    {getInitials(data.opponent.name)}
                  </span>
                </div>
              </div>

              {/* Opponent Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${activeTheme.badgeOpponentBg}`}>
                    {isDraw ? 'Debater' : 'RUNNER-UP'}
                  </span>
                  {data.opponent.stance && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-white/80 border border-white/10">
                      {data.opponent.stance}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-bold text-white/90 truncate tracking-tight">
                  {data.opponent.name || 'Opponent'}
                </h3>

                {/* Score & Rating */}
                <div className="mt-2 flex items-baseline gap-3">
                  {data.opponent.score !== undefined && data.opponent.score !== null ? (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-white/50 block">Score</span>
                      <span className={`text-3xl font-black leading-none ${activeTheme.scoreOpponentColor}`}>
                        {data.opponent.score}
                        <span className="text-sm font-semibold text-white/40">/{data.opponent.maxScore || 100}</span>
                      </span>
                    </div>
                  ) : null}

                  {data.opponent.eloChange !== undefined && data.opponent.eloChange !== null ? (
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs ${
                      data.opponent.eloChange >= 0
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                    }`}>
                      {data.opponent.eloChange >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      <span>{data.opponent.eloChange >= 0 ? `+${data.opponent.eloChange}` : data.opponent.eloChange} ELO</span>
                    </div>
                  ) : data.opponent.eloRating !== undefined && data.opponent.eloRating !== null ? (
                    <div className="text-xs text-white/60 font-semibold">
                      Rating: <span className="text-white font-bold">{Math.round(data.opponent.eloRating)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* AI Verdict Highlight Strip */}
          {data.verdictHighlight ? (
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-white/[0.03] to-transparent border border-amber-500/20 backdrop-blur-sm">
              <Trophy className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div className="text-xs text-white/80 truncate">
                <span className="font-extrabold uppercase tracking-wider text-amber-300 mr-2">Judge Verdict:</span>
                <span className="italic">"{data.verdictHighlight}"</span>
              </div>
            </div>
          ) : null}

          {/* Footer Bar / Watermark */}
          <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-white/50">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Verified Debate Match</span>
              <span>•</span>
              <span className="font-semibold text-white/70">debateai.aossie.org</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Official Match Summary</span>
              <span>•</span>
              <span className="font-medium text-amber-300/80">AOSSIE Open Source</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

DebateVictoryCard.displayName = 'DebateVictoryCard';

export default DebateVictoryCard;
