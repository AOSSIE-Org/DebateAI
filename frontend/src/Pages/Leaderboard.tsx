"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  FaCrown,
  FaMedal,
  FaChessQueen,
  FaRobot,
  FaTrophy,
} from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { fetchLeaderboardData } from "@/services/leaderboardService";
import {
  fetchGamificationLeaderboard,
  createGamificationWebSocket,
  GamificationEvent,
} from "@/services/gamificationService";
import BadgeUnlocked from "@/components/BadgeUnlocked";
import Top10Celebration from "@/components/Top10Celebration";
import { useUser } from "@/hooks/useUser";

interface Debater {
  id: string;
  currentUser: boolean;
  rank: number;
  avatarUrl: string;
  name: string;
  score: number;
  rating: number;
}

interface Stat {
  icon: string;
  value: number | string;
  label: string;
}

interface LeaderboardData {
  debaters: Debater[];
  stats: Stat[];
}

const getRankClasses = (rank: number) => {
  if (rank === 1) return "bg-amber-100 border-2 border-amber-300";
  if (rank === 2) return "bg-slate-100 border-2 border-slate-300";
  if (rank === 3) return "bg-orange-100 border-2 border-orange-300";
  return "bg-muted/20 text-muted-foreground";
};

const mapIcon = (icon: string) => {
  switch (icon) {
    case "crown":
      return <FaCrown className="text-4xl text-primary mx-auto mb-2" />;
    case "medal":
      return <FaMedal className="text-4xl text-primary mx-auto mb-2" />;
    case "chessQueen":
      return <FaChessQueen className="text-4xl text-primary mx-auto mb-2" />;
    default:
      return <FaCrown className="text-4xl text-primary mx-auto mb-2" />;
  }
};

type SortCategory = "score" | "rating" | null;

