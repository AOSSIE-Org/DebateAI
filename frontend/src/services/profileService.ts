const baseURL = import.meta.env.VITE_BASE_URL;

export const getProfile = async (token: string) => {
  const response = await fetch(`${baseURL}/user/fetchprofile`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch profile");
  }
  return response.json();
};

export const updateProfile = async (
  token: string,
  displayName: string,
  bio: string
) => {
  const response = await fetch(`${baseURL}/user/updateprofile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ displayName, bio }),
  });
  if (!response.ok) {
    throw new Error("Failed to update profile");
  }
  return response.json();
};

export const getLeaderboard = async () => {
  const response = await fetch(`${baseURL}/leaderboard`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch leaderboard");
  }
  return response.json();
};
