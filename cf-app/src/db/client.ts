import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

/**
 * Drizzle client bound to the request's D1 instance.
 *
 * Replaces `db.MongoDatabase` / `db.GetCollection(...)` from the Go backend.
 * There is no long-lived connection to manage — D1 is request-scoped, so call
 * this inside each route handler rather than at module top level.
 */
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

export { schema };
export type Db = ReturnType<typeof getDb>;
