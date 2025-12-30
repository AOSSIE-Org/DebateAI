const baseURL = import.meta.env.VITE_BASE_URL;

export const getProfile = async (token: string) => {
  const response = await fetch(`${baseURL}/user/fetchprofile`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    // Surface backend error message when available
    const msg = data?.error || data?.message || response.statusText || 'Failed to fetch profile';
    throw new Error(msg);
  }

  return data;
};

export const updateProfile = async (
  token: string,
  displayName: string,
  bio: string,
  twitter?: string,
  instagram?: string,
  linkedin?: string,
  avatarUrl?: string
) => {
  const response = await fetch(`${baseURL}/user/updateprofile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ displayName, bio, twitter, instagram, linkedin,avatarUrl }),
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
