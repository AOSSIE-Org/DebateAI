// Profile.tsx (partial, focusing on avatar-related code)
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  CheckCircle,
  XCircle,
  MinusCircle,
  Medal,
  Twitter,
  Users,
  TrendingUp,
  Award,
  Instagram,
  Linkedin,
  Pen,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { format, isSameDay, subDays } from "date-fns";
import defaultAvatar from "@/assets/avatar2.jpg";
import {
  PieChart,
  Pie,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getProfile, updateProfile } from "@/services/profileService";
import { getAuthToken } from "@/utils/auth";
import { DateRange } from "react-day-picker";
import AvatarModal from "../components/AvatarModal";

interface ProfileData {
  displayName: string;
  email: string;
  bio: string;
  eloRating: number;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  avatarUrl?: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  avatarUrl: string;
  currentUser?: boolean;
}

interface DebateResult {
  topic: string;
  result: "win" | "loss" | "draw";
  eloChange: number;
}

interface StatData {
  wins: number;
  losses: number;
  draws: number;
  eloHistory: { elo: number; date: string }[];
  debateHistory: DebateResult[] | null;
}

interface DashboardData {
  profile: ProfileData;
  leaderboard: LeaderboardEntry[];
  stats: StatData;
}

const Profile: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [eloFilter, setEloFilter] = useState<
    "7days" | "30days" | "all" | "custom"
  >("all");
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const [customDateRange, setCustomDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      const token = getAuthToken();
      if (!token) {
        setErrorMessage("Please log in to view your profile.");
        setLoading(false);
        return;
      }

      try {
        const data = await getProfile(token);
        setDashboard(data);
      } catch (err) {
        setErrorMessage("Failed to load dashboard data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  useEffect(() => {
    if (editingField === "displayName" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingField]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSubmit = async (e: React.FormEvent, field: string) => {
    e.preventDefault();
    if (!dashboard?.profile) return;
    const token = getAuthToken();
    if (!token) {
      setErrorMessage("Authentication token is missing.");
      return;
    }
    try {
      await updateProfile(
        token,
        dashboard.profile.displayName,
        dashboard.profile.bio,
        dashboard.profile.twitter,
        dashboard.profile.instagram,
        dashboard.profile.linkedin,
        dashboard.profile.avatarUrl
      );
      setSuccessMessage(
        `${
          field.charAt(0).toUpperCase() + field.slice(1)
        } updated successfully!`
      );
      setErrorMessage("");
      setEditingField(null);
    } catch (err) {
      setErrorMessage(`Failed to update ${field}.`);
      console.error(err);
    }
  };

  const handleAvatarSelect = async (avatarUrl: string) => {
    if (!dashboard?.profile) return;
    const token = getAuthToken();
    if (!token) {
      setErrorMessage("Authentication token is missing.");
      return;
    }
    try {
      // Optimistically update the local state
      setDashboard({
        ...dashboard,
        profile: { ...dashboard.profile, avatarUrl },
      });
      await updateProfile(
        token,
        dashboard.profile.displayName,
        dashboard.profile.bio,
        dashboard.profile.twitter,
        dashboard.profile.instagram,
        dashboard.profile.linkedin,
        avatarUrl
      );
      setSuccessMessage("Avatar updated successfully!");
      setErrorMessage("");
    } catch (err) {
      setErrorMessage("Failed to update avatar.");
      console.error(err);
      // Optionally revert state on failure
      setDashboard({
        ...dashboard,
        profile: {
          ...dashboard.profile,
          avatarUrl: dashboard.profile.avatarUrl,
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="animate-pulse rounded-full bg-muted h-10 w-10 mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Loading Profile...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-4 text-red-500 text-center text-sm">{errorMessage}</div>
    );
  }

  const renderEditableSocialField = (
    field: keyof ProfileData,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    placeholder: string = `Enter your ${label.toLowerCase()}`
  ) => {
    return editingField === field ? (
      <form
        onSubmit={(e) => handleSubmit(e, field as string)}
        className="space-y-2 mb-2 w-full"
      >
        <div className="flex items-center gap-2 w-full">
          <Icon className="w-4 h-4 text-primary flex-shrink-0" />
          <Input
            id={field}
            type="text"
            value={dashboard?.profile[field] || ""}
            onChange={(e) =>
              setDashboard({
                ...dashboard!,
                profile: { ...dashboard!.profile, [field]: e.target.value },
              })
            }
            placeholder={placeholder}
            className="text-sm w-full"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant="default" className="flex-1">
            Save
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditingField(null)}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    ) : (
      <div className="flex items-center justify-between mb-2 w-full">
        {dashboard?.profile[field] ? (
          <a
            href={
              field === "twitter"
                ? `https://twitter.com/${dashboard.profile[field]}`
                : field === "instagram"
                ? `https://instagram.com/${dashboard.profile[field]}`
                : `https://linkedin.com/in/${dashboard.profile[field]}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-2 truncate"
          >
            <Icon className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="truncate">
              {field === "twitter" || field === "instagram"
                ? `@${dashboard.profile[field]}`
                : dashboard.profile[field]}
            </span>
          </a>
        ) : (
          <span className="text-sm text-muted-foreground flex items-center gap-2 truncate">
            <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            Add {label.toLowerCase()}
          </span>
        )}
        <button
          onClick={() => setEditingField(field as string)}
          className="p-1 hover:bg-muted rounded-full transition-colors flex-shrink-0"
          title={`Edit ${label}`}
        >
          <Pen className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>
    );
  };

  const renderBioField = () => {
    return editingField === "bio" ? (
      <form
        onSubmit={(e) => handleSubmit(e, "bio")}
        className="space-y-2 mb-2 w-full"
      >
        <Label htmlFor="bio" className="text-sm">
          Bio
        </Label>
        <Textarea
          id="bio"
          value={dashboard?.profile.bio || ""}
          onChange={(e) =>
            setDashboard({
              ...dashboard!,
              profile: { ...dashboard!.profile, bio: e.target.value },
            })
          }
          placeholder="Share your story"
          className="text-sm w-full resize-none h-20"
        />
        <div className="flex gap- personally2">
          <Button type="submit" size="sm" variant="default" className="flex-1">
            Save
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditingField(null)}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    ) : (
      <div className="flex items-start justify-between mb-2 w-full">
        <span className="text-sm text-foreground whitespace-pre-wrap overflow-hidden">
          {dashboard?.profile.bio || "Add your bio"}
        </span>
        <button
          onClick={() => setEditingField("bio")}
          className="p-1 hover:bg-muted rounded-full transition-colors flex-shrink-0"
          title="Edit Bio"
        >
          <Pen className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <div className="animate-pulse rounded-full bg-muted h-10 w-10 mx-auto mb-4"></div>
          <p className="text-muted-foreground text-sm">Loading Profile...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="p-4 text-red-500 text-center text-sm">{errorMessage}</div>
    );
  }

  const { profile, leaderboard, stats } = dashboard;

  const donutChartData = [
    { label: "Losses", value: stats.losses, fill: "hsl(var(--chart-1))" },
    { label: "Wins", value: stats.wins, fill: "hsl(var(--chart-2))" },
    { label: "Draws", value: stats.draws, fill: "hsl(var(--chart-3))" },
  ];
  const totalMatches = donutChartData.reduce(
    (acc, curr) => acc + curr.value,
    0
  );

  const donutChartConfig: ChartConfig = {
    value: { label: "Matches" },
    wins: { label: "Wins", color: "hsl(var(--chart-2))" },
    losses: { label: "Losses", color: "hsl(var(--chart-1))" },
    draws: { label: "Draws", color: "hsl(var(--chart-3))" },
  };

  const eloChartConfig: ChartConfig = {
    elo: { label: "Elo", color: "hsl(var(--primary))" },
  };

  const filterEloHistory = () => {
    if (!stats.eloHistory) return [];
    let filteredHistory = [...stats.eloHistory];

    const now = new Date();
    if (eloFilter === "7days") {
      const sevenDaysAgo = subDays(now, 7);
      filteredHistory = filteredHistory.filter((entry) => {
        const entryDate = entry.date ? new Date(entry.date) : new Date();
        return entryDate >= sevenDaysAgo;
      });
    } else if (eloFilter === "30days") {
      const thirtyDaysAgo = subDays(now, 30);
      filteredHistory = filteredHistory.filter((entry) => {
        const entryDate = entry.date ? new Date(entry.date) : new Date();
        return entryDate >= thirtyDaysAgo;
      });
    } else if (
      eloFilter === "custom" &&
      customDateRange.from &&
      customDateRange.to
    ) {
      filteredHistory = filteredHistory.filter((entry) => {
        const entryDate = entry.date ? new Date(entry.date) : new Date();
        return (
          entryDate >= customDateRange.from! && entryDate <= customDateRange.to!
        );
      });
    }

    if (filteredHistory.length === 0 && eloFilter !== "custom") {
      filteredHistory = [
        { elo: profile.eloRating, date: new Date().toISOString() },
      ];
    }

    return filteredHistory.map((entry) => ({
      ...entry,
      formattedDate: entry.date
        ? format(new Date(entry.date), "MMM dd")
        : format(new Date(), "MMM dd"),
    }));
  };

  const filteredEloHistory = filterEloHistory();

  const eloValues = filteredEloHistory.map((entry) => entry.elo);
  const minElo =
    eloValues.length > 0
      ? Math.min(...eloValues, profile.eloRating)
      : profile.eloRating;
  const maxElo =
    eloValues.length > 0
      ? Math.max(...eloValues, profile.eloRating)
      : profile.eloRating;
  const padding = Math.round((maxElo - minElo) * 0.1) || 50;
  const yDomain = [minElo - padding, maxElo + padding];

  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }

  const CustomTooltip: React.FC<CustomTooltipProps> = ({
    active,
    payload,
    label,
  }) => {
    if (active && payload && payload.length) {
      const currentElo = payload[0].value;
      const index = filteredEloHistory.findIndex(
        (entry) => entry.formattedDate === label
      );
      let changeText = "No change";
      if (index > 0) {
        const previousElo = filteredEloHistory[index - 1].elo;
        const change = currentElo - previousElo;
        if (change > 0) {
          changeText = `Increased by ${change}`;
        } else if (change < 0) {
          changeText = `Decreased by ${-change}`;
        }
      }
      return (
        <div className="bg-background border border-border p-2 rounded shadow text-xs">
          <p className="font-semibold">{label}</p>
          <p>Elo: {currentElo}</p>
          <p>{changeText}</p>
        </div>
      );
    }
    return null;
  };

  const clearCustomDateRange = () => {
    setCustomDateRange({ from: undefined, to: undefined });
    if (eloFilter === "custom") {
      setEloFilter("all");
    }
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-4 p-2 sm:p-4 bg-background min-h-[calc(100vh-4rem)]">
      <div className="w-full md:w-1/4 lg:w-1/5 bg-card p-4 border border-border rounded-md shadow max-h-[calc(100vh-4rem)] overflow-y-auto">
        {successMessage && (
          <div className="mb-2 p-2 rounded bg-green-100 text-green-700 text-xs animate-in fade-in duration-300">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mb-2 p-2 rounded bg-red-100 text-red-700 text-xs animate-in fade-in duration-300">
            {errorMessage}
          </div>
        )}
        <div className="flex flex-col items-center mb-4">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden bg-muted flex-shrink-0 mb-2 border-2 border-primary shadow-md group">
            <img
              src={profile.avatarUrl || defaultAvatar}
              alt="Avatar"
              className="object-cover w-full h-full"
            />
            <button
              onClick={() => setIsAvatarModalOpen(true)}
              className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit Avatar"
            >
              <ImageIcon className="w-6 h-6 text-white" />
            </button>
          </div>
          <AvatarModal
            isOpen={isAvatarModalOpen}
            onClose={() => setIsAvatarModalOpen(false)}
            onSelectAvatar={handleAvatarSelect}
            currentAvatar={profile.avatarUrl}
          />
          {editingField === "displayName" ? (
            <form
              onSubmit={(e) => handleSubmit(e, "displayName")}
              className="flex flex-col items-center space-y-2 w-full"
            >
              <Input
                id="displayName"
                type="text"
                value={profile.displayName || ""}
                onChange={(e) =>
                  setDashboard({
                    ...dashboard,
                    profile: { ...profile, displayName: e.target.value },
                  })
                }
                ref={inputRef}
                className="text-lg sm:text-xl font-bold h-9 w-full max-w-xs"
                placeholder="Enter name"
              />
              <div className="flex gap-2 w-full max-w-xs">
                <Button
                  type="submit"
                  size="sm"
                  variant="default"
                  className="flex-1 text-xs"
                >
                  Save
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditingField(null)}
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center space-x-2">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">
                {profile.displayName || "Steve"}
              </h2>
              <button
                onClick={() => setEditingField("displayName")}
                className="p-1 hover:bg-muted rounded-full"
                title="Edit Display Name"
              >
                <Pen
                  className={`w-4 h-4 ${
                    profile.displayName
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            </div>
          )}
          <p className="text-sm bg-primary text-primary-foreground px-2 py-1 rounded mt-2">
            Elo: {profile.eloRating}
          </p>
        </div>
        <Separator className="my-2" />
        <p className="text-xs sm:text-sm text-muted-foreground mb-2 truncate">
          Email: {profile.email}
        </p>
        <div className="space-y-2 mb-4">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground">
            Socials
          </h3>
          {renderEditableSocialField(
            "twitter",
            "X / Twitter",
            Twitter,
            "Your Twitter handle (without @)"
          )}
          {renderEditableSocialField(
            "instagram",
            "Instagram",
            Instagram,
            "Your Instagram handle (without @)"
          )}
          {renderEditableSocialField(
            "linkedin",
            "LinkedIn",
            Linkedin,
            "Your LinkedIn profile (username or ID)"
          )}
        </div>
        <Separator className="my-2" />
        <div className="space-y-2">
          <h3 className="text-xs sm:text-sm font-semibold text-foreground">
            Bio
          </h3>
          {renderBioField()}
        </div>
      </div>

      <div className="flex-1 flex flex-col space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="shadow h-[250px] sm:h-[300px] flex flex-col">
            <CardContent className="flex-1 p-4">
              {totalMatches === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Award className="w-10 h-10 text-muted-foreground mb-2 animate-pulse" />
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                    No matches yet!
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => (window.location.href = "/debates")}
                    className="hover:bg-primary hover:text-primary-foreground text-xs"
                  >
                    Start Debating
                  </Button>
                </div>
              ) : (
                <ChartContainer
                  config={donutChartConfig}
                  className="mx-auto w-full h-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Pie
                        data={donutChartData}
                        dataKey="value"
                        nameKey="label"
                        innerRadius="40%"
                        strokeWidth={3}
                      >
                        <LabelList
                          content={({ viewBox }) => {
                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                              return (
                                <text
                                  x={viewBox.cx}
                                  y={viewBox.cy}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                >
                                  <tspan
                                    x={viewBox.cx}
                                    y={viewBox.cy}
                                    className="fill-foreground text-sm sm:text-base font-bold"
                                  >
                                    {totalMatches}
                                  </tspan>
                                  <tspan
                                    x={viewBox.cx}
                                    y={(viewBox.cy || 0) + 16}
                                    className="fill-muted-foreground text-xs"
                                  >
                                    Matches
                                  </tspan>
                                </text>
                              );
                            }
                          }}
                        />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow h-[250px] sm:h-[300px] flex flex-col">
            <CardHeader className="p-3 pb-1 flex-shrink-0">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <CardTitle className="text-foreground text-base sm:text-lg">
                  Ratings
                </CardTitle>
                <div className="flex flex-wrap gap-2 items-center">
                  <Select
                    value={eloFilter}
                    onValueChange={(
                      value: "7days" | "30days" | "all" | "custom"
                    ) => setEloFilter(value)}
                  >
                    <SelectTrigger className="min-w-[100px] sm:min-w-[120px] text-xs">
                      <SelectValue placeholder="Select filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7days">Last 7 Days</SelectItem>
                      <SelectItem value="30days">Last 30 Days</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                  {eloFilter === "custom" && (
                    <div className="flex gap-2 items-center">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-[160px] sm:w-[180px] justify-start text-left font-normal truncate text-xs"
                          >
                            <CalendarIcon className="mr-2 h-3 w-3 flex-shrink-0" />
                            <span className="truncate">
                              {customDateRange.from
                                ? customDateRange.to &&
                                  !isSameDay(
                                    customDateRange.from,
                                    customDateRange.to
                                  )
                                  ? `${format(
                                      customDateRange.from,
                                      "MMM d"
                                    )} - ${format(customDateRange.to, "MMM d")}`
                                  : format(customDateRange.from, "MMM d")
                                : "Pick a date range"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="range"
                            selected={customDateRange}
                            onSelect={(range) =>
                              setCustomDateRange(
                                range ?? { from: undefined, to: undefined }
                              )
                            }
                            initialFocus
                            required={false}
                          />
                        </PopoverContent>
                      </Popover>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={clearCustomDateRange}
                        className="h-8 w-8"
                        title="Clear date range"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-2 flex-1">
              {filteredEloHistory.length > 0 &&
              !(
                eloFilter === "custom" &&
                filteredEloHistory.length === 1 &&
                filteredEloHistory[0].elo === profile.eloRating
              ) ? (
                <ChartContainer
                  config={eloChartConfig}
                  className="w-full h-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={filteredEloHistory}
                      margin={{ top: 10, right: 10, left: 0, bottom: 30 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <XAxis
                        dataKey="formattedDate"
                        tick={{ fontSize: 8, fill: "hsl(var(--foreground))" }}
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--muted-foreground))" }}
                        angle={filteredEloHistory.length > 5 ? -45 : 0}
                        textAnchor="end"
                        height={40}
                        interval={Math.floor(filteredEloHistory.length / 5)}
                      />
                      <YAxis
                        domain={yDomain}
                        tick={{ fontSize: 8, fill: "hsl(var(--foreground))" }}
                        tickLine={false}
                        axisLine={{ stroke: "hsl(var(--muted-foreground))" }}
                        width={30}
                      />
                      <ChartTooltip content={<CustomTooltip />} />
                      <Line
                        dataKey="elo"
                        type="monotone"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))", r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <TrendingUp className="w-10 h-10 text-muted-foreground mb-2 animate-pulse" />
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                    {eloFilter === "custom"
                      ? "No debates in this date range!"
                      : "No Elo history for selected period!"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => (window.location.href = "/debates")}
                    className="hover:bg-primary hover:text-primary-foreground text-xs"
                  >
                    Join a Debate
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="shadow h-[250px] sm:h-[300px] flex flex-col">
            <CardHeader className="p-2 flex-shrink-0">
              <CardTitle className="text-foreground text-base sm:text-lg">
                Top 5 Debaters
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                See who’s leading
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="p-2 flex-1 overflow-y-auto">
              {leaderboard && leaderboard.length > 0 ? (
                <ul className="space-y-1">
                  {leaderboard.slice(0, 5).map((leader, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between border-b border-muted py-1 last:border-none text-xs sm:text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-medium flex items-center space-x-2 truncate">
                        <span>{leader.rank}</span>
                        {leader.rank === 1 && (
                          <Medal className="w-3 h-3 text-yellow-500" />
                        )}
                        {leader.rank === 2 && (
                          <Medal className="w-3 h-3 text-gray-400" />
                        )}
                        {leader.rank === 3 && (
                          <Medal className="w-3 h-3 text-amber-600" />
                        )}
                        <img
                          src={leader.avatarUrl}
                          alt={leader.name}
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded-full"
                        />
                        <span className="truncate">{leader.name}</span>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {leader.score}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Users className="w-10 h-10 text-muted-foreground mb-2 animate-pulse" />
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                    Leaderboard is empty!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Check back later to see top debaters.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow h-[250px] sm:h-[300px] flex flex-col">
            <CardHeader className="p-2 flex-shrink-0">
              <CardTitle className="text-foreground text-base sm:text-lg">
                Recent Debates
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Win/Loss record & Elo changes
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="p-2 flex-1 overflow-y-auto">
              {stats.debateHistory && stats.debateHistory.length > 0 ? (
                <ul className="space-y-1">
                  {[...stats.debateHistory].reverse().map((debate, idx) => {
                    const IconComponent =
                      debate.result === "win"
                        ? CheckCircle
                        : debate.result === "loss"
                        ? XCircle
                        : MinusCircle;
                    const iconColor =
                      debate.result === "win"
                        ? "text-green-600"
                        : debate.result === "loss"
                        ? "text-red-600"
                        : "text-gray-600";
                    return (
                      <li
                        key={idx}
                        className="flex items-center justify-between border-b border-muted py-1 last:border-none text-xs sm:text-sm hover:bg-muted/50 transition-colors"
                      >
                        <span className="font-medium flex items-center truncate">
                          <IconComponent
                            className={`w-3 h-3 mr-1 ${iconColor}`}
                          />
                          <span className="truncate">{debate.topic}</span>
                        </span>
                        <span className={`${iconColor} font-semibold text-xs`}>
                          {debate.result.toUpperCase()}{" "}
                          {debate.eloChange > 0 && `(+${debate.eloChange})`}
                          {debate.eloChange < 0 && `(${debate.eloChange})`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Award className="w-10 h-10 text-muted-foreground mb-2 animate-pulse" />
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                    No recent debates available.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => (window.location.href = "/debates")}
                    className="hover:bg-primary hover:text-primary-foreground text-xs"
                  >
                    Join a Debate
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
