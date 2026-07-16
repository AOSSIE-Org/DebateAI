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
export const uploadAvatar = async (
  token: string,
  file: File
): Promise<{ message: string; avatar_url: string }> => {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch(`${baseURL}/user/upload-avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (response.status === 413) {
    throw new Error("File too large. Maximum size is 5MB.");
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || "Failed to upload avatar");
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
