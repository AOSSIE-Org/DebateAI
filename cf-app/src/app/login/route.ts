import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { signToken } from "@/lib/auth";
import { normalizeUserStats, userResponse } from "@/lib/users";
import { badRequest, ok, readJson, serverError, unauthorized } from "@/lib/http";

// POST /login  — port of controllers.Login
export async function POST(req: Request) {
  const body = await readJson<{ email?: string; password?: string }>(req);
  if (!body?.email || !body?.password) {
    return badRequest("Invalid input", { message: "Check email and password format" });
  }
  const db = getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);
  if (!user) return unauthorized("Invalid email or password");

  const patch = normalizeUserStats(user);
  if (patch) await db.update(users).set(patch).where(eq(users.id, user.id));

  if (!user.isVerified) return unauthorized("Email not verified");
  if (!user.password || !(await verifyPassword(body.password, user.password))) {
    return unauthorized("Invalid email or password");
  }

  try {
    const token = await signToken(user.email);
    return ok({
      message: "Sign-in successful",
      accessToken: token,
      user: userResponse({ ...user, ...patch }),
    });
  } catch (e) {
    return serverError("Failed to generate token", { message: String(e) });
  }
}
