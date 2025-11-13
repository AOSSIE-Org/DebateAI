// TournamentBracketPage.tsx
import { useState, useEffect } from 'react';

interface Participant {
  id: number;
  name: string;
  avatar: string;
}

export default function TournamentBracket() {
  const [isLoading, setIsLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      const data: Participant[] = [
        { id: 1, name: "Rishit Tiwari", avatar: `https://i.pravatar.cc/32?u=1` },
        { id: 2, name: "Aarav Singh", avatar: `https://i.pravatar.cc/32?u=2` },
        { id: 3, name: "Ishaan Mehta", avatar: `https://i.pravatar.cc/32?u=3` },
        { id: 4, name: "Vihaan Kapoor", avatar: `https://i.pravatar.cc/32?u=4` },
        { id: 5, name: "Ayaan Khanna", avatar: `https://i.pravatar.cc/32?u=5` },
        { id: 6, name: "Vivaan Sharma", avatar: `https://i.pravatar.cc/32?u=6` },
        { id: 7, name: "Devansh Joshi", avatar: `https://i.pravatar.cc/32?u=7` },
        { id: 8, name: "Kabir Malhotra", avatar: `https://i.pravatar.cc/32?u=8` },
      ];
      setParticipants(data);
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center w-full py-12">
        <div className="w-full max-w-4xl space-y-12">
          {/* Champion Skeleton */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center animate-pulse">
              <div className="h-4 w-24 bg-muted rounded mb-4"></div>
              <div className="w-16 h-16 bg-muted rounded-full"></div>
              <div className="h-4 w-20 bg-muted rounded mt-2"></div>
            </div>
          </div>
          
          {/* Finalists Skeleton */}
          <div className="w-full flex justify-around">
            {[1, 2].map((i) => (
              <div key={i} className="flex flex-col items-center animate-pulse">
                <div className="w-12 h-12 bg-muted rounded-full mb-2"></div>
                <div className="h-3 w-16 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Bracket logic
  const round1Winners = [participants[0], participants[2], participants[4], participants[7]];
  const semiFinalWinners = [round1Winners[0], round1Winners[3]];
  const champion = semiFinalWinners[1];
  const winnerHighlight = "ring-4 ring-yellow-400 shadow-lg transition-all duration-300";

  return (
    <div className="flex flex-col items-center w-full">
      <h2 className="text-2xl font-bold mb-8 text-foreground">Tournament Bracket</h2>
      {/* Champion */}
      <div className="flex justify-center mb-12">
        <div className="flex flex-col items-center relative">
          <div className="text-xs font-bold text-yellow-400 mb-2">🏆 Champion</div>
          <div className={`h-16 w-16 rounded-full bg-card flex items-center justify-center overflow-hidden ${winnerHighlight}`}>
            <img src={champion.avatar} alt="Champion" className="w-full h-full object-cover" />
          </div>
          <div className="text-xs mt-2 font-medium text-foreground">{champion.name}</div>
        </div>
      </div>

      {/* Finalists */}
      <div className="w-full flex justify-around mb-12 relative">
        {semiFinalWinners.map((finalist, index) => (
          <div key={index} className="flex flex-col items-center relative">
            <div className={`w-12 h-12 rounded-full bg-card flex items-center justify-center overflow-hidden border-2 ${finalist.id === champion.id ? winnerHighlight : 'border-border'}`}>
              <img src={finalist.avatar} alt={finalist.name} className="w-full h-full object-cover" />
            </div>
            <div className="text-xs mt-1 text-muted-foreground">{finalist.name}</div>
            <div className="absolute w-px h-6 bg-border -top-6 left-1/2 transform -translate-x-1/2" />
          </div>
        ))}
        <div className="absolute h-px bg-border top-[-24px] left-[25%] w-[50%]" />
        <div className="absolute w-px bg-border left-1/2 transform -translate-x-1/2 -top-12 h-6" />
      </div>

      {/* Semifinals */}
      <div className="w-full grid grid-cols-2 gap-2 mb-12 relative">
        {[0, 1].map((matchIndex) => {
          const player1 = round1Winners[matchIndex * 2];
          const player2 = round1Winners[matchIndex * 2 + 1];
          const winner = semiFinalWinners[matchIndex];
          return (
            <div key={matchIndex} className="relative">
              <div className="flex justify-around">
                {[player1, player2].map((player) => (
                  <div key={player.id} className="flex flex-col items-center relative">
                    <div className={`w-10 h-10 rounded-full bg-card flex items-center justify-center overflow-hidden border-2 ${player.id === winner.id ? winnerHighlight : 'border-border'}`}>
                      <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-xs mt-1 text-accent-foreground">{player.name}</div>
                    <div className="absolute w-px h-6 bg-border -top-6 left-1/2 transform -translate-x-1/2" />
                  </div>
                ))}
              </div>
              <div className="absolute h-px bg-border top-[-24px] left-[25%] w-[50%]" />
              <div className="absolute w-px bg-border left-1/2 transform -translate-x-1/2 -top-20 h-14" />
            </div>
          );
        })}
      </div>

      {/* First Round */}
      <div className="w-full grid grid-cols-4 gap-2 relative">
        {[0, 1, 2, 3].map((matchIndex) => {
          const player1 = participants[matchIndex * 2];
          const player2 = participants[matchIndex * 2 + 1];
          const winner = round1Winners[matchIndex];
          return (
            <div key={matchIndex} className="relative">
              <div className="flex justify-around">
                {[player1, player2].map((player) => (
                  <div key={player.id} className="flex flex-col items-center relative">
                    <div className={`w-8 h-8 rounded-full bg-card flex items-center justify-center overflow-hidden border-2 ${player.id === winner.id ? winnerHighlight : 'border-border'}`}>
                      <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-[10px] mt-1 text-foreground">{player.name}</div>
                    <div className="absolute w-px h-6 bg-border -top-6 left-1/2 transform -translate-x-1/2" />
                  </div>
                ))}
              </div>
              <div className="absolute h-px bg-border top-[-24px] left-[25%] w-[50%]" />
              <div className="absolute w-px bg-border left-1/2 transform -translate-x-1/2 -top-20 h-14" />
            </div>
          );
        })}
      </div>

      {/* Match Labels */}
      <div className="w-full grid grid-cols-4 gap-2 mt-4">
        <div className="text-center text-[10px] font-medium text-primary-foreground">Match 1</div>
        <div className="text-center text-[10px] font-medium text-primary-foreground">Match 2</div>
        <div className="text-center text-[10px] font-medium text-primary-foreground">Match 3</div>
        <div className="text-center text-[10px] font-medium text-primary-foreground">Match 4</div>
      </div>
    </div>
  );
}
