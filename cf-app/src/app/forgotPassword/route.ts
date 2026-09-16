import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { numericCode } from "@/lib/ids";
import { sendPasswordResetEmail } from "@/lib/email";
import { badRequest, ok, readJson, serverError } from "@/lib/http";

// POST /forgotPassword  — port of controllers.ForgotPassword
export async function POST(req: Request) {
  const body = await readJson<{ email?: string }>(req);
  if (!body?.email) return badRequest("Invalid input", { message: "Check email format" });
  const db = getDb();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);
  if (!user) return badRequest("User not found");

  const code = numericCode(6);
  await db
    .update(users)
    .set({ resetPasswordCode: code, updatedAt: new Date().toISOString() })
    .where(eq(users.id, user.id));

  try {
    await sendPasswordResetEmail(body.email, code);
  } catch (e) {
    return serverError("Failed to send reset email", { message: String(e) });
  }
  return ok({
    message: "Password reset initiated. Check your email for further instructions.",
  });
}
