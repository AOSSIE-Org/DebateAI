import { requireUser } from "@/lib/auth";
import { ok } from "@/lib/http";

// POST /verifyToken  — port of controllers.VerifyToken
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  return ok({
    message: "Token is valid",
    user: {
      id: auth.id,
      email: auth.email,
      displayName: auth.displayName,
      nickname: auth.nickname,
      bio: auth.bio,
      rating: auth.rating,
      rd: auth.rd,
      volatility: auth.volatility,
      lastRatingUpdate: auth.lastRatingUpdate ?? "",
      avatarUrl: auth.avatarUrl,
      twitter: auth.twitter,
      instagram: auth.instagram,
      linkedin: auth.linkedin,
      isVerified: auth.isVerified,
      createdAt: auth.createdAt ?? "",
      updatedAt: auth.updatedAt ?? "",
    },
  });
}
