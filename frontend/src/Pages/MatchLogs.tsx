import React from "react";

interface Score {
  [key: string]: string;
}

interface MatchLog {
  match: string;
  score?: Score;
  timestamp: string;
  duration: string;
  viewers: number;
}

const logs: MatchLog[] = [
  {
    match: "First Round Match 1: Rishit Tiwari vs Aarav Singh",
    score: {
      opening: "10-8",
      QA: "9-7",
      closing: "9-9",
      total: "28-24",
    },
    timestamp: "April 21, 2025 - 8:00 AM",
    duration: "25 mins",
    viewers: 85,
  },
  {
    match: "First Round Match 2: Ishaan Mehta vs Vihaan Kapoor",
    score: {
      opening: "9-9",
      QA: "8-8",
      closing: "10-8",
      total: "27-25",
    },
    timestamp: "April 21, 2025 - 8:30 AM",
    duration: "25 mins",
    viewers: 90,
  },
  {
    match: "First Round Match 3: Ayaan Khanna vs Vivaan Sharma",
    score: {
      opening: "8-9",
      QA: "9-8",
      closing: "9-9",
      total: "26-26",
    },
    timestamp: "April 21, 2025 - 9:00 AM",
    duration: "25 mins",
    viewers: 80,
  },
  {
    match: "First Round Match 4: Devansh Joshi vs Kabir Malhotra",
    score: {
      opening: "9-10",
      QA: "7-9",
      closing: "8-9",
      total: "24-28",
    },
    timestamp: "April 21, 2025 - 9:30 AM",
    duration: "25 mins",
    viewers: 95,
  },
  {
    match: "Semifinal A: Rishit Tiwari vs Ayaan Khanna",
    score: {
      opening: "10-9",
      QA: "9-8",
      closing: "10-10",
      total: "29-27",
    },
    timestamp: "April 21, 2025 - 10:00 AM",
    duration: "30 mins",
    viewers: 123,
  },
  {
    match: "Semifinal B: Ishaan Mehta vs Kabir Malhotra",
    score: {
      opening: "9-10",
      QA: "8-9",
      closing: "10-9",
      total: "27-28",
    },
    timestamp: "April 21, 2025 - 11:00 AM",
    duration: "30 mins",
    viewers: 98,
  },
  {
    match: "Final: Rishit Tiwari vs Kabir Malhotra",
    score: {
      opening: "10-9",
      QA: "9-9",
      closing: "10-8",
      total: "29-26",
    },
    timestamp: "April 21, 2025 - 12:00 PM",
    duration: "40 mins",
    viewers: 156,
  },
];

const MatchLogs: React.FC = () => {
  const getMatchDetails = (log: MatchLog) => {
    const [player1, player2] = log.match.split(" vs ");
    const stage = log.match.includes("First Round")
      ? "First Round"
      : log.match.includes("Semifinal")
      ? "Semifinal"
      : "Final";
    let winner = "";
    if (log.score && log.score.total) {
      const [score1, score2] = log.score.total.split("-").map(Number);
      if (score1 > score2) winner = player1.split(": ")[1];
      else if (score2 > score1) winner = player2;
      else winner = stage === "First Round Match 3" ? "Ayaan Khanna (Tiebreaker)" : "";
    }
    return { player1: player1.split(": ")[1] || player1, player2, stage, winner };
  };

  return (
    <div className="p-6 max-w-4xl mx-auto bg-background h-[calc(100vh-350px)]">
      <h2 className="text-2xl font-bold text-foreground mb-6">Match Logs</h2>
      <div className="space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto scrollbar-hide">
        {[...logs].reverse().map((log, index) => {
          const { player1, player2, stage, winner } = getMatchDetails(log);
          return (
            <div key={index} className="bg-card border border-border rounded-lg shadow-sm p-5 hover:shadow-md transition-all duration-300">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-md transition-all duration-200 ${
                      stage === "Final"
                        ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                        : stage === "Semifinal"
                        ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                  >
                    {stage}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <h3 className="text-xl font-bold text-foreground">
                    {player1} vs {player2}
                  </h3>
                  <span className="text-sm text-muted-foreground">{log.timestamp}</span>
                </div>
              </div>
              <div className="h-px bg-border mb-4" />
              <div className="mb-4">
                <div className="grid grid-cols-3 gap-2 text-sm text-foreground">
                  <span className="font-medium capitalize">Category</span>
                  <span className="font-medium">{player1}</span>
                  <span className="font-medium">{player2}</span>
                  {Object.entries(log.score || {}).map(([key, value]) => {
                    if (key === "total") return null;
                    const [score1, score2] = value.split("-");
                    return (
                      <React.Fragment key={key}>
                        <span className="capitalize text-muted-foreground">{key}</span>
                        <span className={parseInt(score1) > parseInt(score2) ? "text-primary font-medium" : ""}>{score1}</span>
                        <span className={parseInt(score2) > parseInt(score1) ? "text-primary font-medium" : ""}>{score2}</span>
                      </React.Fragment>
                    );
                  })}
                  <span className="font-semibold">Total</span>
                  <span
                    className={`font-semibold ${
                      log.score && parseInt(log.score.total.split("-")[0]) > parseInt(log.score.total.split("-")[1]) ? "text-primary" : ""
                    }`}
                  >
                    {log.score?.total.split("-")[0]}
                  </span>
                  <span
                    className={`font-semibold ${
                      log.score && parseInt(log.score.total.split("-")[1]) > parseInt(log.score.total.split("-")[0]) ? "text-primary" : ""
                    }`}
                  >
                    {log.score?.total.split("-")[1]}
                  </span>
                </div>
                {stage === "First Round Match 3" && (
                  <p className="text-xs text-muted-foreground mt-2">
                    * Ayaan Khanna advanced via tiebreaker
                  </p>
                )}
              </div>
              <div className="flex justify-between items-center border-t pt-3 text-sm">
                <div className="flex items-center gap-2">
                  {winner && (
                    <>
                      <span className="text-yellow-500">🏆</span>
                      <span className="font-medium text-foreground">Winner: {winner}</span>
                    </>
                  )}
                </div>
                <div className="flex gap-4 text-muted-foreground">
                  <span>⏱ {log.duration}</span>
                  <span>👁 {log.viewers} viewers</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MatchLogs;
