import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Typed accessor for env bindings + vars + secrets.
 * Replaces `config.LoadConfig("./config/config.prod.yml")` — there is no config
 * file at runtime on Workers; everything comes from wrangler.toml `[vars]`,
 * `wrangler secret put`, or `.dev.vars` locally.
 */
export function env(): CloudflareEnv {
  return getCloudflareContext().env as unknown as CloudflareEnv;
}

/** Optional execution context (waitUntil, passThroughOnException). */
export function ctx() {
  return getCloudflareContext().ctx;
}

export function jwtExpiryMinutes(): number {
  const n = Number(env().JWT_EXPIRY_MINUTES);
  return Number.isFinite(n) && n > 0 ? n : 1440;
}
