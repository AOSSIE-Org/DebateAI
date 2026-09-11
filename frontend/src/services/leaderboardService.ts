const baseURL = import.meta.env.VITE_BASE_URL || "http://localhost:1313";

export const fetchLeaderboardData = async (token: string) => {
  const response = await fetch(`${baseURL}/leaderboard`, {
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