import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { badRequest, ok, readJson, serverError } from "@/lib/http";

// POST /confirmForgotPassword  — port of controllers.VerifyForgotPassword
export async function POST(req: Request) {
  const body = await readJson<{ email?: string; code?: string; newPassword?: string }>(
    req,
  );
  if (!body?.email || !body?.code || !body?.newPassword) {
    return badRequest("Invalid input");
  }
  const db = getDb();

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.email, body.email), eq(users.resetPasswordCode, body.code)),
    )
    .limit(1);
  if (!user) return badRequest("Invalid email or reset code");

  try {
    await db
      .update(users)
      .set({
        password: await hashPassword(body.newPassword),
        resetPasswordCode: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id));
  } catch (e) {
    return serverError("Failed to reset password", { message: String(e) });
  }
  return ok({ message: "Password successfully changed" });
}
