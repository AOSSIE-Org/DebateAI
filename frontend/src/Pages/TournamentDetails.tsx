import TournamentBracket from './TournamentBracketPage';
import MatchLogs from './MatchLogs';

export default function BracketWithLogs() {
  return (
    <div className="flex flex-col md:flex-row w-full gap-4 p-4 md:p-6 bg-background">
      {/* Left: Bracket */}
      <div className="flex-1 rounded-2xl bg-card shadow-md border p-4 md:p-6 overflow-y-auto scrollbar-hide transition-all duration-300 hover:shadow-lg">
        <TournamentBracket />
      </div>
      {/* Right: Logs */}
      <div className="w-full md:w-[22rem] rounded-2xl bg-card shadow-md border p-4 md:p-6 overflow-y-auto scrollbar-hide transition-all duration-300 hover:shadow-lg">
        <MatchLogs />
      </div>
    </div>
  );
}
