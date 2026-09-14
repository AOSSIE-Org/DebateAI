# DebateAI → Cloudflare Workers + D1 + KV: migration & integration guide

This document explains how the Go backend (`backend/`) maps onto the Cloudflare
stack in `cf-app/`, how to move the data, and how to port each remaining domain.

- [1. Target architecture](#1-target-architecture)
- [2. Service mapping](#2-service-mapping)
- [3. Data migration: MongoDB → D1](#3-data-migration-mongodb--d1)
- [4. Redis → KV](#4-redis--kv)
- [5. WebSockets → Durable Objects](#5-websockets--durable-objects)
- [6. Auth](#6-auth)
- [7. Porting a domain (worked recipe)](#7-porting-a-domain-worked-recipe)
- [8. Remaining domains — checklist](#8-remaining-domains--checklist)
- [9. Frontend integration](#9-frontend-integration)
- [10. Cutover strategy](#10-cutover-strategy)

---

## 1. Target architecture

```
              ┌──────────────────────── Cloudflare Worker (1 script) ───────────────────────┐
  browser ───▶│  src/worker/index.ts                                                        │
   (React)    │    ├─ /ws/debate/:id   ──▶  Durable Object  DebateRoom  (sockets + timers)  │
              │    └─ everything else  ──▶  OpenNext handler ──▶ Next.js App Router routes   │
              │                                   │                                          │
              │                                   ├─ getDb()  ──▶  D1  (SQLite)   [was Mongo]│
              │                                   ├─ lib/kv   ──▶  KV             [was Redis]│
              │                                   ├─ lib/gemini ─▶ Gemini REST              │
              │                                   └─ lib/email  ─▶ Resend / MailChannels     │
              │  scheduled()  ── cron "* * * * *" ──▶  matchmaking sweep  [was goroutine]    │
              └────────────────────────────────────────────────────────────────────────────┘
```

Everything is one Worker deployment. D1, KV and the DO are **bindings** on that
Worker (see `wrangler.toml`), not separate services to run or scale.

## 2. Service mapping

| Go package / file | Cloudflare equivalent | Notes |
| --- | --- | --- |
| `config/config.go` (`config.prod.yml`) | `src/lib/env.ts` | No runtime file. `[vars]` in `wrangler.toml`, `wrangler secret put`, `.dev.vars` locally. |
| `db/db.go` `ConnectMongoDB` | `src/db/client.ts` `getDb()` | Request-scoped; no pool, no connect step. |
| `db.GetCollection("x")` | Drizzle table in `src/db/schema.ts` | `db.select().from(x)` |
| `db/db.go` `ConnectRedis` | `src/lib/kv.ts` | KV namespace binding `KV`. |
| `middlewares/InitCasbin`, `middlewares/rbac.go` | `role_grants` + `user_roles` tables | One `SELECT` to check `(role, resource, action)`. |
| `middlewares/auth.go` `AuthMiddleware` | `src/lib/auth.ts` `requireUser()` | Same bearer-token → load-user flow. |
| `utils/auth.go` (JWT, bcrypt) | `src/lib/auth.ts` + `src/lib/password.ts` | `jose` HS256, `bcryptjs`. Token & hash formats unchanged. |
| `utils/email.go` (`net/smtp`) | `src/lib/email.ts` | Workers can't do raw SMTP; HTTPS providers. |
| `services/gemini.go`, `services/ai.go` | `src/lib/gemini.ts` | `fetch` to `generativelanguage.googleapis.com`. |
| `services/matchmaking.go` (in-mem map + goroutines) | `src/lib/kv.ts` `matchmaking` + `src/worker/matchmaking-sweep.ts` | Pool in KV; pairing on cron. |
| `websocket/*.go` (gorilla hub) | `src/durable-objects/DebateRoom.ts` | The one thing that must be a DO. |
| `internal/debate/redis_client.go`, `poll_store.go`, `rate_limiter.go`, `stream_consumer.go` | `src/lib/kv.ts` (`polls`, `rateLimit`) + DebateRoom storage | Strong-consistency parts belong in the DO; caches/counters in KV. |
| `cmd/server/main.go` `router.Run` | `src/worker/index.ts` `export default { fetch }` | |
| `utils/populate.go` `SeedDebateData` / `PopulateTestUsers` | a `scripts/seed.ts` you run with `wrangler d1 execute` | not included here |
| `transcribeService.py` (Whisper) | Workers AI `@cf/openai/whisper` **or** a standalone service | Python ML can't run on Workers. |

## 3. Data migration: MongoDB → D1

**Model choice — "D1 + JSON columns".** Columns that are filtered / sorted /
counted get real typed columns + indexes (see `src/db/schema.ts`). Nested
sub-documents (turn arrays, AI evaluation blobs, rosters, per-format settings)
go into a single `data TEXT` JSON column, read with `json_extract()` when needed.

**ID compatibility.** Mongo `_id` is a 12-byte ObjectID → 24 hex chars. D1 `id`
columns are `TEXT` holding that same hex string. `src/lib/ids.ts` `newId()`
produces new IDs in the identical format, so exported IDs migrate unchanged and
foreign-key-like references (`userId`, `authorId`, …) keep working.

### Steps

1. **Export** each collection from Mongo:

   ```bash
   mongoexport --uri "$MONGO_URI" --collection users --jsonArray --out users.json
   # repeat for: saved_debate_transcripts debates_vs_bot debates team_debates
   #             posts comments likes follows notifications rooms teams
   #             ratings_history admin_action_logs
   ```

2. **Transform** to rows matching `schema.ts`. A tiny Node script per collection:

   ```ts
   // scripts/xform-users.ts   (run with: npx tsx)
   import fs from "node:fs";
   const docs = JSON.parse(fs.readFileSync("users.json", "utf8"));
   const rows = docs.map((d: any) => ({
     id: d._id.$oid ?? d._id,
     email: d.email,
     display_name: d.displayName ?? null,
     nickname: d.nickname ?? null,
     bio: d.bio ?? "",
     rating: d.rating ?? 1200,
     rd: d.rd ?? 350,
     volatility: d.volatility ?? 0.06,
     last_rating_update: iso(d.lastRatingUpdate),
     avatar_url: d.avatarUrl ?? null,
     password: d.password ?? null,
     is_verified: d.isVerified ? 1 : 0,
     verification_code: d.verificationCode ?? null,
     reset_password_code: d.resetPasswordCode ?? null,
     score: d.score ?? 0,
     badges: JSON.stringify(d.badges ?? []),
     current_streak: d.currentStreak ?? 0,
     last_activity_date: iso(d.lastActivityDate),
     created_at: iso(d.createdAt) ?? new Date().toISOString(),
     updated_at: iso(d.updatedAt) ?? new Date().toISOString(),
   }));
   fs.writeFileSync("users.sql", toInsert("users", rows));

   function iso(v: any) {
     if (!v) return null;
     return v.$date ? new Date(v.$date).toISOString() : new Date(v).toISOString();
   }
   function toInsert(table: string, rows: any[]) {
     return rows
       .map((r) => {
         const cols = Object.keys(r).join(",");
         const vals = Object.values(r)
           .map((x) => (x === null ? "NULL" : typeof x === "number" ? x : `'${String(x).replace(/'/g, "''")}'`))
           .join(",");
         return `INSERT INTO ${table} (${cols}) VALUES (${vals});`;
       })
       .join("\n");
   }
   ```

   - `debates_vs_bot.created_at` stays a **unix-seconds integer** (Go used `int64`).
   - Anything without a dedicated column goes into `data` as `JSON.stringify(...)`.
   - Dedupe on the unique indexes (`email`, `display_name`, `likes(post,user)`,
     `follows(follower,followee)`) before import or the batch fails.

3. **Load** into D1:

   ```bash
   npx wrangler d1 execute debateai --remote --file=users.sql
   # ...one per collection. For big files split into <100k-statement chunks.
   ```

4. **Verify counts**: `SELECT count(*) FROM users;` vs the Mongo count.

### Casbin → tables

The Go RBAC model was `sub, obj, act`. Export the `casbin_rule` collection and
turn `p, <role>, <resource>, <action>` lines into `role_grants` rows, and
`g, <user>, <role>` lines into `user_roles` rows. The three default grants are
already seeded in `0000_init.sql`. Check permission with:

```ts
const [grant] = await db.select().from(roleGrants)
  .where(and(eq(roleGrants.role, role), eq(roleGrants.resource, res), eq(roleGrants.action, act)))
  .limit(1);
```

## 4. Redis → KV

| Redis usage (Go) | KV key | Consistency note |
| --- | --- | --- |
| matchmaking pool (in-mem map, but conceptually shared) | `mm:pool:<userId>` (TTL 120s) | eventually consistent; fine — pairing is a cron sweep |
| `rate:question:<debateID>:<hash>` | `rl:q:<debateID>:<hash>` (TTL) | **no atomic INCR** — best-effort abuse mitigation only |
| `rate:reaction:<debateID>:<hash>` | `rl:r:<debateID>:<hash>` (TTL) | same |
| `debate:<id>:poll:<pid>:counts` | `poll:<id>:<pid>:counts` (snapshot) | authoritative tally lives in the DebateRoom DO; KV is a read cache |
| `debate:<id>:poll:<pid>:voters` (SET) | `poll:<id>:<pid>:v:<hash>` (per-voter key, TTL) | |
| Redis Streams (`stream_consumer.go`) | DO storage + `broadcast()` | Streams have no KV equivalent; the DO fans out directly |

**Rule of thumb:** if losing or double-counting a value would corrupt a live
debate result, it goes in the **DO** (`state.storage`, transactional). If it's a
counter, a cache, or a short-lived queue entry, **KV** is fine.

If you need true atomic counters or pub/sub semantics, the drop-in is
**Upstash Redis** (HTTP, works from Workers) — add `UPSTASH_REDIS_REST_URL` /
`_TOKEN` and swap `src/lib/kv.ts` internals; the public API of that module is
designed to stay the same.

## 5. WebSockets → Durable Objects

Workers can accept a WebSocket in a plain `fetch`, but there's no shared memory
between isolates, so a debate room needs a single owner. That's `DebateRoom`
(`src/durable-objects/DebateRoom.ts`), one instance per `debateID` via
`idFromName(debateID)`.

It reimplements:

- **hub / broadcast** — `this.sessions` set + `broadcast()`
- **roles** — `debater` vs `spectator`, derived from `room.debaters`
- **phase machine** — `lobby → opening → cross → closing → voting → ended`
- **turn clock** — `state.storage.setAlarm(turnEndsAt)` → `alarm()` advances the
  turn / phase and broadcasts a `timeout`. This replaces the Go `time.Timer`
  goroutines in `services/team_turn_service.go` / `internal/debate`.
- **poll authority** — keep vote tallies in `state.storage` inside the DO;
  mirror a snapshot to KV (`polls.putSnapshot`) for cheap reads elsewhere.

**Client changes:** browsers can't set headers on `WebSocket`, so the JWT goes in
the query string: `wss://<host>/ws/debate/<id>?token=<jwt>`. The Worker verifies
it (`src/worker/index.ts`), then forwards the upgrade to the DO with `?uid=`
attached. `reconnecting-websocket` (already a frontend dep) handles drops.

**Still TODO in the DO skeleton:** persisting the final transcript to
`saved_debate_transcripts`, calling the rating update, spectator poll CRUD
messages, and WebRTC signaling relay (the Go app passed SDP/ICE through the same
socket — add `case "rtc-offer" / "rtc-answer" / "rtc-ice"` to `onMessage` and
`broadcast` them to the other debater).

`/ws/gamification` and `/ws/team` — either give each its own DO
(`GamificationRoom`, `TeamRoom`) following the same shape, or, if they're just
notification fan-out, replace with SSE (`ReadableStream` from a route handler)
backed by a KV/DO pubsub.

## 6. Auth

- **JWT**: HS256, claims `{ sub: <email>, iat, exp }` — byte-identical to
  `generateJWT` in `controllers/auth.go`. Set `JWT_SECRET` to the **same** value
  as the Go `jwt.secret` and tokens are mutually valid, so you can run both
  backends side by side during cutover.
- **Passwords**: `bcryptjs`, cost 10 (= `bcrypt.DefaultCost`). Existing
  `users.password` hashes verify unchanged. `bcryptjs` is pure-JS; a cost-10
  hash is a few hundred ms of isolate CPU — acceptable at login volume. Optional:
  re-hash to WebCrypto PBKDF2 on next successful login.
- **Google**: `jose` `createRemoteJWKSet` against Google's certs +
  issuer/audience check = `idtoken.Validate`.
- **`requireUser(req)`** returns the `User` row or a `Response` (401). Pattern:

  ```ts
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  // auth is the user row  (was c.GetString("email") / c.Get("userID"))
  ```

## 7. Porting a domain (worked recipe)

Example: **community** (`routes/community.go` + `controllers/{post,comment,like,follow}_controller.go`).

1. **Schema** — already in `src/db/schema.ts` (`posts`, `comments`, `likes`,
   `follows`). Add columns for anything the controller filters/sorts on;
   everything else → `data`.

2. **Route files** — mirror the Go paths under `src/app/`:

   ```
   src/app/posts/route.ts                 -> POST (create)  + GET /posts/feed via ?feed=1 or a /posts/feed/route.ts
   src/app/posts/[id]/route.ts            -> GET, DELETE
   src/app/posts/[id]/like/route.ts       -> POST (toggle)
   src/app/posts/top/likes/route.ts       -> GET
   src/app/comments/route.ts              -> POST
   src/app/comments/[transcriptId]/route.ts -> GET
   src/app/users/[userId]/follow/route.ts -> POST, DELETE
   ```

   Next.js dynamic segments: `export async function GET(req, { params })`.

3. **Handler body** — translate the Mongo calls:

   | Mongo | Drizzle |
   | --- | --- |
   | `col.InsertOne(ctx, doc)` | `db.insert(posts).values({ id: newId(), ... })` |
   | `col.FindOne(ctx, bson.M{"_id": id})` | `db.select().from(posts).where(eq(posts.id, id)).limit(1)` |
   | `col.Find(ctx, filter, opts.SetSort(...).SetLimit(n))` | `db.select().from(posts).where(...).orderBy(desc(posts.createdAt)).limit(n)` |
   | `col.UpdateOne(ctx, filter, bson.M{"$set": patch})` | `db.update(posts).set(patch).where(...)` |
   | `col.UpdateOne(..., bson.M{"$inc": {"likeCount": 1}})` | `db.update(posts).set({ likeCount: sql\`${posts.likeCount} + 1\` }).where(...)` |
   | `col.CountDocuments(ctx, filter)` | `db.select({ n: count() }).from(posts).where(...)` |
   | `col.DeleteOne(ctx, filter)` | `db.delete(posts).where(...)` |
   | `col.Aggregate([...])` | usually a `groupBy` + join; or app-side after a `select` |

4. **Auth + RBAC** — `const auth = await requireUser(req)` at the top; for admin/
   moderator deletes, add the `role_grants` check from §3.

5. **Response shape** — keep `c.JSON` bodies identical so the frontend is
   untouched. Use `ok()` / `badRequest()` from `src/lib/http.ts`.

6. **Update `GET /api/_status`** — flip the domain from `todo` to `ported`.

## 8. Remaining domains — checklist

| Domain | Go source | Cloudflare work | Data |
| --- | --- | --- | --- |
| debate-vs-bot | `routes/debatevsbot.go`, `services/debatevsbot.go`, `controllers/debatevsbot_controller.go` | route handlers; stream the model reply or return once; `geminiGenerate()` | `debates_vs_bot` (`created_at` = unix int) |
| coach | `routes/coach.go`, `services/coach.go` | 2 handlers (`weak-statement`, `evaluate`); `geminiGenerate({ json: true })`; then `db.update(users).set({ score: sql\`score + ?\` })` | `users.score` |
| transcripts | `routes/transcriptroutes.go`, `controllers/transcript_controller.go` | CRUD on `saved_debate_transcripts`; the big turn array → `data` JSON | `saved_debate_transcripts` |
| community | see §7 | §7 | `posts/comments/likes/follows` |
| gamification | `routes/gamification.go`, `websocket/gamification*.go` | REST handlers now; `/ws/gamification` → SSE or a `GamificationRoom` DO | `users.badges/score/currentStreak` |
| notifications | `routes/notification.go` | list / mark-read / delete on `notifications` | `notifications` |
| rooms | `routes/rooms.go` | CRUD on `rooms`; join = append to `participants` JSON (or a `room_members` table) | `rooms` |
| team + team debate + team chat + team matchmaking | `routes/team*.go`, `services/team_*` | `teams` + `team_debates`; team matchmaking = second KV pool; team chat + turn clock = `TeamRoom` DO (clone `DebateRoom`) | `teams`, `team_debates` |
| admin | `routes/admin.go`, `controllers/{admin,analytics,comment}_controller.go` | separate `AdminAuth` (role check via `user_roles`); analytics = `count()` queries; log every action to `admin_action_logs` | `admin_action_logs`, `role_grants`, `user_roles` |
| rating | `services/rating_service.go`, `rating/` | pure function — port as `src/lib/rating.ts`; call from DebateRoom `finish()` and `/debate/result` | `users.rating/rd/volatility`, `ratings_history` |
| live debate results | `websocket/websocket.go` | DebateRoom `finish()` → write transcript + call rating | |
| transcription | `transcribeService.py` | Workers AI `env.AI.run("@cf/openai/whisper", ...)` (add `[ai] binding = "AI"`), or keep the Python service on Fly/Render and `fetch` it | audio in R2 if you need to store it |
| WebRTC signaling | inside the debate socket | add `rtc-*` message relay in `DebateRoom.onMessage` (TURN via Cloudflare Calls or an external TURN server) | |

## 9. Frontend integration

Two options.

### A. Keep `frontend/` (Vite/React) as-is — fastest

Point it at the Worker:

```
# frontend/.env
VITE_BASE_URL="https://debateai.<account>.workers.dev"
```

Because the ported routes preserve paths + JSON, most screens work immediately.
Only socket setup changes:

```ts
// was: new WebSocket(`${WS_BASE}/ws/debate/${id}`) with Authorization somewhere
const ws = new ReconnectingWebSocket(
  `${WS_BASE}/ws/debate/${id}?token=${accessToken}`,
);
```

and swap the `/ws/matchmaking` socket for a 30s `POST /matchmaking/heartbeat`
poll that reads `{ status, roomId }`.

### B. Fold the frontend into this Next.js app — one deploy

`npx create-next-app`-style move: copy `frontend/src` in, convert
`react-router` routes to App Router folders, replace `import.meta.env.VITE_*`
with `process.env.NEXT_PUBLIC_*`, and drop the AWS Amplify dev-deps. Server
Components can then call the DB directly instead of round-tripping through
`/api`. Bigger lift; do it after the API side is fully ported.

## 10. Cutover strategy

1. Ship `cf-app` with **auth + profile + leaderboard** (this scaffold). Same
   `JWT_SECRET` as Go.
2. Put Cloudflare in front as the origin; **proxy unported paths** to the Go
   service from `src/worker/index.ts` (`fetch(new Request("https://go-origin"+path, request))`)
   so nothing 404s.
3. Port domains one at a time (§7), flipping each from proxy → native and
   updating `/api/_status`. Migrate that collection's data (§3) just before you
   flip it.
4. Port the live-debate DO + rating last; run a few real debates against it.
5. Remove the proxy and decommission MongoDB / Redis / the Go service.
6. (Optional) do frontend option B.
