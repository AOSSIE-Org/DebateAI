import { requireUser } from "@/lib/auth";
import { matchmaking, type PoolEntry } from "@/lib/kv";
import { badRequest, ok, readJson } from "@/lib/http";

/**
 * POST /matchmaking/heartbeat  — HTTP replacement for the `/ws/matchmaking`
 * WebSocket loop (websocket.MatchmakingHandler + services.MatchmakingService).
 *
 * The browser polls this every ~30s while the "Find opponent" screen is open:
 *   { action: "join" | "start" | "leave" }
 *
 * Pairing itself is done by the cron sweep (see src/worker/index.ts `scheduled`),
 * which reads the KV pool and, on a match, creates a DebateRoom and writes the
 * room id onto both entries. The client sees `match` on its next heartbeat.
 */
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const body = await readJson<{ action?: "join" | "start" | "leave" }>(req);
  if (!body?.action) return badRequest("action required");

  if (body.action === "leave") {
    await matchmaking.remove(auth.id);
    return ok({ status: "left" });
  }

  const existing = await matchmaking.get(auth.id);
  const elo = Math.trunc(auth.rating);
  const entry: PoolEntry = {
    userId: auth.id,
    username: auth.displayName || auth.email,
    elo,
    minElo: elo - 200,
    maxElo: elo + 200,
    joinedAt: existing?.joinedAt ?? Date.now(),
    lastActivity: Date.now(),
    startedMatchmaking:
      body.action === "start" ? true : existing?.startedMatchmaking ?? false,
  };
  await matchmaking.upsert(entry);

  // If the sweep already paired this user, `matchState` will be present.
  const state = await matchmaking.get(auth.id);
  const matchRoomId = (state as PoolEntry & { matchRoomId?: string })?.matchRoomId;
  return ok(
    matchRoomId
      ? { status: "matched", roomId: matchRoomId }
      : { status: entry.startedMatchmaking ? "searching" : "queued" },
  );
}
