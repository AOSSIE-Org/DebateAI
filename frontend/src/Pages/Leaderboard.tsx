"use client";

import React, { useState, useEffect } from "react";
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
import { FaCrown, FaMedal, FaChessQueen } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { fetchLeaderboardData } from "@/services/leaderboardService";

interface Debater {
  id: string;
  currentUser: boolean;
  rank: number;
  avatarUrl: string;
  name: string;
  score: number;
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

const Leaderboard: React.FC = () => {
  const [visibleCount, setVisibleCount] = useState(5);
  const [debaters, setDebaters] = useState<Debater[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) return;
        const data: LeaderboardData = await fetchLeaderboardData(token);
        setDebaters(data.debaters);
        setStats(data.stats);
      } catch {
        setError("Failed to load leaderboard data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const currentUserIndex = debaters.findIndex((debater) => debater.currentUser);

  const getVisibleDebaters = () => {
    if (!debaters.length) return [];
    const initialList = debaters
      .filter((debater, index) => !debater.currentUser || index < visibleCount)
      .slice(0, visibleCount);
    if (currentUserIndex !== -1 && currentUserIndex >= visibleCount) {
      return [...initialList.slice(0, -1), debaters[currentUserIndex]];
    }
    return initialList;
  };

  const showMore = () =>
    setVisibleCount((prev) => Math.min(prev + 5, debaters.length));

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
                    <TableHead className="text-right text-muted-foreground pr-6">
                      Score
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {visibleCount < debaters.length && (
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
              <p className="mt-2 text-center text-xs text-muted-foreground">
                (Data fetched from backend)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
