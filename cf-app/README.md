# DebateAI — Cloudflare edition (`cf-app/`)

A Next.js (App Router) app that runs entirely on Cloudflare Workers via
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare), replacing the Go
backend's infrastructure:

| Was (Go backend)                     | Now (this app)                                  |
| ------------------------------------ | ----------------------------------------------- |
| MongoDB (`go.mongodb.org/mongo-driver`) | **D1** (SQLite) via Drizzle ORM              |
| Redis (`redis/go-redis`)             | **Workers KV** (TTL / ephemeral state)         |
| gorilla WebSocket hub + turn timers  | **Durable Object** `DebateRoom` + cron sweep   |
| background goroutines                 | **Cron Triggers** (`scheduled()` handler)      |
| `net/smtp`                            | HTTPS email (Resend / MailChannels)            |
| `google.golang.org/genai`            | Gemini REST via `fetch`                        |
| Gin route groups + `AuthMiddleware`  | Next.js route handlers + `requireUser()`       |
| Casbin + mongodb-adapter             | `role_grants` / `user_roles` tables            |

This scaffold **fully ports auth, profile, and leaderboard** as the reference
pattern. Every other domain has a schema, an adapter, and an entry in
`GET /api/_status`. See [`docs/CLOUDFLARE-MIGRATION.md`](./docs/CLOUDFLARE-MIGRATION.md)
for the porting playbook and the MongoDB→D1 data-migration steps.

---

## Prerequisites

- Node 20+
- A Cloudflare account + `npx wrangler login`

## One-time setup

```bash
cd cf-app
npm install

# 1. Create the D1 database and KV namespace, then paste the IDs into wrangler.toml
npx wrangler d1 create debateai
npx wrangler kv namespace create KV

# 2. Local secrets
cp .dev.vars.example .dev.vars
#   -> set JWT_SECRET to the SAME value as the Go backend's jwt.secret
#      so existing tokens keep working during a phased cutover

# 3. Apply the schema to the local D1
npm run db:migrate:local
```

## Run locally

```bash
npm run dev            # next dev, with real D1/KV/DO bindings via OpenNext
# app on http://localhost:3000
```

`next dev` runs the route handlers but **not** `src/worker/index.ts` (the
WebSocket router + cron wrapper). To exercise those, build for Workers and run
the real runtime:

```bash
npm run preview        # opennextjs-cloudflare build && wrangler dev
```

Smoke test:

```bash
curl -s localhost:3000/api/_status | jq
curl -s -XPOST localhost:3000/signup -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"hunter2hunter2"}'
# EMAIL_PROVIDER=console -> the verification code is printed in the dev log
```

## Deploy

```bash
# secrets (once per environment)
npx wrangler secret put JWT_SECRET
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put RESEND_API_KEY        # if EMAIL_PROVIDER=resend

npm run db:migrate:remote
npm run deploy                                 # opennextjs-cloudflare build && wrangler deploy
```

## Using it from the existing React frontend

The ported routes keep the **same paths and JSON shapes** as the Go API, so the
current `frontend/` works against this app by changing one env var:

```
VITE_BASE_URL="https://debateai.<your-account>.workers.dev"
```

Live-debate sockets move from `ws://<host>/ws/debate/:id` (same path) — the token
is passed as `?token=<jwt>` instead of an `Authorization` header, since browsers
can't set headers on `WebSocket`. `/ws/matchmaking` is replaced by polling
`POST /matchmaking/heartbeat` every ~30s.

## Layout

```
cf-app/
  wrangler.toml            bindings: DB (D1), KV, DEBATE_ROOM (DO), cron
  open-next.config.ts      OpenNext adapter config
  drizzle.config.ts        schema -> ./migrations
  migrations/0000_init.sql  runnable D1 schema + RBAC seed
  src/
    db/schema.ts           D1 tables (was Mongo collections)
    db/client.ts           getDb() -> drizzle(env.DB)
    lib/
      auth.ts              signToken / verifyToken / requireUser  (was utils/auth.go + AuthMiddleware)
      password.ts          bcrypt (hashes migrate verbatim)
      google.ts            Google ID-token verify (was idtoken.Validate)
      gemini.ts            Gemini REST
      email.ts             Resend / MailChannels / console
      kv.ts                Redis replacement: matchmaking pool, rate limits, poll cache
      users.ts             userResponse / normalizeUserStats / nameFromEmail
      http.ts              json/ok/badRequest/... helpers
      ids.ts               ObjectID-compatible id generator
    app/                   route handlers (paths mirror the Go router)
    durable-objects/DebateRoom.ts    live debate: sockets + phase/turn state + alarm timer
    worker/index.ts        custom entry: WS routing + cron, wraps OpenNext
    worker/matchmaking-sweep.ts      cron pairing (was periodicMatchmaking goroutine)
```
