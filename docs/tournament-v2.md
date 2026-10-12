# Tournament V2 API and Operations

This extends #671 with one side-based text debate per tournament (3-11 people).
It is not bracket progression, live1v1/2v2/4v4 audio/video, ratings or rewards.

## API Compatibility

#671 paths and exported admission controller names are retained. Identity/name
come from authentication, not client-supplied participant fields.

| Endpoint | Input / behavior |
| --- | --- |
| `POST /tournaments/:id/join` | No body or{}; public join201, identical retry200. Receipt includes `message`, `tournamentId`, `userId` and redacted detail. |
| `POST /tournaments/join` | `{inviteCode}`; private receipt202 with status/timestamp. Pending/approved replay is a no-op. |
| `GET /tournaments/:id/requests` | Host-only pending array/count, capacity, revision and lobby state. |
| `PATCH /tournaments/:id/request/:userId` | `action: approve/reject`; optional `requestCreatedAt` fences stale attempts. Legacy status approved/rejected accepted, never both fields. |
| `PATCH /tournaments/:id/stance` | Own admitted membership; stance for/against while lobby is open. |
| `GET /tournaments/:id/request` | Own-request status/timestamp without private host detail. |
| `POST /tournaments/:id/start` | Host-only{}; readiness/schedule checks, one frozen run; replay returns existing run. |
| `GET /tournaments/:id/execution` | Authorized phase/server-time/deadline and own receipts, not peer transcripts. |
| `POST /tournaments/:id/transcript` | `{runId,round,content}`; one immutable accepted input per person/eligible phase. |
| `GET /tournaments/:id/evaluation` | Protected read-only pending/running/completed/failed/legacy state and validated results; no manual judging trigger. |

First join/private request uses201/202 instead of #671's200: clients must accept
HTTP success. Capacity/start conflicts are409; private outsiders404; malformed,
oversized, duplicate-key or unknown-field writes400; invite/request limits429.
Admission/settings/start share atomic revision and frozen-run guards. A rejected
user can atomically reapply before start with a newer timestamp and reset decision
metadata. At most64 current request records, not an append-only history. Old
timestamps cannot decide a new attempt; unversioned actions target the current one.

## Execution and Scoring

Existing documents gain `schemaVersion`, `revision`, embedded `execution` and
`evaluation`. Missing revision means0; no execution means lobby/legacy, not a
fabricated result. Start freezes valid names/stances on both sides and run ID.
Eight shared180-second phases: opening for, opening against, cross-examination
question for, answer against, question against, answer for, closing for/against.
Each participant has four eligible phases. Canonical text is limited to8192 UTF-8
bytes and hashed; identical retries return receipts. Missing slots score0; restart
recovery advances deadlines. Final closure queues exactly one evaluation record.

Worker bounds: two slots/process,150-second leases,120-second job deadline,
three attempts maximum, bounded retries/corrective validation and run/hash/revision/
lease fencing. Publication and completion are atomic, not exactly-once billing.
Criteria maxima35/25/25/15: reasoning, relevance, phase skill, clarity. Server
derives totals out of400/person, compares exact side means and returns draws/tied
individual winners independently of side outcome. Results are read-only/no-store;
polling never triggers judging. Browser speech is optional, not shared media.

## Enablement and Acceptance Gates

Evaluation is **disabled by default**; pending inputs are retained. Explicitly set
`TOURNAMENT_EVALUATION_ENABLED=true` and `TOURNAMENT_EVALUATION_MODEL` to a supported
model to use the configured Gemini key. Never commit secrets or enable paid calls
without approval. Provider inputs use aliases, bounded untrusted text and no tools;
strict parsing does not certify judging quality, fairness or prompt resistance.

Before deployment, audit invite duplicates/index rights, backup/rollback, trusted
proxy/distributed throttles, clocks, concurrency/quota/cost, real authentication,
TLS, rubric/privacy and retention/consent. Accepted text is retained; no deletion,
appeals or reevaluation policy is invented. Plaintext browser drafts are isolated
by account/run/phase, not confidential from someone using the same device.

## Validation

Run `go test ./... -count=1` and `go vet ./...` from backend, and `npm run build`
and `npm run lint` from frontend. Set `TOURNAMENT_TEST_MONGO_URI` to isolated local
Mongo for database tests; they create/drop uniquely named databases and skip if
unset. Never use production. Provider tests use injected mock HTTP transport;
mock scores are not live-model evidence. Full repository lint has existing legacy
failures; race instrumentation needs a compatible64-bit C toolchain.
