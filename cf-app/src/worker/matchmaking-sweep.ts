import { matchmaking, type PoolEntry } from "@/lib/kv";
import { newId } from "@/lib/ids";

/**
 * Runs once a minute (wrangler.toml `[triggers] crons`). Replaces the Go
 * `MatchmakingService.periodicMatchmaking` goroutine:
 *   - pair users whose Elo windows overlap
 *   - for each pair, create a DebateRoom DO and stamp `matchRoomId` on both
 *     KV entries so their next /matchmaking/heartbeat returns the room
 *   - stale entries expire on their own via the KV TTL (was cleanupInactiveUsers)
 */
export async function runMatchmakingSweep(env: CloudflareEnv): Promise<void> {
  const pool = (await matchmaking.list())
    .filter((e) => e.startedMatchmaking && !(e as Stamped).matchRoomId)
    .sort((a, b) => a.joinedAt - b.joinedAt);

  const used = new Set<string>();

  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];
    if (used.has(a.userId)) continue;

    for (let j = i + 1; j < pool.length; j++) {
      const b = pool[j];
      if (used.has(b.userId)) continue;
      if (a.elo > b.maxElo || a.elo < b.minElo) continue;
      if (b.elo > a.maxElo || b.elo < a.minElo) continue;

      const roomId = newId();
      const doId = env.DEBATE_ROOM.idFromName(roomId);
      await env.DEBATE_ROOM.get(doId).fetch("https://do/init", {
        method: "POST",
        body: JSON.stringify({ debaters: [a.userId, b.userId], format: "standard" }),
      });

      await stamp(a, roomId);
      await stamp(b, roomId);
      used.add(a.userId);
      used.add(b.userId);
      break;
    }
  }
}

type Stamped = PoolEntry & { matchRoomId?: string };

async function stamp(entry: PoolEntry, roomId: string) {
  await matchmaking.upsert({ ...(entry as Stamped), matchRoomId: roomId } as PoolEntry);
}
