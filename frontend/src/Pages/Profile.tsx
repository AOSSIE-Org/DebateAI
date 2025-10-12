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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ChevronRight,
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
import SavedTranscripts from "../components/SavedTranscripts";
import {
  transcriptService,
  SavedDebateTranscript,
} from "@/services/transcriptService";

interface ProfileData {
  displayName: string;
  email: string;
  bio: string;
  rating: number;
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
  winRate?: number;
  totalDebates?: number;
  eloHistory: { elo: number; date: string }[];
  debateHistory: DebateResult[] | null;
  recentDebates?: Array<{
    id: string;
    topic: string;
    result: "win" | "loss" | "draw" | "pending";
    opponent: string;
    debateType: "user_vs_bot" | "user_vs_user";
    date: string;
    eloChange?: number;
  }>;
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
  const [debateStatsLoading, setDebateStatsLoading] = useState(true);
  const [recentDebates, setRecentDebates] = useState<
    Array<{
      id: string;
      topic: string;
      result: "win" | "loss" | "draw" | "pending";
      opponent: string;
      debateType: "user_vs_bot" | "user_vs_user";
      date: string;
      eloChange?: number;
    }>
  >([]);
  const [selectedDebate, setSelectedDebate] = useState<{
    id: string;
    topic: string;
    result: "win" | "loss" | "draw" | "pending";
    opponent: string;
    debateType: "user_vs_bot" | "user_vs_user";
    date: string;
    eloChange?: number;
  } | null>(null);
  const [isDebateDialogOpen, setIsDebateDialogOpen] = useState(false);
  const [fullTranscript, setFullTranscript] =
    useState<SavedDebateTranscript | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

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
        const response = await getProfile(token);
        if (response.success && response.data) {
          setDashboard(response.data);

          // Extract recent debates from profile data
          if (response.data.stats && response.data.stats.recentDebates) {
            setRecentDebates(response.data.stats.recentDebates);
          }
          setDebateStatsLoading(false);
        } else {
          setErrorMessage(response.error?.message || "Failed to load dashboard data.");
        }
      } catch (err) {
        setErrorMessage("Failed to load dashboard data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const handleDebateClick = async (debate: {
    id: string;
    topic: string;
    result: "win" | "loss" | "draw" | "pending";
    opponent: string;
    debateType: "user_vs_bot" | "user_vs_user";
    date: string;
    eloChange?: number;
  }) => {
    if (!debate.id) {
      setErrorMessage("Transcript not available for this debate.");
      return;
    }
    setSelectedDebate(debate);
    setIsDebateDialogOpen(true);
    setTranscriptLoading(true);

    try {
      // Fetch the transcript directly by ID
      const transcript = await transcriptService.getTranscriptById(debate.id);
      setFullTranscript(transcript);
    } catch (err) {
      console.error("Failed to fetch full transcript:", err);
    } finally {
      setTranscriptLoading(false);
    }
  };

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
      const response = await updateProfile(
        token,
        dashboard.profile.displayName,
        dashboard.profile.bio,
        dashboard.profile.twitter,
        dashboard.profile.instagram,
        dashboard.profile.linkedin,
        dashboard.profile.avatarUrl
      );

      if (response.success) {
        setSuccessMessage(
          `${
            field.charAt(0).toUpperCase() + field.slice(1)
          } updated successfully!`
        );
        setErrorMessage("");
        setEditingField(null);
      } else {
        setErrorMessage(response.error?.message || `Failed to update ${field}.`);
      }
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

      const response = await updateProfile(
        token,
        dashboard.profile.displayName,
        dashboard.profile.bio,
        dashboard.profile.twitter,
        dashboard.profile.instagram,
        dashboard.profile.linkedin,
        avatarUrl
      );

      if (response.success) {
        setSuccessMessage("Avatar updated successfully!");
        setErrorMessage("");
      } else {
        setErrorMessage(response.error?.message || "Failed to update avatar.");
        // Revert state on failure
        setDashboard({
          ...dashboard,
          profile: {
            ...dashboard.profile,
            avatarUrl: dashboard.profile.avatarUrl,
          },
        });
      }
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
    {
      label: "Losses",
      value: stats.losses,
      fill: "hsl(var(--chart-1))",
    },
    {
      label: "Wins",
      value: stats.wins,
      fill: "hsl(var(--chart-2))",
    },
    {
      label: "Draws",
      value: stats.draws,
      fill: "hsl(var(--chart-3))",
    },
  ];
  const totalMatches = donutChartData.reduce(
    (acc, curr) => acc + curr.value,
    0
  );

  // Use real win rate from dashboard stats if available

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
        { elo: profile.rating, date: new Date().toISOString() },
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
      ? Math.min(...eloValues, profile.rating)
      : profile.rating;
  const maxElo =
    eloValues.length > 0
      ? Math.max(...eloValues, profile.rating)
      : profile.rating;
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
            Elo: {profile.rating}
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
                filteredEloHistory[0].elo === profile.rating
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
              {debateStatsLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Loading debate history...
                  </p>
                </div>
              ) : recentDebates && recentDebates.length > 0 ? (
                <ul className="space-y-1">
                  {recentDebates.map((debate, idx) => {
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
                        className="flex items-center justify-between border-b border-muted py-1 last:border-none text-xs sm:text-sm hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => handleDebateClick(debate)}
                      >
                        <span className="font-medium flex items-center truncate">
                          <IconComponent
                            className={`w-3 h-3 mr-1 ${iconColor}`}
                          />
                          <span className="truncate">{debate.topic}</span>
                        </span>
                        <span
                          className={`${iconColor} font-semibold text-xs flex items-center gap-1`}
                        >
                          {debate.result.toUpperCase()}{" "}
                          {debate.eloChange &&
                            debate.eloChange > 0 &&
                            `(+${debate.eloChange})`}
                          {debate.eloChange &&
                            debate.eloChange < 0 &&
                            `(${debate.eloChange})`}
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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

        {/* Saved Debate Transcripts Section */}
        <div data-section="saved-transcripts">
          <SavedTranscripts />
        </div>
      </div>

      {/* Debate Details Dialog */}
      <Dialog open={isDebateDialogOpen} onOpenChange={setIsDebateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Debate Details
            </DialogTitle>
          </DialogHeader>
          {selectedDebate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Topic:</span>
                  <p className="text-muted-foreground">
                    {selectedDebate.topic}
                  </p>
                </div>
                <div>
                  <span className="font-semibold">Opponent:</span>
                  <p className="text-muted-foreground">
                    {selectedDebate.opponent}
                    {selectedDebate.debateType === "user_vs_bot" && (
                      <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1 rounded">
                        Bot
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="font-semibold">Type:</span>
                  <p className="text-muted-foreground capitalize">
                    {selectedDebate.debateType.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <span className="font-semibold">Result:</span>
                  <div className="flex items-center gap-1">
                    {selectedDebate.result === "win" ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : selectedDebate.result === "loss" ? (
                      <XCircle className="w-4 h-4 text-red-600" />
                    ) : (
                      <MinusCircle className="w-4 h-4 text-gray-600" />
                    )}
                    <span className="text-muted-foreground capitalize">
                      {selectedDebate.result}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="font-semibold">Date:</span>
                  <p className="text-muted-foreground">
                    {format(new Date(selectedDebate.date), "PPP")}
                  </p>
                </div>
                <div>
                  <span className="font-semibold">Elo Change:</span>
                  <p className="text-muted-foreground">
                    {selectedDebate.eloChange || 0}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Debate Summary</h4>
                <p className="text-sm text-muted-foreground">
                  This debate was a{" "}
                  {selectedDebate.debateType.replace("_", " ")} debate about "
                  {selectedDebate.topic}" against {selectedDebate.opponent}. The
                  result was a {selectedDebate.result}.
                  {selectedDebate.eloChange &&
                    selectedDebate.eloChange !== 0 && (
                      <span>
                        {" "}
                        Your Elo rating changed by{" "}
                        {selectedDebate.eloChange > 0 ? "+" : ""}
                        {selectedDebate.eloChange}.
                      </span>
                    )}
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Your Performance</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {dashboard?.stats?.totalDebates || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total Debates
                    </div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {dashboard?.stats?.winRate?.toFixed(1) || 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Win Rate
                    </div>
                  </div>
                </div>
              </div>

              {transcriptLoading ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">
                    Loading transcript...
                  </p>
                </div>
              ) : fullTranscript ? (
                <div className="space-y-4">
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">Full Conversation</h4>
                    <div className="max-h-64 overflow-y-auto border rounded-lg p-3 space-y-3">
                      {fullTranscript.messages.map((message, index: number) => (
                        <div
                          key={index}
                          className={`flex gap-3 ${
                            message.sender === "User"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              message.sender === "User"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium">
                                {message.sender}
                              </span>
                              {message.phase && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">
                                  {message.phase}
                                </span>
                              )}
                            </div>
                            <p className="text-sm whitespace-pre-wrap">
                              {message.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Full transcript not available
                  </p>
                </div>
              )}

              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = "/debates")}
                >
                  Start New Debate
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