const Leaderboard: React.FC = () => {
  const [visibleCount, setVisibleCount] = useState(5);
  const [debaters, setDebaters] = useState<Debater[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [badgeUnlocked, setBadgeUnlocked] = useState<{
    badgeName: string;
    isOpen: boolean;
  }>({
    badgeName: "",
    isOpen: false,
  });
  const [sortCategory, setSortCategory] = useState<SortCategory>("score");
  const wsRef = useRef<WebSocket | null>(null);
  const previousRankRef = useRef<number | null>(null);
  const isInitialRenderRef = useRef(true);
  const { user } = useUser();
  const [top10Celebration, setTop10Celebration] = useState<{
    rank: number;
    isOpen: boolean;
  }>({
    rank: 0,
    isOpen: false,
  });

  // Load initial leaderboard data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) return;

        // Try to fetch from gamification endpoint first, fallback to old endpoint
        try {
          const data = await fetchGamificationLeaderboard(token);
          setDebaters(data.debaters);
          // Keep stats from old endpoint for now
          const oldData: LeaderboardData = await fetchLeaderboardData(token);
          setStats(oldData.stats);
        } catch {
          // Fallback to old endpoint
          const data: LeaderboardData = await fetchLeaderboardData(token);
          setDebaters(data.debaters);
          setStats(data.stats);
        }
      } catch {
        setError("Failed to load leaderboard data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Set up WebSocket connection for live updates
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !user) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = createGamificationWebSocket(
      token,
      (event: GamificationEvent) => {
        console.log("Gamification event received:", event);

        if (event.type === "badge_awarded" && event.badgeName) {
          // Show badge unlock notification if it's for the current user
          setDebaters((currentDebaters) => {
            const currentUserDebater = currentDebaters.find(
              (d) => d.currentUser
            );
            if (
              event.userId === currentUserDebater?.id ||
              event.userId === user?.id
            ) {
              setBadgeUnlocked({
                badgeName: event.badgeName!,
                isOpen: true,
              });
            }
            return currentDebaters;
          });
        }

        if (event.type === "score_updated") {
          // Update the leaderboard when scores change
          setDebaters((prevDebaters) => {
            const updated = [...prevDebaters];
            const index = updated.findIndex((d) => d.id === event.userId);

            if (index !== -1 && event.newScore !== undefined) {
              updated[index] = {
                ...updated[index],
                score: event.newScore,
              };
            }

            return updated;
          });

          // Reload full leaderboard periodically to ensure accuracy
          const reloadTimer = setTimeout(async () => {
            try {
              const token = localStorage.getItem("token");
              if (token) {
                const data = await fetchGamificationLeaderboard(token);
                setDebaters(data.debaters);
              }
            } catch (err) {
              console.error("Error reloading leaderboard:", err);
            }
          }, 2000);

          return () => clearTimeout(reloadTimer);
        }
      },
      (error) => {
        console.error("WebSocket error:", error);
      },
      () => {
        console.log("WebSocket closed");
      }
    );

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user]);

  // Sort debaters based on selected category
  const sortedDebaters = React.useMemo(() => {
    const sorted = [...debaters];
    if (sortCategory) {
      sorted.sort((a, b) => {
        if (sortCategory === "score") {
          return b.score - a.score; // Descending order
        } else {
          return b.rating - a.rating; // Descending order
        }
      });
    }
    // Update ranks after sorting
    sorted.forEach((debater, index) => {
      debater.rank = index + 1;
    });
    return sorted;
  }, [debaters, sortCategory]);

  const currentUserIndex = sortedDebaters.findIndex(
    (debater) => debater.currentUser
  );

  // Check if user entered top 10 and trigger celebration
  useEffect(() => {
    // Skip celebration on initial page load
    if (isInitialRenderRef.current) {
      if (currentUserIndex !== -1) {
        previousRankRef.current = currentUserIndex + 1;
      }
      isInitialRenderRef.current = false;
      return;
    }

    if (currentUserIndex !== -1 && currentUserIndex < 10) {
      const currentRank = currentUserIndex + 1;
      // Only celebrate if user wasn't in top 10 before or improved their rank
      if (previousRankRef.current !== null && previousRankRef.current > 10) {
        // User just entered top 10!
        setTop10Celebration({ rank: currentRank, isOpen: true });
      } else if (previousRankRef.current !== null && previousRankRef.current > currentRank && currentRank <= 3) {
        // User improved to top 3!
        setTop10Celebration({ rank: currentRank, isOpen: true });
      }
      previousRankRef.current = currentRank;
    } else if (currentUserIndex >= 10) {
      previousRankRef.current = currentUserIndex + 1;
    }
  }, [currentUserIndex, sortedDebaters]);

  const getVisibleDebaters = () => {
    if (!sortedDebaters.length) return [];
    const initialList = sortedDebaters
      .filter((debater, index) => !debater.currentUser || index < visibleCount)
      .slice(0, visibleCount);
    if (currentUserIndex !== -1 && currentUserIndex >= visibleCount) {
      return [...initialList.slice(0, -1), sortedDebaters[currentUserIndex]];
    }
    return initialList;
  };

  const handleSortCategory = (category: SortCategory) => {
    // If clicking the same category, toggle to null (no sort) or keep it
    if (sortCategory === category) {
      setSortCategory(null);
    } else {
      setSortCategory(category);
    }
  };

  const showMore = () =>
    setVisibleCount((prev) => Math.min(prev + 5, sortedDebaters.length));

  const visibleDebaters = getVisibleDebaters();

  if (loading) return <div className="p-4">Loading Leaderboard...</div>;

  if (error) {
    return (
      <div className="p-6 bg-background text-foreground flex justify-center items-center h-screen">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background text-foreground">
      <BadgeUnlocked
        badgeName={badgeUnlocked.badgeName}
        isOpen={badgeUnlocked.isOpen}
        onClose={() => setBadgeUnlocked({ badgeName: "", isOpen: false })}
      />
      <Top10Celebration
        rank={top10Celebration.rank}
        isOpen={top10Celebration.isOpen}
        onClose={() => setTop10Celebration({ rank: 0, isOpen: false })}
      />
      <div className="max-w-7xl mx-auto">
        <p className="text-center text-muted-foreground mb-8 text-lg">
          Hone your skills and see how you stack up against top debaters! 🏆
        </p>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <Card className="border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24 text-muted-foreground pl-6">
                      Rank
                    </TableHead>
                    <TableHead className="text-muted-foreground pl-6">
                      Debater
                    </TableHead>
                    <TableHead
                      className="text-right text-muted-foreground pr-6 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSortCategory("score")}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <FaRobot className="w-4 h-4" />
                        <span>VS BOT</span>
                        {sortCategory === "score" && (
                          <span className="text-xs">↓</span>
                        )}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right text-muted-foreground pr-6 cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSortCategory("rating")}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <FaTrophy className="w-4 h-4" />
                        <span>ELO RATING</span>
                        {sortCategory === "rating" && (
                          <span className="text-xs">↓</span>
                        )}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleDebaters.map((debater) => (
                    <TableRow
                      key={debater.id}
                      className={`group hover:bg-accent/30 ${debater.currentUser ? "bg-primary/10" : ""
                        }`}
                    >
                      <TableCell className="pl-6">
                        <div
                          className={`w-12 h-12 flex items-center justify-center rounded-lg ${getRankClasses(
                            debater.rank
                          )}`}
                        >
                          {debater.rank === 1 && (
                            <FaCrown className="w-5 h-5 text-amber-600" />
                          )}
                          {debater.rank === 2 && (
                            <FaChessQueen className="w-5 h-5 text-slate-600" />
                          )}
                          {debater.rank === 3 && (
                            <FaMedal className="w-5 h-5 text-orange-600" />
                          )}
                          {debater.rank > 3 && (
                            <span className="font-medium">#{debater.rank}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pl-6">
                        <div className="flex items-center space-x-4">
                          <Avatar className="w-10 h-10 border-2 border-muted">
                            <AvatarImage
                              src={debater.avatarUrl}
                              alt={debater.name}
                            />
                            <AvatarFallback className="bg-muted">
                              {debater.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-foreground">
                              {debater.name}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end space-x-2">
                          <span className="font-semibold text-foreground">
                            {debater.score}
                          </span>
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end space-x-2">
                          <span className="font-semibold text-foreground">
                            {debater.rating}
                          </span>
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {visibleCount < sortedDebaters.length && (
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={showMore}
                  className="rounded-lg px-6 py-4 text-base font-semibold"
                >
                  Show More
                </Button>
              </div>
            )}
          </div>

          <div className="w-full lg:w-96">
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {stats.map((stat, index) => (
                  <div
                    key={index}
                    className="p-4 bg-card rounded-lg border hover:border-primary/50 transition-colors"
                  >
                    <div className="text-center">
                      <div className="mb-3 text-2xl text-primary">
                        {mapIcon(stat.icon)}
                      </div>
                      <div className="text-2xl font-bold mb-2 text-foreground">
                        {stat.value}
                      </div>
                      <div className="text-sm text-muted-foreground tracking-wide">
                        {stat.label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
