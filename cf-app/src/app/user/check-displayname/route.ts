import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { badRequest, ok } from "@/lib/http";

// GET /user/check-displayname?displayName=...  — port of controllers.CheckDisplayName
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const displayName = (new URL(req.url).searchParams.get("displayName") ?? "").trim();
  if (!displayName) return badRequest("displayName query param required");

  const db = getDb();
  const [existing] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.displayName, displayName))
    .limit(1);

  return ok({ available: !existing || existing.email === auth.email });
}
