import type { Config } from "drizzle-kit";

// `npm run db:generate` diffs src/db/schema.ts and writes SQL into ./migrations,
// which `wrangler d1 migrations apply` then runs against D1.
export default {
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
} satisfies Config;
