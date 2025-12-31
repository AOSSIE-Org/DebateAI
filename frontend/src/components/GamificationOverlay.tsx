import React, { useEffect, useState, useRef } from "react";
import { useUser } from "@/hooks/useUser";
import {
  createGamificationWebSocket,
  GamificationEvent,
  fetchGamificationLeaderboard,
} from "@/services/gamificationService";
import BadgeUnlocked from "@/components/BadgeUnlocked";

const GamificationOverlay: React.FC = () => {
  const { user } = useUser();
  const [badgeUnlocked, setBadgeUnlocked] = useState<{
    badgeName: string;
    isOpen: boolean;
  }>({
    badgeName: "",
    isOpen: false,
  });
  const wsRef = useRef<WebSocket | null>(null);
  const previousRankRef = useRef<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !user) return;

    // Initial rank check
    fetchGamificationLeaderboard(token).then((data) => {
        const myEntry = data.debaters.find(d => d.id === user.id);
        if (myEntry) {
            previousRankRef.current = myEntry.rank;
        }
    }).catch(console.error);

    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = createGamificationWebSocket(
      token,
      async (event: GamificationEvent) => {
        if (event.userId !== user.id) return;

        if (event.type === "badge_awarded" && event.badgeName) {
          setBadgeUnlocked({
            badgeName: event.badgeName,
            isOpen: true,
          });
        } else if (event.type === "score_updated") {
            // Check for rank change
            try {
                const data = await fetchGamificationLeaderboard(token);
                const myEntry = data.debaters.find(d => d.id === user.id);
                if (myEntry) {
                    const newRank = myEntry.rank;
                    const oldRank = previousRankRef.current;
                    
                    // Celebrate if entering top 10
                    if (newRank <= 10 && oldRank !== null && oldRank > 10) {
                         setBadgeUnlocked({
                            badgeName: "Top10",
                            isOpen: true,
                          });
                    }
                    previousRankRef.current = newRank;
                }
            } catch (e) {
                console.error("Failed to check rank", e);
            }
        }
      }
    );

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user]);

  return (
    <BadgeUnlocked
      badgeName={badgeUnlocked.badgeName}
      isOpen={badgeUnlocked.isOpen}
      onClose={() => setBadgeUnlocked({ ...badgeUnlocked, isOpen: false })}
    />
  );
};

export default GamificationOverlay;
