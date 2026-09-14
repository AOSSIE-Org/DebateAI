import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users, type User } from "@/db/schema";
import { env, jwtExpiryMinutes } from "./env";
import { unauthorized } from "./http";

/**
 * JWT — HS256, claims `{ sub: <email>, iat, exp }`, identical to the Go
 * backend's `generateJWT`. Set JWT_SECRET to the SAME value as the Go service
 * and tokens issued by either side validate on the other, so the frontend can
 * be cut over route-by-route.
 */
function secret(): Uint8Array {
  return new TextEncoder().encode(env().JWT_SECRET);
}

export async function signToken(email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + jwtExpiryMinutes() * 60)
    .sign(secret());
}

export type Claims = { sub: string; iat: number; exp: number };

export async function verifyToken(token: string): Promise<Claims> {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new joseErrors.JWTInvalid("missing sub claim");
  }
  return payload as unknown as Claims;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const [scheme, value] = h.split(" ");
  return scheme === "Bearer" && value ? value : null;
}

/**
 * Equivalent of `middlewares.AuthMiddleware`: validates the bearer token and
 * loads the user row. On failure it *returns* a Response (401) — call sites do
 * `const auth = await requireUser(req); if (auth instanceof Response) return auth;`
 */
export async function requireUser(req: Request): Promise<User | Response> {
  const token = bearer(req);
  if (!token) return unauthorized("Authorization header is required");

  let claims: Claims;
  try {
    claims = await verifyToken(token);
  } catch (e) {
    const msg =
      e instanceof joseErrors.JWTExpired ? "Token is expired" : "Invalid token";
    return unauthorized(msg);
  }

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, claims.sub))
    .limit(1);
  if (!user) return unauthorized("User not found");
  return user;
}
