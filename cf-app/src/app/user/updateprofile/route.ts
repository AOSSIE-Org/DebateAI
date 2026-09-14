import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { badRequest, conflict, ok, readJson, serverError } from "@/lib/http";

// PUT /user/updateprofile  — port of controllers.UpdateProfile
export async function PUT(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const body = await readJson<{
    displayName?: string;
    bio?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    avatarUrl?: string;
  }>(req);
  if (!body) return badRequest("Invalid body");

  const db = getDb();
  const newDisplayName = (body.displayName ?? "").trim();

  if (newDisplayName) {
    const [existing] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.displayName, newDisplayName))
      .limit(1);
    if (existing && existing.email !== auth.email) {
      return conflict("Display name already taken");
    }
  }

  try {
    await db
      .update(users)
      .set({
        displayName: newDisplayName || auth.displayName,
        bio: (body.bio ?? "").trim(),
        twitter: (body.twitter ?? "").trim(),
        instagram: (body.instagram ?? "").trim(),
        linkedin: (body.linkedin ?? "").trim(),
        avatarUrl: (body.avatarUrl ?? "").trim(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.email, auth.email));
  } catch (e) {
    if (String(e).includes("UNIQUE")) return conflict("Display name already taken");
    return serverError("Failed to update profile");
  }

  return ok({ message: "Profile updated successfully" });
}
