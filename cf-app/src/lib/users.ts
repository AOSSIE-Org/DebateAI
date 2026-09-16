import type { User } from "@/db/schema";

/** extractNameFromEmail — username before '@'. */
export function nameFromEmail(email: string): string {
  const i = email.indexOf("@");
  return i > 0 ? email.slice(0, i) : email;
}

function sanitizeFloat(v: number | null | undefined, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** normalizeUserStats — returns patched fields when rating data is missing/NaN. */
export function normalizeUserStats(u: User): Partial<User> | null {
  const patch: Partial<User> = {};
  if (!Number.isFinite(u.rating)) patch.rating = 1200;
  if (!Number.isFinite(u.rd)) patch.rd = 350;
  if (!Number.isFinite(u.volatility) || u.volatility <= 0) patch.volatility = 0.06;
  if (!u.lastRatingUpdate) patch.lastRatingUpdate = new Date().toISOString();
  if (Object.keys(patch).length === 0) return null;
  patch.updatedAt = new Date().toISOString();
  return patch;
}

/** buildUserResponse — the shape the frontend already expects from the Go API. */
export function userResponse(u: User) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    nickname: u.nickname,
    bio: u.bio,
    rating: sanitizeFloat(u.rating, 1200),
    rd: sanitizeFloat(u.rd, 350),
    volatility: sanitizeFloat(u.volatility, 0.06),
    lastRatingUpdate: u.lastRatingUpdate ?? "",
    avatarUrl: u.avatarUrl,
    twitter: u.twitter,
    instagram: u.instagram,
    linkedin: u.linkedin,
    isVerified: u.isVerified,
    createdAt: u.createdAt ?? "",
    updatedAt: u.updatedAt ?? "",
  };
}

export const DEFAULT_AVATAR = (seed: string) =>
  `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
