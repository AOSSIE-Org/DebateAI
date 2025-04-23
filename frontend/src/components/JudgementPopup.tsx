import React from "react";
import { Button } from "./ui/button"; // Adjust the path as needed
import { useNavigate } from "react-router-dom";

// Define both possible JudgmentData types
type JudgmentDataUserBot = {
  opening_statement: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  cross_examination: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  answers: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  closing: { user: { score: number; reason: string }; bot: { score: number; reason: string } };
  total: { user: number; bot: number };
  verdict: { winner: string; reason: string; congratulations: string; opponent_analysis: string };
};

type JudgmentDataForAgainst = {
  opening_statement: { for: { score: number; reason: string }; against: { score: number; reason: string } };
  cross_examination_questions: { for: { score: number; reason: string }; against: { score: number; reason: string } };
  cross_examination_answers: { for: { score: number; reason: string }; against: { score: number; reason: string } };
  closing: { for: { score: number; reason: string }; against: { score: number; reason: string } };
  total: { for: number; against: number };
  verdict: { winner: string; reason: string; congratulations: string; opponent_analysis: string };
};

// Union type for JudgmentData
type JudgmentData = JudgmentDataUserBot | JudgmentDataForAgainst;

type JudgmentPopupProps = {
  judgment: JudgmentData;
  // For DebateRoom (user vs. bot)
  userAvatar?: string;
  botAvatar?: string;
  botName?: string;
  userStance?: string;
  botStance?: string;
  botDesc?: string;
  // For OnlineDebateRoom (for vs. against)
  forRole?: string; // e.g., "You" or "Opponent"
  againstRole?: string; // e.g., "You" or "Opponent"
  onClose: () => void;
};

