import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { savedDebateTranscripts, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { DEFAULT_AVATAR, nameFromEmail } from "@/lib/users";
import { badRequest, notFound, ok, serverError } from "@/lib/http";

// GET /user/fetchprofile[?userId=<id>]  — port of controllers.GetProfile
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const db = getDb();
  const url = new URL(req.url);
  const target = (url.searchParams.get("userId") ?? "").trim();

  // --- Public path: another user's profile card -----------------------------
  if (target && target !== "undefined" && target !== "null") {
    if (!/^[0-9a-f]{24}$/.test(target)) {
      return badRequest("Invalid user ID format", { provided: target });
    }
    const [u] = await db.select().from(users).where(eq(users.id, target)).limit(1);
    if (!u) return notFound("User not found");

    const displayName = u.displayName || nameFromEmail(u.email);
    return ok({
      profile: {
        id: u.id,
        email: u.email,
        displayName,
        bio: u.bio,
        rating: u.rating,
        score: u.score,
        badges: u.badges ?? [],
        currentStreak: u.currentStreak,
        avatarUrl: u.avatarUrl || DEFAULT_AVATAR(displayName),
        lastActivityAt: u.lastActivityDate,
      },
    });
  }

  // --- Authenticated user's full profile -----------------------------------
  const user = auth;
  const displayName = user.displayName || nameFromEmail(user.email);
  const avatar = user.avatarUrl || DEFAULT_AVATAR(displayName);

  let top5, transcripts;
  try {
    top5 = await db
      .select()
      .from(users)
      .orderBy(desc(users.rating))
      .limit(5);
    transcripts = await db
      .select()
      .from(savedDebateTranscripts)
      .where(eq(savedDebateTranscripts.userId, user.id))
      .orderBy(desc(savedDebateTranscripts.createdAt));
  } catch (e) {
    return serverError("Database error", { message: String(e) });
  }

  const leaderboard = top5.map((u, i) => {
    const name = u.displayName || nameFromEmail(u.email);
    return {
      rank: i + 1,
      name,
      score: Math.trunc(u.rating),
      avatarUrl: u.avatarUrl || DEFAULT_AVATAR(name),
      currentUser: u.email === user.email,
    };
  });

  let wins = 0,
    losses = 0,
    draws = 0;
  const eloHistory: { elo: number; date: string }[] = [];
  const recentDebates: unknown[] = [];
  for (const t of transcripts) {
    if (recentDebates.length < 10) {
      recentDebates.push({
        id: t.id,
        topic: t.topic,
        result: t.result,
        opponent: t.opponent,
        debateType: t.debateType,
        date: t.createdAt,
        eloChange: 0,
      });
    }
    eloHistory.push({ elo: Math.trunc(user.rating), date: t.createdAt ?? "" });
    if (t.result === "win") wins++;
    else if (t.result === "loss") losses++;
    else if (t.result === "draw") draws++;
  }
  const total = wins + losses + draws;
  const winRate = total > 0 ? (wins / total) * 100 : 0;

  return ok({
    profile: {
      id: user.id,
      displayName,
      email: user.email,
      bio: user.bio,
      rating: Math.trunc(user.rating),
      score: user.score,
      badges: user.badges ?? [],
      currentStreak: user.currentStreak,
      twitter: user.twitter,
      instagram: user.instagram,
      linkedin: user.linkedin,
      avatarUrl: avatar,
    },
    leaderboard,
    stats: {
      wins,
      losses,
      draws,
      winRate,
      totalDebates: total,
      eloHistory,
      debateHistory: [],
      recentDebates,
    },
  });
}
