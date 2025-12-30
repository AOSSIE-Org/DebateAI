import React from 'react';

export interface SideScores {
  sideA: number;
  sideB: number;
}

export interface JudgementScores {
  logic: SideScores;
  evidence: SideScores;
  persuasion: SideScores;
  rebuttal: SideScores;
}

export interface JudgementResult {
  winner: string;
  scores: JudgementScores;
  summary: string;
}

interface Props {
  judgement?: JudgementResult | null;
}

const statRow = (label: string, scores: SideScores) => (
  <div className="flex items-center justify-between py-2">
    <div className="text-sm text-gray-600">{label}</div>
    <div className="flex items-center gap-4">
      <div className="text-xs text-gray-500">Side A</div>
      <div className="font-medium text-lg">{scores.sideA}</div>
      <div className="text-xs text-gray-500">|</div>
      <div className="text-xs text-gray-500">Side B</div>
      <div className="font-medium text-lg">{scores.sideB}</div>
    </div>
  </div>
);

export default function DebateScorecard({ judgement }: Props) {
  if (!judgement) {
    return (
      <div className="p-4 bg-white rounded-lg shadow-sm">
        <div className="text-center text-gray-500">No judgement available</div>
      </div>
    );
  }

  const { winner, scores, summary } = judgement;

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-5 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Debate Scorecard</h3>
            <div
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                winner === 'Side A' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
              }`}
            >
              Winner: {winner}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-1">
            <div className="mb-2 text-sm text-gray-500">Scores</div>
            <div className="space-y-2">
              {statRow('Logic', scores.logic)}
              {statRow('Evidence', scores.evidence)}
              {statRow('Persuasion', scores.persuasion)}
              {statRow('Rebuttal', scores.rebuttal)}
            </div>
          </div>

          <div className="col-span-1">
            <div className="mb-2 text-sm text-gray-500">AI Summary</div>
            <div className="text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 p-3 rounded">
              {summary}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t text-right text-xs text-gray-400">Judged by AI</div>
      </div>
    </div>
  );
}
