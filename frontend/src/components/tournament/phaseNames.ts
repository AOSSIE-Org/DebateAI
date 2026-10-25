import type { TournamentRound } from "@/services/tournamentService";

export const tournamentPhases: { round: TournamentRound; label: string; shortLabel: string }[] = [
  { round: "opening_statement_for", label: "Opening statement - For", shortLabel: "Opening - For" },
  { round: "opening_statement_against", label: "Opening statement - Against", shortLabel: "Opening - Against" },
  { round: "cross_examination_question_for", label: "Cross-examination question - For", shortLabel: "Question - For" },
  { round: "cross_examination_answer_against", label: "Cross-examination answer - Against", shortLabel: "Answer - Against" },
  { round: "cross_examination_question_against", label: "Cross-examination question - Against", shortLabel: "Question - Against" },
  { round: "cross_examination_answer_for", label: "Cross-examination answer - For", shortLabel: "Answer - For" },
  { round: "closing_statement_for", label: "Closing statement - For", shortLabel: "Closing - For" },
  { round: "closing_statement_against", label: "Closing statement - Against", shortLabel: "Closing - Against" },
];
export const tournamentPhaseNames = Object.fromEntries(tournamentPhases.map(phase => [phase.round, phase.label])) as Record<TournamentRound, string>;
