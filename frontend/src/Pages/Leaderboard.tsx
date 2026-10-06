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
import {
  fetchLeaderboardData,
  type LeaderboardPagination,
} from "@/services/leaderboardService";
import {
  fetchGamificationLeaderboard,
  createGamificationWebSocket,
  GamificationEvent,
} from "@/services/gamificationService";
import BadgeUnlocked from "@/components/BadgeUnlocked";
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
  pagination?: LeaderboardPagination;
  currentUser?: Debater;
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

const fetchFallbackPage = (
  token: string,
  page: number,
  sort: SortCategory,
  includeCurrentUser = false
): Promise<LeaderboardData> =>
  fetchLeaderboardData(token, 100, { page, sort: sort ?? "rating", includeCurrentUser });

const Leaderboard: React.FC = () => {
  const [visibleCount, setVisibleCount] = useState(5);
  const [debaters, setDebaters] = useState<Debater[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<LeaderboardPagination | null>(null);
  const [pinnedUser, setPinnedUser] = useState<Debater | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const pageRequest = useRef(0);
  const pageBusy = useRef(false);
  const fallbackMode = useRef(false);
  const fallbackSort = useRef<SortCategory>("score");
  const [badgeUnlocked, setBadgeUnlocked] = useState<{
    badgeName: string;
    isOpen: boolean;
  }>({
    badgeName: "",
    isOpen: false,
  });
  const [sortCategory, setSortCategory] = useState<SortCategory>("score");
  const wsRef = useRef<WebSocket | null>(null);
  const { user } = useUser();

  // Load initial leaderboard data
  useEffect(() => {
    const request = ++pageRequest.current;
    const loadData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) return;

        // Try to fetch from gamification endpoint first, fallback to old endpoint
        try {
          const data = await fetchGamificationLeaderboard(token);
          if (request !== pageRequest.current) return;
          setDebaters(data.debaters);
          // Keep stats from old endpoint for now
          const oldData: LeaderboardData = await fetchLeaderboardData(token, 1);
          if (request !== pageRequest.current) return;
          setStats(oldData.stats);
        } catch {
          // Fallback to old endpoint
          const data = await fetchFallbackPage(token, 1, "score", true);
          if (request !== pageRequest.current) return;
          setDebaters(data.debaters);
          setStats(data.stats);
          setPagination(data.pagination ?? null);
          setPinnedUser(data.currentUser ?? null);
          fallbackMode.current = Boolean(data.pagination);
        }
      } catch {
        if (request === pageRequest.current) setError("Failed to load leaderboard data. Please try again later.");
      } finally {
        if (request === pageRequest.current) setLoading(false);
      }
    };

    loadData();
    return () => { pageRequest.current++; };
  }, []);

  // Set up WebSocket connection for live updates
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !user) return;
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;

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
          if (!fallbackMode.current) setDebaters((prevDebaters) => {
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
          clearTimeout(reloadTimer);
          const reloadLeaderboard = async () => {
            let refreshRequest: number | undefined;
            try {
              const token = localStorage.getItem("token");
              if (token) {
                const request = pageRequest.current;
                if (fallbackMode.current) {
                  // Let an explicit page or sort operation finish before refreshing.
                  if (pageBusy.current) {
                    reloadTimer = setTimeout(reloadLeaderboard, 2000);
                    return;
                  }
                  refreshRequest = ++pageRequest.current;
                  pageBusy.current = true;
                  setLoadingMore(true);
                  setPageError(null);
                  const data = await fetchFallbackPage(token, 1, fallbackSort.current, true);
                  if (refreshRequest !== pageRequest.current) return;
                  setDebaters(data.debaters);
                  setPinnedUser(data.currentUser ?? null);
                  setPagination(data.pagination ?? null);
                  setStats(data.stats);
                  setVisibleCount(5);
                  return;
                }
                const data = await fetchGamificationLeaderboard(token);
                if (request !== pageRequest.current) return;
                setDebaters(data.debaters);
              }
            } catch (err) {
              console.error("Error reloading leaderboard:", err);
            } finally {
              if (refreshRequest === pageRequest.current) {
                pageBusy.current = false;
                setLoadingMore(false);
              }
            }
          };
          reloadTimer = setTimeout(reloadLeaderboard, 2000);
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
      clearTimeout(reloadTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user]);

  // Sort debaters based on selected category
  const sortedDebaters = React.useMemo(() => {
    // Paginated fallback rows already have the selected global order and ranks.
    if (pagination) return debaters;
    const sorted = debaters.map((debater) => ({ ...debater }));
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
  }, [debaters, sortCategory, pagination]);

  const currentUserIndex = sortedDebaters.findIndex(
    (debater) => debater.currentUser
  );

  const getVisibleDebaters = () => {
    if (!sortedDebaters.length) return [];
    const initialList = sortedDebaters
      .filter((debater, index) => !debater.currentUser || index < visibleCount)
      .slice(0, visibleCount);
    const current = pinnedUser ?? sortedDebaters[currentUserIndex];
    if (current && !initialList.some((debater) => debater.id === current.id)) {
      return [...initialList.slice(0, -1), current];
    }
    return initialList;
  };

  const handleSortCategory = async (category: SortCategory) => {
    const nextSort = sortCategory === category ? null : category;
    if (!pagination) {
      setSortCategory(nextSort);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;
    const request = ++pageRequest.current;
    pageBusy.current = true;
    setLoadingMore(true);
    setPageError(null);
    try {
      const data = await fetchFallbackPage(token, 1, nextSort, true);
      if (request !== pageRequest.current) return;
      setSortCategory(nextSort);
      fallbackSort.current = nextSort;
      setDebaters(data.debaters);
      setPinnedUser(data.currentUser ?? null);
      setPagination(data.pagination ?? null);
      setStats(data.stats);
      setVisibleCount(5);
    } catch {
      if (request === pageRequest.current) {
        setPageError("Could not change the leaderboard order. Try again.");
      }
    } finally {
      if (request === pageRequest.current) {
        pageBusy.current = false;
        setLoadingMore(false);
      }
    }
  };

  const showMore = async () => {
    if (pageBusy.current) return;
    const nextCount = visibleCount + 5;
    if (
      nextCount <= debaters.length ||
      !pagination ||
      pagination.page >= pagination.totalPages
    ) {
      setVisibleCount(Math.min(nextCount, debaters.length));
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) return;
    const request = ++pageRequest.current;
    pageBusy.current = true;
    setLoadingMore(true);
    setPageError(null);
    try {
      const data = await fetchFallbackPage(token, pagination.page + 1, sortCategory);
      if (request !== pageRequest.current) return;
      const seen = new Set(debaters.map((debater) => debater.id));
      const additions = data.debaters.filter((debater) => !seen.has(debater.id));
      setDebaters([...debaters, ...additions]);
      setPagination(data.pagination ?? null);
      setVisibleCount(Math.min(nextCount, debaters.length + additions.length));
    } catch {
      if (request === pageRequest.current) {
        setPageError("Could not load more debaters. Try again.");
      }
    } finally {
      if (request === pageRequest.current) {
        pageBusy.current = false;
        setLoadingMore(false);
      }
    }
  };

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
                      className={`group hover:bg-accent/30 ${
                        debater.currentUser ? "bg-primary/10" : ""
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

            {pageError && (
              <p role="alert" className="mt-4 text-red-500">{pageError}</p>
            )}
            {(visibleCount < sortedDebaters.length ||
              (pagination && pagination.page < pagination.totalPages)) && (
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={showMore}
                  disabled={loadingMore}
                  className="rounded-lg px-6 py-4 text-base font-semibold"
                >
                  {loadingMore ? "Loading..." : "Show More"}
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
