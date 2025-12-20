import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAnalytics,
  getAnalyticsHistory,
  getDebates,
  getComments,
  deleteDebate,
  deleteComment,
  bulkDeleteDebates,
  bulkDeleteComments,
  getAdminActionLogs,
  type Analytics,
  type Debate,
  type Comment,
  type AdminActionLog,
  type AnalyticsSnapshot,
  type Admin,
} from "@/services/adminService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Users, MessageSquare, Activity } from "lucide-react";

type SnapshotLike = AnalyticsSnapshot &
  Partial<Record<"DebatesToday" | "CommentsToday" | "NewUsersToday", number>>;

type FormattedSnapshot = SnapshotLike & {
  formattedDate: string;
  fullDate: string;
  dateKey: string;
  showLabel: boolean;
  debatesToday: number;
  commentsToday: number;
  newUsersToday: number;
};

const USE_MANUAL_ANALYTICS = true;

const MANUAL_HISTORY_POINTS: Array<{
  daysAgo: number;
  totalDebates: number;
  activeUsers: number;
  totalComments: number;
  totalUsers: number;
  debatesToday: number;
  commentsToday: number;
  newUsersToday: number;
}> = [
  {
    daysAgo: 9,
    totalDebates: 180,
    activeUsers: 92,
    totalComments: 340,
    totalUsers: 760,
    debatesToday: 6,
    commentsToday: 18,
    newUsersToday: 4,
  },
  {
    daysAgo: 8,
    totalDebates: 188,
    activeUsers: 96,
    totalComments: 358,
    totalUsers: 770,
    debatesToday: 7,
    commentsToday: 21,
    newUsersToday: 5,
  },
  {
    daysAgo: 7,
    totalDebates: 195,
    activeUsers: 98,
    totalComments: 368,
    totalUsers: 780,
    debatesToday: 8,
    commentsToday: 24,
    newUsersToday: 5,
  },
  {
    daysAgo: 6,
    totalDebates: 203,
    activeUsers: 102,
    totalComments: 384,
    totalUsers: 791,
    debatesToday: 9,
    commentsToday: 27,
    newUsersToday: 6,
  },
  {
    daysAgo: 5,
    totalDebates: 212,
    activeUsers: 108,
    totalComments: 405,
    totalUsers: 805,
    debatesToday: 10,
    commentsToday: 31,
    newUsersToday: 6,
  },
  {
    daysAgo: 4,
    totalDebates: 221,
    activeUsers: 113,
    totalComments: 430,
    totalUsers: 820,
    debatesToday: 11,
    commentsToday: 35,
    newUsersToday: 7,
  },
  {
    daysAgo: 3,
    totalDebates: 231,
    activeUsers: 118,
    totalComments: 462,
    totalUsers: 836,
    debatesToday: 12,
    commentsToday: 40,
    newUsersToday: 7,
  },
  {
    daysAgo: 2,
    totalDebates: 240,
    activeUsers: 124,
    totalComments: 498,
    totalUsers: 854,
    debatesToday: 13,
    commentsToday: 44,
    newUsersToday: 8,
  },
  {
    daysAgo: 1,
    totalDebates: 245,
    activeUsers: 129,
    totalComments: 540,
    totalUsers: 872,
    debatesToday: 11,
    commentsToday: 47,
    newUsersToday: 8,
  },
  {
    daysAgo: 0,
    totalDebates: 248,
    activeUsers: 134,
    totalComments: 612,
    totalUsers: 890,
    debatesToday: 12,
    commentsToday: 58,
    newUsersToday: 9,
  },
];

const latestManualPoint =
  MANUAL_HISTORY_POINTS.find((point) => point.daysAgo === 0) ??
  [...MANUAL_HISTORY_POINTS].reduce((previous, current) =>
    current.daysAgo < previous.daysAgo ? current : previous
  );

const createManualAnalytics = (): Analytics => ({
  totalDebates: latestManualPoint.totalDebates,
  activeUsers: latestManualPoint.activeUsers,
  totalComments: latestManualPoint.totalComments,
  totalUsers: latestManualPoint.totalUsers,
  debatesToday: latestManualPoint.debatesToday,
  commentsToday: latestManualPoint.commentsToday,
  newUsersToday: latestManualPoint.newUsersToday,
  timestamp: new Date().toISOString(),
});

