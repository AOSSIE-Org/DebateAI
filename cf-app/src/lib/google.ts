import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "./env";

/**
 * Verify a Google ID token — replaces `google.golang.org/api/idtoken.Validate`.
 * Checks signature against Google's JWKS, issuer, audience (our OAuth client id)
 * and expiry.
 */
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export type GooglePayload = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub: string;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GooglePayload> {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env().GOOGLE_OAUTH_CLIENT_ID,
  });
  return payload as GooglePayload;
}