const JudgmentPopup: React.FC<JudgmentPopupProps> = ({
  judgment,
  userAvatar,
  botAvatar,
  botName,
  userStance,
  botStance,
  botDesc,
  forRole,
  againstRole,
  onClose,
}) => {
  const navigate = useNavigate();
  const userName = "You"; // Default for DebateRoom; could be dynamic

  // Fetch avatars from localStorage with fallbacks
  const localAvatar = localStorage.getItem('userAvatar') || 'https://avatar.iran.liara.run/public/40';
  const opponentAvatar = localStorage.getItem('opponentAvatar') || 'https://avatar.iran.liara.run/public/31';

  // Determine if we're dealing with user/bot or for/against format
  const isUserBotFormat = "user" in judgment.opening_statement;
  const player1Name = isUserBotFormat ? userName : (forRole || "For Debater");
  const player2Name = isUserBotFormat ? (botName || "Bot") : (againstRole || "Against Debater");
  const player1Stance = isUserBotFormat ? userStance : "For";
  const player2Stance = isUserBotFormat ? botStance : "Against";

  // Assign avatars based on forRole and againstRole for user vs. user scenario
  const player1Avatar = isUserBotFormat
    ? userAvatar
    : (forRole === "You" ? localAvatar : opponentAvatar);
  const player2Avatar = isUserBotFormat
    ? botAvatar
    : (againstRole === "You" ? localAvatar : opponentAvatar);
  const player2Desc = isUserBotFormat ? botDesc : "Debater";

  const handleGoHome = () => {
    navigate("/startdebate");
  };

  // Helper function to safely access scores and reasons
  const getScoreAndReason = (section: string, player: "player1" | "player2") => {
    if (isUserBotFormat) {
      const data = judgment as JudgmentDataUserBot;
      const key = player === "player1" ? "user" : "bot";
      switch (section) {
        case "opening_statement":
          return { score: data.opening_statement[key].score, reason: data.opening_statement[key].reason };
        case "cross_examination":
          return { score: data.cross_examination[key].score, reason: data.cross_examination[key].reason };
        case "answers":
          return { score: data.answers[key].score, reason: data.answers[key].reason };
        case "closing":
          return { score: data.closing[key].score, reason: data.closing[key].reason };
        case "total":
          return { score: data.total[key], reason: "" };
        default:
          return { score: 0, reason: "Data not available" };
      }
    } else {
      const data = judgment as JudgmentDataForAgainst;
      const key = player === "player1" ? "for" : "against";
      switch (section) {
        case "opening_statement":
          return { score: data.opening_statement[key].score, reason: data.opening_statement[key].reason };
        case "cross_examination_questions":
          return { score: data.cross_examination_questions[key].score, reason: data.cross_examination_questions[key].reason };
        case "cross_examination_answers":
          return { score: data.cross_examination_answers[key].score, reason: data.cross_examination_answers[key].reason };
        case "closing":
          return { score: data.closing[key].score, reason: data.closing[key].reason };
        case "total":
          return { score: data.total[key], reason: "" };
        default:
          return { score: 0, reason: "Data not available" };
      }
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
      <div className="bg-gradient-to-br from-white to-gray-100 p-8 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200 transform transition-all duration-300 scale-100 hover:scale-102">
        {/* Top Profile Section */}
        <div className="flex justify-between items-center mb-8">
          {/* Player 1 Profile */}
          <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-lg shadow-sm w-1/2 mr-2">
            <img
              src={player1Avatar}
              alt={player1Name}
              className="w-16 h-16 rounded-full border-2 border-orange-400 object-cover"
            />
            <div>
              <h3 className="text-xl font-bold text-gray-800">{player1Name}</h3>
              <p className="text-sm text-gray-600">
                Stance: <span className="font-semibold text-orange-500">{player1Stance}</span>
              </p>
              <p className="text-xs text-gray-500">Debater</p>
            </div>
          </div>
          {/* Player 2 Profile */}
          <div className="flex items-center space-x-4 bg-gray-50 p-4 rounded-lg shadow-sm w-1/2 ml-2">
            <img
              src={player2Avatar}
              alt={player2Name}
              className="w-16 h-16 rounded-full border-2 border-orange-400 object-cover"
            />
            <div>
              <h3 className="text-xl font-bold text-gray-800">{player2Name}</h3>
              <p className="text-sm text-gray-600">
                Stance: <span className="font-semibold text-orange-500">{player2Stance}</span>
              </p>
              <p className="text-xs text-gray-500">{player2Desc || "Debater"}</p>
            </div>
          </div>
        </div>

        {/* Phase Sections */}
        <div className="space-y-10">
          {/* Opening Statement */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-2xl font-bold text-gray-800 text-center mb-6">Opening Statement</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-700">{player1Name}</h4>
                <p className="mt-2 text-xl font-bold text-orange-600">{getScoreAndReason("opening_statement", "player1").score}/10</p>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{getScoreAndReason("opening_statement", "player1").reason}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-700">{player2Name}</h4>
                <p className="mt-2 text-xl font-bold text-orange-600">{getScoreAndReason("opening_statement", "player2").score}/10</p>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{getScoreAndReason("opening_statement", "player2").reason}</p>
              </div>
            </div>
          </div>

          {/* Cross Examination */}
          {isUserBotFormat ? (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-2xl font-bold text-gray-800 text-center mb-6">Cross Examination</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-700">{player1Name}</h4>
                  <p className="mt-2 text-xl font-bold text-orange-600">{getScoreAndReason("cross_examination", "player1").score}/10</p>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{getScoreAndReason("cross_examination", "player1").reason}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-700">{player2Name}</h4>
                  <p className="mt-2 text-xl font-bold text-orange-600">{getScoreAndReason("cross_examination", "player2").score}/10</p>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{getScoreAndReason("cross_examination", "player2").reason}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-2xl font-bold text-gray-800 text-center mb-6">Cross Examination Questions</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-700">{player1Name}</h4>
                    <p className="mt-2 text-xl font-bold text-orange-600">{getScoreAndReason("cross_examination_questions", "player1").score}/10</p>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{getScoreAndReason("cross_examination_questions", "player1").reason}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-700">{player2Name}</h4>
                    <p className="mt-2 text-xl font-bold text-orange-600">{getScoreAndReason("cross_examination_questions", "player2").score}/10</p>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{getScoreAndReason("cross_examination_questions", "player2").reason}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-2xl font-bold text-gray-800 text-center mb-6">Cross Examination Answers</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-700">{player1Name}</h4>
                    <p className="mt-2 text-xl font-bold text-orange-600">{getScoreAndReason("cross_examination_answers", "player1").score}/10</p>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{getScoreAndReason("cross_examination_answers", "player1").reason}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-700">{player2Name}</h4>
                    <p className="mt-2 text-xl font-bold text-orange-600">{getScoreAndReason("cross_examination_answers", "player2").score}/10</p>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{getScoreAndReason("cross_examination_answers", "player2").reason}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Answers (only for user/bot format) */}
          {isUserBotFormat && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-2xl font-bold text-gray-800 text-center mb-6">Answers to Cross Examination</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-700">{player1Name}</h4>
                  <p className="mt-2 text-xl font-bold text-orange-600">{getScoreAndReason("answers", "player1").score}/10</p>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{getScoreAndReason("answers", "player1").reason}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-700">{player2Name}</h4>
                  <p className="mt-2 text-xl font-bold text-orange-600">{getScoreAndReason("answers", "player2").score}/10</p>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{getScoreAndReason("answers", "player2").reason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Closing Statement */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-2xl font-bold text-gray-800 text-center mb-6">Closing Statement</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-700">{player1Name}</h4>
                <p className="mt-2 text-xl font-bold text-orange-600">{getScoreAndReason("closing", "player1").score}/10</p>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{getScoreAndReason("closing", "player1").reason}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-700">{player2Name}</h4>
                <p className="mt-2 text-xl font-bold text-orange-600">{getScoreAndReason("closing", "player2").score}/10</p>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{getScoreAndReason("closing", "player2").reason}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Total Scores */}
        <div className="mt-10 bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-2xl font-bold text-gray-800 text-center mb-6">Total Scores</h3>
          <div className="flex justify-around items-center">
            <div className="text-center">
              <p className="text-4xl font-bold text-orange-600">{getScoreAndReason("total", "player1").score}</p>
              <p className="text-sm text-gray-500">/ 40</p>
              <p className="text-lg font-semibold text-gray-700">{player1Name}</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-orange-600">{getScoreAndReason("total", "player2").score}</p>
              <p className="text-sm text-gray-500">/ 40</p>
              <p className="text-lg font-semibold text-gray-700">{player2Name}</p>
            </div>
          </div>
        </div>

        {/* Verdict */}
        <div className="mt-10 bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-lg shadow-md text-white text-center">
          <h3 className="text-2xl font-bold">Verdict</h3>
          <p className="mt-4 text-3xl font-bold">{judgment.verdict.winner} Wins!</p>
          <p className="mt-3 text-lg">{judgment.verdict.congratulations}</p>
          <p className="mt-2 text-md leading-relaxed">{judgment.verdict.opponent_analysis}</p>
        </div>

        {/* Buttons */}
        <div className="text-center mt-8">
          <Button
            onClick={handleGoHome}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-full text-lg font-semibold transition-all duration-200 transform hover:scale-105 mr-4"
          >
            Back to Home
          </Button>
          <Button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-full text-lg font-semibold transition-all duration-200 transform hover:scale-105"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default JudgmentPopup;