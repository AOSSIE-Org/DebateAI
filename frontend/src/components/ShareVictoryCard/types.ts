export interface DebateVictoryCardData {
  topic: string;
  matchType: string;
  winner: {
    name: string;
    avatarUrl?: string;
    stance?: string;
    score?: number;
    eloChange?: number;
  };
  opponent: {
    name: string;
    avatarUrl?: string;
    stance?: string;
    score?: number;
    eloChange?: number;
  };
  verdictReason?: string;
}
