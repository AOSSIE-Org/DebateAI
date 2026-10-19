export type OverallScores = {
  persuasion: number;
  clarity: number;
  rebuttal_effectiveness: number;
};

export type ArgumentTag = 'Strong' | 'Moderate' | 'Weak';

export type ArgumentItem = {
  statement: string;
  tag: ArgumentTag;
  reason: string;
};

export type FallacyFlag = {
  statement: string;
  fallacy_type: string;
  explanation: string;
};

export type PerformanceReport = {
  id?: string;
  debateId: string;
  userId?: string;
  topic: string;
  stance: string;
  overall_scores: OverallScores;
  argument_breakdown: ArgumentItem[];
  fallacy_flags: FallacyFlag[];
  improvement_tips: string[];
  is_fallback?: boolean;
  generated_at?: string;
};

export type PerformanceReportRequest = {
  debateId: string;
  topic?: string;
  stance?: string;
  debateType?: string;
  messages?: Array<{
    sender: string;
    text: string;
    phase?: string;
  }>;
  transcripts?: Record<string, string>;
};
