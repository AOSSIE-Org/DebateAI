import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { newId, numericCode } from "@/lib/ids";
import { nameFromEmail } from "@/lib/users";
import { sendVerificationEmail } from "@/lib/email";
import { badRequest, ok, readJson, serverError } from "@/lib/http";

// POST /signup  — port of controllers.SignUp
export async function POST(req: Request) {
  const body = await readJson<{ email?: string; password?: string }>(req);
  if (!body?.email || !body?.password) {
    return badRequest("Invalid input", { message: "email and password required" });
  }
  const db = getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);
  if (existing) return badRequest("User already exists");

  const displayName = nameFromEmail(body.email);
  const [dnTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.displayName, displayName))
    .limit(1);
  if (dnTaken) return badRequest("Display name already taken");

  const code = numericCode(6);
  const now = new Date().toISOString();

  try {
    await db.insert(users).values({
      id: newId(),
      email: body.email,
      displayName,
      nickname: displayName,
      bio: "",
      rating: 1200,
      rd: 350,
      volatility: 0.06,
      lastRatingUpdate: now,
      avatarUrl: "https://api.dicebear.com/9.x/big-ears/svg?seed=Jude",
      password: await hashPassword(body.password),
      isVerified: false,
      verificationCode: code,
      score: 0,
      badges: [],
      currentStreak: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch (e) {
    const msg = String(e);
    if (msg.includes("UNIQUE") && msg.includes("display_name")) {
      return badRequest("Display name already taken");
    }
    return serverError("Failed to create user", { message: msg });
  }

  try {
    await sendVerificationEmail(body.email, code);
  } catch (e) {
    return serverError("Failed to send verification email", { message: String(e) });
  }

  return ok({ message: "Sign-up successful. Please verify your email." });
}
