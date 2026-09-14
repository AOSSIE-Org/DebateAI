import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { signToken } from "@/lib/auth";
import { userResponse } from "@/lib/users";
import { badRequest, ok, readJson, serverError } from "@/lib/http";

// POST /verifyEmail  — port of controllers.VerifyEmail
export async function POST(req: Request) {
  const body = await readJson<{ email?: string; confirmationCode?: string }>(req);
  if (!body?.email || !body?.confirmationCode) {
    return badRequest("Invalid input");
  }
  const db = getDb();

  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.email, body.email),
        eq(users.verificationCode, body.confirmationCode),
      ),
    )
    .limit(1);
  if (!user) return badRequest("Invalid email or verification code");

  const ageMs = Date.now() - new Date(user.createdAt ?? 0).getTime();
  if (ageMs > 24 * 60 * 60 * 1000) {
    return badRequest("Verification code expired. Please sign up again.");
  }

  const now = new Date().toISOString();
  await db
    .update(users)
    .set({ isVerified: true, verificationCode: null, updatedAt: now })
    .where(eq(users.id, user.id));

  try {
    const token = await signToken(user.email);
    return ok({
      message: "Email verification successful. You are now logged in.",
      accessToken: token,
      user: userResponse({ ...user, isVerified: true, updatedAt: now }),
    });
  } catch (e) {
    return serverError("Failed to generate token", { message: String(e) });
  }
}
