export type CardTheme = 'championship' | 'cyber' | 'obsidian';

export interface DebaterInfo {
  name: string;
  avatarUrl?: string | null;
  stance?: string; // 'For' | 'Against' | 'Affirmative' | 'Negative'
  score?: number | null;
  maxScore?: number;
  eloRating?: number | null;
  eloChange?: number | null;
  isWinner?: boolean;
}

export type DebateMatchType =
  | '1v1 Ranked'
  | 'AI Arena'
  | 'Team Debate'
  | 'Practice Debate';

export interface DebateVictoryCardData {
  id?: string;
  topic: string;
  matchType?: DebateMatchType | string;
  date?: string | Date;
  winner: DebaterInfo;
  opponent: DebaterInfo;
  isDraw?: boolean;
  verdictHighlight?: string | null;
  theme?: CardTheme;
}
