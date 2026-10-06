const baseURL =
  import.meta.env.VITE_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:1313" : undefined);
if (!baseURL) {
  throw new Error("VITE_BASE_URL is not set. Define it in your frontend .env file.");
}

export const fetchLeaderboardData = async (token: string, limit?: number) => {
  const query = limit === undefined ? "" : `?limit=${limit}`;
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
