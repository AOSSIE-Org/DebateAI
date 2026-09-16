import { env } from "./env";

/**
 * KV replaces Redis for all of the Go backend's *ephemeral / TTL* state:
 *
 *   Go (internal/debate + services/matchmaking) ─────► KV key shape
 *   ─────────────────────────────────────────────      ─────────────────────────
 *   matchmaking pool map                               mm:pool:<userId>      (TTL)
 *   rate:question:<debateID>:<hash>                    rl:q:<debateID>:<hash>  (TTL)
 *   rate:reaction:<debateID>:<hash>                    rl:r:<debateID>:<hash>  (TTL)
 *   debate:<id>:poll:<pid>:counts                      poll:<id>:<pid>:counts
 *   debate:<id>:poll:<pid>:voters (SET)               poll:<id>:<pid>:v:<hash>
 *
 * Caveats vs Redis:
 *   - KV is eventually consistent and has no atomic INCR. Rate limits are
 *     therefore best-effort (fine for abuse mitigation, not for billing).
 *   - For anything that must be strongly consistent within a live debate
 *     (authoritative vote tallies, turn order), use the DebateRoom Durable
 *     Object instead — it has transactional per-object storage.
 */
function kv(): KVNamespace {
  return env().KV;
}

// ─── Matchmaking pool ───────────────────────────────────────────────────────
export type PoolEntry = {
  userId: string;
  username: string;
  elo: number;
  minElo: number;
  maxElo: number;
  joinedAt: number; // epoch ms
  lastActivity: number;
  startedMatchmaking: boolean;
};

const POOL_PREFIX = "mm:pool:";
const POOL_TTL = 120; // seconds; refreshed on every heartbeat

export const matchmaking = {
  async upsert(entry: PoolEntry) {
    await kv().put(POOL_PREFIX + entry.userId, JSON.stringify(entry), {
      expirationTtl: POOL_TTL,
    });
  },
  async remove(userId: string) {
    await kv().delete(POOL_PREFIX + userId);
  },
  async get(userId: string): Promise<PoolEntry | null> {
    return kv().get(POOL_PREFIX + userId, "json");
  },
  async list(): Promise<PoolEntry[]> {
    const out: PoolEntry[] = [];
    let cursor: string | undefined;
    do {
      const page = await kv().list({ prefix: POOL_PREFIX, cursor });
      for (const k of page.keys) {
        const v = await kv().get<PoolEntry>(k.name, "json");
        if (v) out.push(v);
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return out;
  },
};

// ─── Rate limiting (best-effort) ───────────────────────────────────────────
async function bumpCounter(key: string, max: number, windowSec: number) {
  const current = Number((await kv().get(key)) ?? 0);
  if (current >= max) return false;
  await kv().put(key, String(current + 1), {
    expirationTtl: current === 0 ? windowSec : undefined,
  });
  return true;
}

export const rateLimit = {
  question: (debateID: string, hash: string, max = 1, windowSec = 15) =>
    bumpCounter(`rl:q:${debateID}:${hash}`, max, windowSec),
  reaction: (debateID: string, hash: string, max = 5, windowSec = 10) =>
    bumpCounter(`rl:r:${debateID}:${hash}`, max, windowSec),
};

// ─── Live-debate polls (snapshot cache; authority = DebateRoom DO) ─────────
export type PollSnapshot = {
  pollId: string;
  question: string;
  options: string[];
  counts: Record<string, number>;
};

export const polls = {
  key: (debateID: string, pollID: string) => `poll:${debateID}:${pollID}:counts`,
  voterKey: (debateID: string, pollID: string, hash: string) =>
    `poll:${debateID}:${pollID}:v:${hash}`,

  async snapshot(debateID: string, pollID: string): Promise<PollSnapshot | null> {
    return kv().get(polls.key(debateID, pollID), "json");
  },
  async putSnapshot(debateID: string, s: PollSnapshot) {
    await kv().put(polls.key(debateID, s.pollId), JSON.stringify(s));
  },
  async hasVoted(debateID: string, pollID: string, hash: string) {
    return (await kv().get(polls.voterKey(debateID, pollID, hash))) !== null;
  },
  async markVoted(debateID: string, pollID: string, hash: string) {
    await kv().put(polls.voterKey(debateID, pollID, hash), "1", {
      expirationTtl: 60 * 60 * 6,
    });
  },
};