const buildManualHistory = (): FormattedSnapshot[] => {
  const sortedPoints = [...MANUAL_HISTORY_POINTS].sort(
    (a, b) => b.daysAgo - a.daysAgo
  );

  return sortedPoints.map((point, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - point.daysAgo);

    const timestamp = date.toISOString();
    return {
      id: `manual-${point.daysAgo}`,
      timestamp,
      totalDebates: point.totalDebates,
      activeUsers: point.activeUsers,
      totalComments: point.totalComments,
      totalUsers: point.totalUsers,
      debatesToday: point.debatesToday,
      commentsToday: point.commentsToday,
      newUsersToday: point.newUsersToday,
      formattedDate: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      fullDate: date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      dateKey: timestamp.split("T")[0],
      showLabel: index % 3 === 0 || index === sortedPoints.length - 1,
    };
  });
};

export default function AdminDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(() =>
    USE_MANUAL_ANALYTICS ? createManualAnalytics() : null
  );
  const [analyticsHistory, setAnalyticsHistory] = useState<FormattedSnapshot[]>(
    () => (USE_MANUAL_ANALYTICS ? buildManualHistory() : [])
  );
  const [debates, setDebates] = useState<Debate[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [logs, setLogs] = useState<AdminActionLog[]>([]);
  const [selectedDebates, setSelectedDebates] = useState<Set<string>>(
    new Set()
  );
  const [selectedComments, setSelectedComments] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadData = useCallback(async (adminToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const analyticsData = await getAnalytics(adminToken);
      const manualAnalyticsSnapshot = createManualAnalytics();

      if (USE_MANUAL_ANALYTICS) {
        setAnalytics(manualAnalyticsSnapshot);
      } else {
        setAnalytics(analyticsData);
      }

      const [historyResult, debatesResult, commentsResult, logsResult] =
        await Promise.allSettled([
          getAnalyticsHistory(adminToken, 30), // Fetch last 30 days (1 month)
          getDebates(adminToken, 1, 20),
          getComments(adminToken, 1, 20),
          getAdminActionLogs(adminToken, 1, 50),
        ]);

      const historyData =
        historyResult.status === "fulfilled"
          ? historyResult.value
          : { snapshots: [] as AnalyticsSnapshot[] };
      const debatesData =
        debatesResult.status === "fulfilled"
          ? debatesResult.value
          : { debates: [] as Debate[] };
      const commentsData =
        commentsResult.status === "fulfilled"
          ? commentsResult.value
          : { comments: [] as Comment[] };
      const logsData =
        logsResult.status === "fulfilled"
          ? logsResult.value
          : { logs: [] as AdminActionLog[] };

      // Format analytics history with readable dates and group by day
      const snapshots = (historyData.snapshots || []) as SnapshotLike[];

      // Group by day and take the latest snapshot for each day
      const groupedByDay = new Map<string, SnapshotLike>();
      snapshots.forEach((snapshot) => {
        const date = new Date(snapshot.timestamp);
        const dayKey = date.toISOString().split("T")[0]; // YYYY-MM-DD format

        if (
          !groupedByDay.has(dayKey) ||
          new Date(snapshot.timestamp) >
            new Date(groupedByDay.get(dayKey)?.timestamp ?? 0)
        ) {
          groupedByDay.set(dayKey, snapshot);
        }
      });

      // Convert to array and format dates
      const sortedSnapshots = Array.from(groupedByDay.values()).sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const formattedHistory = sortedSnapshots.map((snapshot, index) => {
        const date = new Date(snapshot.timestamp);
        // Show date label every 3-5 days to avoid overcrowding
        const shouldShowLabel =
          index % 3 === 0 || index === sortedSnapshots.length - 1;

        // Ensure all numeric fields are properly converted
        return {
          ...snapshot,
          // Ensure debatesToday is a number (handle both camelCase and potential variations)
          debatesToday: Number(
            snapshot.debatesToday ?? snapshot.DebatesToday ?? 0
          ),
          commentsToday: Number(
            snapshot.commentsToday ?? snapshot.CommentsToday ?? 0
          ),
          newUsersToday: Number(
            snapshot.newUsersToday ?? snapshot.NewUsersToday ?? 0
          ),
          formattedDate: date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          fullDate: date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          dateKey: date.toISOString().split("T")[0],
          showLabel: shouldShowLabel,
        };
      });

      const historyForDisplay =
        USE_MANUAL_ANALYTICS || formattedHistory.length === 0
          ? buildManualHistory()
          : formattedHistory;

      setAnalyticsHistory(historyForDisplay);
      setDebates(debatesData.debates || []);
      setComments(commentsData.comments || []);
      setLogs(logsData.logs || []);
    } catch (err) {
      console.error("Failed to load data:", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
          ? err
          : "Failed to load admin data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");
    const adminData = localStorage.getItem("admin");

    if (!adminToken || !adminData) {
      navigate("/admin/login");
      return;
    }
    setToken(adminToken);
    setAdmin(JSON.parse(adminData));
    loadData(adminToken);
  }, [loadData, navigate]);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
    navigate("/admin/login");
  };

  const handleDeleteDebate = async (id: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this debate?")) return;

    try {
      await deleteDebate(token, id);
      setDebates(debates.filter((d) => d.id !== id));
      loadData(token);
    } catch (err) {
      console.error("Failed to delete debate", err);
      alert("Failed to delete debate");
    }
  };

  const handleDeleteComment = async (id: string, type: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      await deleteComment(token, id, type);
      setComments(comments.filter((c) => c.id !== id));
      loadData(token);
    } catch (err) {
      console.error("Failed to delete comment", err);
      alert("Failed to delete comment");
    }
  };

  const handleBulkDeleteDebates = async () => {
    if (!token || selectedDebates.size === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedDebates.size} debates?`
      )
    )
      return;

    try {
      await bulkDeleteDebates(token, Array.from(selectedDebates));
      setSelectedDebates(new Set());
      loadData(token);
    } catch (err) {
      console.error("Failed to delete debates", err);
      alert("Failed to delete debates");
    }
  };

  const handleBulkDeleteComments = async () => {
    if (!token || selectedComments.size === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedComments.size} comments?`
      )
    )
      return;

    try {
      // Get types for selected comments
      const commentTypes = comments
        .filter((c) => selectedComments.has(c.id))
        .map((c) => c.type);
      const type = commentTypes[0] || "team_debate_message";

      await bulkDeleteComments(token, Array.from(selectedComments), type);
      setSelectedComments(new Set());
      loadData(token);
    } catch (err) {
      console.error("Failed to delete comments", err);
      alert("Failed to delete comments");
    }
  };

  const toggleDebateSelection = (id: string) => {
    const newSelected = new Set(selectedDebates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDebates(newSelected);
  };

  const toggleCommentSelection = (id: string) => {
    const newSelected = new Set(selectedComments);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedComments(newSelected);
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-8 space-y-4">
        <p className="text-red-600 text-sm">
          Failed to load dashboard: {error}
        </p>
        <Button
          onClick={() => {
            if (token) {
              loadData(token);
            }
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-8 space-y-4">
        <p className="text-muted-foreground text-sm">
          No analytics data available yet.
        </p>
        <Button
          onClick={() => {
            const currentToken = token || localStorage.getItem("adminToken");
            if (currentToken) {
              loadData(currentToken);
            }
          }}
        >
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm">
              {admin?.name} ({admin?.role})
            </span>
            <Button onClick={handleLogout} variant="outline">
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Debates
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalDebates}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.debatesToday} today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.activeUsers}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.totalUsers} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Comments
              </CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.totalComments}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics.commentsToday} today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                New Users Today
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.newUsersToday}
              </div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Analytics Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="debates">
              <TabsList>
                <TabsTrigger value="debates">Debates</TabsTrigger>
                <TabsTrigger value="comments">Comments</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
              </TabsList>

              <TabsContent value="debates">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="formattedDate"
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval="preserveStartEnd"
                      minTickGap={20}
                      tickFormatter={(value, index) => {
                        // Show every 3rd date or last date to avoid overcrowding
                        if (analyticsHistory.length <= 7) return value; // Show all if 7 days or less
                        if (
                          index % 3 === 0 ||
                          index === analyticsHistory.length - 1
                        )
                          return value;
                        return "";
                      }}
                    />
                    <YAxis allowDecimals={false} domain={[0, "auto"]} />
                    <Tooltip
                      labelFormatter={(value, payload) => {
                        if (payload && payload[0] && payload[0].payload) {
                          return payload[0].payload.fullDate || value;
                        }
                        return value;
                      }}
                      formatter={(value: number | string) => {
                        return [Number(value) || 0, "Debates"];
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="debatesToday"
                      stroke="#8884d8"
                      name="Debates"
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="comments">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="formattedDate"
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval="preserveStartEnd"
                      minTickGap={20}
                      tickFormatter={(value, index) => {
                        // Show every 3rd date or last date to avoid overcrowding
                        if (analyticsHistory.length <= 7) return value; // Show all if 7 days or less
                        if (
                          index % 3 === 0 ||
                          index === analyticsHistory.length - 1
                        )
                          return value;
                        return "";
                      }}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value, payload) => {
                        if (payload && payload[0] && payload[0].payload) {
                          return payload[0].payload.fullDate || value;
                        }
                        return value;
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="commentsToday"
                      stroke="#82ca9d"
                      name="Comments"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="users">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="formattedDate"
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval="preserveStartEnd"
                      minTickGap={20}
                      tickFormatter={(value, index) => {
                        // Show every 3rd date or last date to avoid overcrowding
                        if (analyticsHistory.length <= 7) return value; // Show all if 7 days or less
                        if (
                          index % 3 === 0 ||
                          index === analyticsHistory.length - 1
                        )
                          return value;
                        return "";
                      }}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value, payload) => {
                        if (payload && payload[0] && payload[0].payload) {
                          return payload[0].payload.fullDate || value;
                        }
                        return value;
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="newUsersToday"
                      stroke="#ffc658"
                      name="New Users"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Management Tabs */}
        <Tabs defaultValue="debates">
          <TabsList>
            <TabsTrigger value="debates">Debates</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="logs">Action Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="debates">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Debates Management</CardTitle>
                  {selectedDebates.size > 0 && (
                    <Button
                      onClick={handleBulkDeleteDebates}
                      variant="destructive"
                      disabled={admin?.role !== "admin"}
                    >
                      Delete Selected ({selectedDebates.size})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        {admin?.role === "admin" && <Checkbox />}
                      </TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debates.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No debates found
                        </TableCell>
                      </TableRow>
                    ) : (
                      debates.map((debate) => (
                        <TableRow key={debate.id}>
                          <TableCell>
                            {admin?.role === "admin" && (
                              <Checkbox
                                checked={selectedDebates.has(debate.id)}
                                onCheckedChange={() =>
                                  toggleDebateSelection(debate.id)
                                }
                              />
                            )}
                          </TableCell>
                          <TableCell>{debate.topic}</TableCell>
                          <TableCell>{debate.email}</TableCell>
                          <TableCell>{debate.result}</TableCell>
                          <TableCell>
                            {new Date(debate.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {admin?.role === "admin" && (
                              <Button
                                onClick={() => handleDeleteDebate(debate.id)}
                                variant="destructive"
                                size="sm"
                              >
                                Delete
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Comments Management</CardTitle>
                  {selectedComments.size > 0 && (
                    <Button
                      onClick={handleBulkDeleteComments}
                      variant="destructive"
                    >
                      Delete Selected ({selectedComments.size})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox />
                      </TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No comments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      comments.map((comment) => (
                        <TableRow key={comment.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedComments.has(comment.id)}
                              onCheckedChange={() =>
                                toggleCommentSelection(comment.id)
                              }
                            />
                          </TableCell>
                          <TableCell className="max-w-md truncate">
                            {comment.content}
                          </TableCell>
                          <TableCell>
                            {comment.displayName || comment.userEmail}
                          </TableCell>
                          <TableCell>{comment.type}</TableCell>
                          <TableCell>
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() =>
                                handleDeleteComment(comment.id, comment.type)
                              }
                              variant="destructive"
                              size="sm"
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Admin Action Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Admin</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No action logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{log.adminEmail}</TableCell>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>{log.resourceType}</TableCell>
                          <TableCell>{log.ipAddress}</TableCell>
                          <TableCell>{log.deviceInfo}</TableCell>
                          <TableCell>
                            {new Date(log.timestamp).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
