import config from "../config/config";
const baseURL =
  config.baseUrl ??
  (import.meta.env.DEV ? "http://localhost:1313" : undefined);
if (!baseURL) {
  throw new Error("VITE_BASE_URL is not set. Define it in your frontend .env file.");
}

export interface LeaderboardPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const fetchLeaderboardData = async (
  token: string,
  limit?: number,
  options: { page?: number; sort?: "score" | "rating"; includeCurrentUser?: boolean } = {}
) => {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set("limit", String(limit));
  if (options.page !== undefined) params.set("page", String(options.page));
  if (options.sort !== undefined) params.set("sort", options.sort);
  if (options.includeCurrentUser) params.set("includeCurrentUser", "true");
  const query = params.size ? `?${params}` : "";
  const response = await fetch(`${baseURL}/leaderboard${query}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`, 
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.status}`);
  }

  return response.json();
};
