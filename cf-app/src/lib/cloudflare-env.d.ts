/**
 * Ambient types for the Cloudflare bindings. Regenerate the accurate version any
 * time wrangler.toml changes with `npm run cf-typegen`.
 */
interface CloudflareEnv {
  ASSETS: Fetcher;

  // D1 — replaces MongoDB
  DB: D1Database;

  // KV — replaces Redis (TTL / ephemeral state)
  KV: KVNamespace;

  // Durable Object — live-debate WebSocket rooms
  DEBATE_ROOM: DurableObjectNamespace;

  // vars
  JWT_EXPIRY_MINUTES: string;
  APP_BASE_URL: string;
  EMAIL_FROM: string;
  EMAIL_PROVIDER: "resend" | "mailchannels" | "console";
  GOOGLE_OAUTH_CLIENT_ID: string;

  // secrets
  JWT_SECRET: string;
  GEMINI_API_KEY: string;
  RESEND_API_KEY: string;
}
