import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { verifyGoogleIdToken } from "@/lib/google";
import { signToken } from "@/lib/auth";
import { nameFromEmail, normalizeUserStats, userResponse } from "@/lib/users";
import { newId } from "@/lib/ids";
import { badRequest, ok, readJson, serverError, unauthorized } from "@/lib/http";

// POST /googleLogin  — port of controllers.GoogleLogin
export async function POST(req: Request) {
  const body = await readJson<{ idToken?: string }>(req);
  if (!body?.idToken) return badRequest("Invalid input", { message: "idToken required" });

  let payload;
  try {
    payload = await verifyGoogleIdToken(body.idToken);
  } catch (e) {
    return unauthorized("Invalid Google ID token");
  }
  const email = payload.email;
  if (!email) return badRequest("Email not found in Google token");

  const nickname = payload.name || nameFromEmail(email);
  const avatarUrl = payload.picture ?? "";
  const db = getDb();

  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user) {
    const [dnTaken] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.displayName, nickname))
      .limit(1);
    if (dnTaken) return badRequest("Display name already taken");

    const now = new Date().toISOString();
    const row = {
      id: newId(),
      email,
      displayName: nickname,
      nickname,
      bio: "",
      rating: 1200,
      rd: 350,
      volatility: 0.06,
      lastRatingUpdate: now,
      avatarUrl,
      isVerified: true,
      score: 0,
      badges: [] as string[],
      currentStreak: 0,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.insert(users).values(row);
    } catch (e) {
      return serverError("Failed to create user", { message: String(e) });
    }
    [user] = await db.select().from(users).where(eq(users.id, row.id)).limit(1);
  }

  const patch = normalizeUserStats(user!);
  if (patch) await db.update(users).set(patch).where(eq(users.id, user!.id));

  try {
    const token = await signToken(user!.email);
    return ok({
      message: "Google login successful",
      accessToken: token,
      user: userResponse({ ...user!, ...patch }),
    });
  } catch (e) {
    return serverError("Failed to generate token", { message: String(e) });
  }
}
