/**
 * Custom Worker entry that wraps the OpenNext handler so we can add the two
 * things Next.js route handlers can't express on Cloudflare:
 *
 *   1. WebSocket upgrades  ->  routed to the DebateRoom Durable Object
 *      (GET /ws/debate/:debateID, /ws/matchmaking is HTTP-polled instead)
 *   2. Cron `scheduled()`  ->  the matchmaking sweep + stale-pool GC that used
 *      to be Go background goroutines (services.periodicMatchmaking /
 *      cleanupInactiveUsers, websocket.WatchForNewRooms)
 *
 * Build order (see package.json `deploy`):
 *   opennextjs-cloudflare build   # emits .open-next/worker.js
 *   wrangler deploy               # bundles THIS file, which imports it
 */
// @ts-expect-error - generated at build time by `opennextjs-cloudflare build`
import openNext from "../../.open-next/worker.js";
import { verifyToken } from "@/lib/auth";
import { runMatchmakingSweep } from "./matchmaking-sweep";

export { DebateRoom } from "@/durable-objects/DebateRoom";

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // wss://<host>/ws/debate/<debateID>?token=<jwt>
    const m = url.pathname.match(/^\/ws\/debate\/([^/]+)\/?$/);
    if (m) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected websocket", { status: 426 });
      }
      const token =
        url.searchParams.get("token") ??
        request.headers.get("sec-websocket-protocol") ??
        "";
      let sub: string;
      try {
        ({ sub } = await verifyToken(token));
      } catch {
        return new Response("unauthorized", { status: 401 });
      }

      const debateID = m[1];
      const id = env.DEBATE_ROOM.idFromName(debateID);
      const stub = env.DEBATE_ROOM.get(id);

      // forward to the DO with the authenticated user id attached
      const fwd = new URL(request.url);
      fwd.searchParams.set("uid", sub);
      return stub.fetch(new Request(fwd, request));
    }

    // everything else -> Next.js (OpenNext)
    return openNext.fetch(request, env, ctx);
  },

  async scheduled(_event: ScheduledEvent, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(runMatchmakingSweep(env));
  },
};
