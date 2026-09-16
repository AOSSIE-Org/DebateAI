import { matchmaking } from "@/lib/kv";
import { ok } from "@/lib/http";

// GET /debug/matchmaking-pool  — port of routes.GetMatchmakingPoolStatusHandler
export async function GET() {
  const pool = (await matchmaking.list()).filter((e) => e.startedMatchmaking);
  return ok({ pool, poolSize: pool.length, timestamp: new Date().toISOString() });
}
