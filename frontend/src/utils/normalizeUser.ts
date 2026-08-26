import type { User } from "@/types/user";
import { DEFAULT_AVATAR_URL } from "@/constants/avatar";

interface NormalizeOptions {
  email?: string;
  displayName?: string;
  rating?: number;
  isVerified?: boolean;
  clearVerificationCode?: boolean;
}

export const normalizeUser = (
  data: any,
  options: NormalizeOptions = {},
): User => {
  return {
    id: data?.id || data?._id || undefined,
    email: data?.email || options?.email || "",
    displayName: data?.displayName || options?.displayName || "User",
    bio: data?.bio || "",
    rating: data?.rating ?? options?.rating ?? 1500,
    rd: data?.rd ?? 350,
    volatility: data?.volatility ?? 0.06,
    lastRatingUpdate: data?.lastRatingUpdate || new Date().toISOString(),
    avatarUrl: data?.avatarUrl || DEFAULT_AVATAR_URL,
    twitter: data?.twitter || undefined,
    instagram: data?.instagram || undefined,
    linkedin: data?.linkedin || undefined,
    password: "",
    nickname: data?.nickname || options?.displayName || "User",
    isVerified: options?.isVerified ?? data?.isVerified ?? false,
    verificationCode: options?.clearVerificationCode
      ? undefined
      : data?.verificationCode,
    resetPasswordCode: options?.clearVerificationCode
      ? undefined
      : data?.resetPasswordCode,
    createdAt: data?.createdAt || new Date().toISOString(),
    updatedAt: data?.updatedAt || new Date().toISOString(),
  };
};
