# DebateAI Repository Guide

This document is a map of the repository as it exists today. It explains where the major pieces live, how requests move through the system, and which files are the best starting points for common changes.

## 1. What the project is

DebateAI is a real-time debate platform with:

- human-versus-human debates;
- human-versus-AI debates;
- text, speech, and browser media features;
- team debates and team matchmaking;
- saved transcripts, judging, ratings, leaderboards, and gamification;
- community posts, comments, likes, follows, notifications, and coaching tools;
- an administrator dashboard with analytics and moderation controls.

The repository has two application processes:

```text
Browser (React/Vite)
        |
        | HTTP JSON + WebSocket
        v
Go/Gin backend  ---- MongoDB (persistent application data)
        |
        +---- Redis (selected realtime/event features)
        +---- Gemini/AI providers (bot judging and coaching)
        +---- SMTP (verification and password-reset email)
```

The backend module is named `arguehub`, although the repository and product are named DebateAI.

## 2. Top-level layout

| Path | Purpose |
| --- | --- |
| `backend/` | Go API server, domain logic, persistence, authentication, WebSockets, and tests. |
| `frontend/` | React 18 single-page application built with Vite and TypeScript. |
| `docker-compose.yml` | Local multi-service environment for backend, frontend, MongoDB, and Redis. |
| `README.md` | Existing quick-start and contribution notes. |
| `backend/Dockerfile.dev` | Development image for the Go service. |
| `frontend/Dockerfile.dev` | Development image for the Vite service. |

The root also contains `backend/main` and `backend/server`, which are checked-in compiled artifacts or launch artifacts. Source changes should normally be made under `backend/cmd/`, not in those files.

## 3. Backend architecture

### Architectural layers

The backend is a Gin application organized by responsibility, but it is not a strict clean-architecture or repository pattern implementation:

```text
HTTP/WebSocket transport
        routes/ -> controllers/ or websocket/
                                                                                                 |
                                                                                                 v
                                                                 services/ and internal/debate/
                                                                                                 |
                                                 +-----------+-----------+
                                                 v                       v
                         models/ + db/          AI, email, Redis
                                                 |
                                                 v
                                        MongoDB
```

- **Transport layer:** `routes/` declares URLs and delegates; `websocket/` upgrades connections and handles message loops.
- **Request layer:** `controllers/` validates Gin input, reads authentication context, calls domain operations, and formats JSON responses.
- **Domain layer:** `services/` implements matchmaking, judging, rating, AI, teams, notifications, transcripts, and gamification behavior.
- **Infrastructure layer:** `db/`, `internal/debate/`, configuration, email utilities, and external AI clients connect the application to stateful or third-party systems.
- **Data contracts:** `models/` represents persisted documents; `structs/` represents request and transport payloads.

The boundaries are practical rather than absolute. Controllers and services both perform MongoDB queries, and some service files contain standalone demos or compatibility helpers. Follow the existing owning file when making a narrow change, then check the corresponding model and frontend type.

### HTTP request lifecycle

For an authenticated JSON request, the normal path is:

```text
Browser fetch()
        -> Gin route group
        -> AuthMiddleware
                        -> JWT validation
                        -> users collection lookup
                        -> user fields placed in gin.Context
        -> route adapter
        -> controller
                        -> service/domain logic
                        -> MongoDB/Redis/AI/email
        -> JSON response
```

Public authentication endpoints skip `AuthMiddleware`. Admin endpoints use the separate admin authentication and Casbin authorization chain described below.

### Startup and dependency initialization

The main runtime entry point is [backend/cmd/server/main.go](../backend/cmd/server/main.go). Startup does the following:

1. Loads `./config/config.prod.yml`.
2. Initializes the AI debate, coaching, and rating services.
3. Connects to MongoDB and ensures the unique display-name index.
4. Initializes Casbin RBAC using MongoDB-backed policies.
5. Attempts Redis initialization for Redis-backed realtime features.
6. Starts the background room watcher.
7. Sets the process-wide JWT secret, seeds debate data/test users, creates `uploads/`, and starts Gin.

Route registration is in the same file. This is the best place to see the complete public, authenticated, admin, and WebSocket surface.

### Configuration

- [backend/config/config.go](../backend/config/config.go) defines the YAML configuration shape and environment-variable overrides.
- [backend/config/config.prod.sample.yml](../backend/config/config.prod.sample.yml) documents the expected production-style values.
- `DATABASE_URI`, `REDIS_ADDR`, `GEMINI_API_KEY`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, and `PORT` can override selected YAML values.
- The real `config.prod.yml` is expected locally and should not be committed.

Configuration covers the HTTP port, MongoDB, Redis, Gemini/OpenAI-related values, JWT, SMTP, Google OAuth, and legacy Cognito fields.

### Persistence and external services

[backend/db/db.go](../backend/db/db.go) owns process-wide MongoDB and Redis clients. It provides MongoDB connection/index setup and a small set of debate-versus-bot persistence helpers. Most controllers and services use `db.MongoDatabase` directly and select their collections by name.

Important MongoDB collections used across the code include:

- `users`, `admins`;
- `debates`, `debates_vs_bot`;
- `debate_transcripts`, `debate_results`, `saved_debate_transcripts`;
- `teams`, `team_debates`;
- community collections for posts/comments/likes/follows;
- notifications, gamification records, and Casbin policy data.

There is no single repository/DAO layer: persistence is intentionally close to controllers and services. When changing a data contract, inspect both the relevant model and every controller/service that queries its collection.

Two Redis access patterns exist. `db/db.go` exposes a general `RedisClient`, while `backend/internal/debate/redis_client.go` owns a package-local Redis client used by the internal debate event infrastructure. This is important when debugging Redis behavior: initialization and consumers may not all use the same client variable.

### Authentication and authorization

- [backend/controllers/auth.go](../backend/controllers/auth.go) implements signup, email verification, login, Google login, and password recovery.
- [backend/utils/auth.go](../backend/utils/auth.go) provides password hashing, JWT creation/parsing, token helpers, and email-name extraction.
- [backend/middlewares/auth.go](../backend/middlewares/auth.go) validates `Authorization: Bearer <token>`, loads the user by the JWT subject email, and places user details in Gin context.
- [backend/middlewares/rbac.go](../backend/middlewares/rbac.go) authenticates administrators and enforces Casbin resource/action policies.
- [backend/rbac_model.conf](../backend/rbac_model.conf) defines the Casbin model used by admin authorization.
- [backend/models/admin.go](../backend/models/admin.go) and [backend/models/user.go](../backend/models/user.go) define the persisted identity records.

Normal user routes use the shared auth middleware. Admin routes use admin JWT validation plus role-based checks. The frontend stores the normal user token in local storage through [frontend/src/utils/auth.ts](../frontend/src/utils/auth.ts).

The JWT subject is normally the user's email. The normal middleware therefore performs both cryptographic validation and a live user lookup on every protected request; a valid token alone is not sufficient if the user record cannot be found. WebSocket handlers independently extract and validate tokens because a WebSocket upgrade does not pass through every HTTP route-group middleware in the same way.

## 4. Backend feature map

### HTTP routing

The `backend/routes/` package is a thin adapter from Gin routes to controller functions. The route files are the quickest API index:

| File | Registered capability |
| --- | --- |
| [backend/routes/auth.go](../backend/routes/auth.go) | Signup, verification, login, Google login, password recovery, token verification, and debug matchmaking status. |
| [backend/routes/profile.go](../backend/routes/profile.go) | Profile fetch/update and display-name checks. |
| [backend/routes/leaderboard.go](../backend/routes/leaderboard.go) | Rating leaderboard. |
| [backend/routes/debate.go](../backend/routes/debate.go) | Human debate and room operations. |
| [backend/routes/debatevsbot.go](../backend/routes/debatevsbot.go) | AI debate creation, interaction, and result operations. |
| [backend/routes/rooms.go](../backend/routes/rooms.go) | Browsing, creating, joining, and inspecting custom rooms. |
| [backend/routes/transcriptroutes.go](../backend/routes/transcriptroutes.go) | Transcript submission, saved transcript CRUD, stats, and test transcript endpoints. |
| [backend/routes/team.go](../backend/routes/team.go) | Teams, team debates, team chat, and team matchmaking. |
| [backend/routes/community.go](../backend/routes/community.go) | Posts, comments, likes, and follow relationships. |
| [backend/routes/gamification.go](../backend/routes/gamification.go) | Badge and score updates plus the gamification leaderboard. |
| [backend/routes/coach.go](../backend/routes/coach.go) | Argument-strengthening and coaching endpoints. |
| [backend/routes/notification.go](../backend/routes/notification.go) | Notification listing, read state, and deletion. |
| [backend/routes/admin.go](../backend/routes/admin.go) | Admin login, analytics, moderation, and admin management endpoints. |

The main server also registers WebSockets at `/ws`, `/ws/team`, `/ws/debate/:debateID`, `/ws/matchmaking`, and `/ws/gamification`.

### Controllers and models

Controllers translate HTTP input into application operations and JSON responses. They are grouped by domain in [backend/controllers/](../backend/controllers/): auth, profiles, debates, AI debates, teams, matchmaking, transcripts, community, gamification, notifications, leaderboard, analytics, and admin operations.

The [backend/models/](../backend/models/) package is the persistence and API-domain vocabulary. Key records are:

- `User`, `Admin`, and notification records for identity and platform activity;
- `Debate` and `DebateVsBot` for completed rating history and AI matches;
- `DebateTranscript`/`SavedDebateTranscript` and `DebateResult` for judging and replay;
- `Team` and `TeamDebate` for team membership and team matches;
- post/comment/gamification/coach models for the community and training features.

Request/transport-only structs live in [backend/structs/](../backend/structs/), including authentication and WebSocket payload shapes.

When tracing a feature, use this order: route registration -> controller handler -> service function -> model/collection access -> frontend service/page. This follows the direction of data flow and avoids treating a route adapter as the place where behavior is decided.

### Debate and AI services

- [backend/services/debatevsbot.go](../backend/services/debatevsbot.go) coordinates bot-debate state and persistence.
- [backend/services/ai.go](../backend/services/ai.go) contains AI-facing debate helpers.
- [backend/services/gemini.go](../backend/services/gemini.go) integrates Gemini generation.
- [backend/services/personalities.go](../backend/services/personalities.go) defines bot/personality choices.
- [backend/services/coach.go](../backend/services/coach.go) powers coaching interactions.
- [backend/services/pros_cons.go](../backend/services/pros_cons.go) supports the pros/cons exercise.

### Judging, transcripts, and ratings

[backend/services/transcriptservice.go](../backend/services/transcriptservice.go) accepts each side's transcript, waits until both sides are present, merges the transcript, judges it, stores the result, saves per-user transcript records, and updates ratings. It also prevents duplicate recent saves and returns a waiting response when only one side has submitted.

[backend/services/rating_service.go](../backend/services/rating_service.go) wraps the local Glicko-2 implementation in [backend/rating/glicko2.go](../backend/rating/glicko2.go). It updates both users, records pre/post rating values and changes, sanitizes invalid metrics, and sends rating notifications.

### Matchmaking and realtime state

- [backend/services/matchmaking.go](../backend/services/matchmaking.go) manages one-on-one matchmaking pools and rating tolerance.
- [backend/services/team_matchmaking.go](../backend/services/team_matchmaking.go) matches teams.
- [backend/services/team_turn_service.go](../backend/services/team_turn_service.go) tracks team debate turns and speaking permissions.
- [backend/websocket/websocket.go](../backend/websocket/websocket.go) manages ordinary debate rooms, participants, typing/speaking state, turns, transcripts, and room broadcasts.
- [backend/websocket/handler.go](../backend/websocket/handler.go) and [backend/websocket/debate_spectator.go](../backend/websocket/debate_spectator.go) handle general room/debate spectator behavior.
- [backend/websocket/matchmaking.go](../backend/websocket/matchmaking.go) handles realtime matchmaking notifications.
- [backend/websocket/team_websocket.go](../backend/websocket/team_websocket.go) and [backend/websocket/team_debate_handler.go](../backend/websocket/team_debate_handler.go) handle team debate connections and messages.
- [backend/websocket/gamification.go](../backend/websocket/gamification.go) and [backend/websocket/gamification_handler.go](../backend/websocket/gamification_handler.go) publish gamification events.

The `backend/internal/debate/` package contains Redis-backed infrastructure: event definitions, polling state, rate limiting, Redis setup, and stream consumption. It is an internal implementation detail of the backend rather than a public API.

Realtime behavior has two distinct forms:

1. **Room WebSockets** keep connection and debate state in process memory. Room maps are protected by mutexes, and each client has a write mutex so concurrent broadcasts do not interleave frames.
2. **Redis-backed events** support shared or asynchronous debate infrastructure such as rate limiting, polling, and stream consumption. Redis is optional at startup, so features depending on it may be unavailable while ordinary HTTP and MongoDB-backed behavior continues.

Team rooms add a second in-memory room model with team membership, readiness maps, a turn manager, and token buckets. Before a team connection is upgraded, the handler validates the token, loads the debate, and confirms that the user belongs to one of its teams.

## 5. Frontend architecture

### Bootstrapping and providers

- [frontend/src/main.tsx](../frontend/src/main.tsx) mounts React under `BrowserRouter`, `StrictMode`, and the application stylesheet.
- [frontend/src/App.tsx](../frontend/src/App.tsx) defines all routes and wraps them with `AuthProvider` and `ThemeProvider`.
- [frontend/src/context/authContext.tsx](../frontend/src/context/authContext.tsx) owns client authentication state and token/user lifecycle.
- [frontend/src/context/theme-provider.tsx](../frontend/src/context/theme-provider.tsx) owns theme selection.
- [frontend/src/index.css](../frontend/src/index.css) and [frontend/src/App.css](../frontend/src/App.css) contain global and application styling.

`ProtectedRoute` in `App.tsx` redirects unauthenticated users to `/`. Public pages include home, authentication, legal pages, and admin login. Authenticated pages are arranged under `Layout` and include debate, profile, community, team, coaching, tournament, leaderboard, and support workflows.

### Pages and user workflows

The [frontend/src/Pages/](../frontend/src/Pages/) directory contains route-level screens:

| Area | Main files |
| --- | --- |
| Entry/auth | `Home.tsx`, `Authentication.tsx`, `Authentication/forms.tsx` |
| Debate selection/play | `StartDebate.tsx`, `BotSelection.tsx`, `Game.tsx`, `DebateRoom.tsx`, `OnlineDebateRoom.tsx`, `ViewDebate.tsx` |
| Team play | `TeamBuilder.tsx`, `TeamDebateRoom.tsx` |
| Progress | `Profile.tsx`, `Leaderboard.tsx`, `MatchLogs.tsx` |
| Coaching | `CoachPage.tsx`, `StrengthenArgument.tsx`, `ProsConsChallenge.tsx` |
| Community | `CommunityFeed.tsx` |
| Tournaments | `TournamentHub.tsx`, `TournamentDetails.tsx`, `TournamentBracketPage.tsx` |
| Platform/admin | `Admin/AdminSignup.tsx`, `Admin/AdminDashboard.tsx`, `SupportOpenSource.tsx` |
| Legal/accessibility testing | `About.tsx`, `PrivacyPolicy.tsx`, `TermsOfService.tsx`, `SpeechTest.tsx` |

### Components, state, and integrations

- [frontend/src/components/](../frontend/src/components/) contains shared layout, navigation, debate controls, rooms, matchmaking, transcripts, profile UI, community UI, team chat, and reusable UI primitives.
- [frontend/src/components/ui/](../frontend/src/components/ui/) contains Radix/Tailwind-style primitives such as buttons, dialogs, forms, tabs, tables, progress, charts, and toasts.
- [frontend/src/services/](../frontend/src/services/) contains fetch-based API clients for auth-adjacent profile work, leaderboards, admin, notifications, teams, transcripts, gamification, and versus-bot debates.
- [frontend/src/hooks/useDebateWS.ts](../frontend/src/hooks/useDebateWS.ts) is the main client hook for debate WebSocket behavior; `useUser.ts` and toast hooks provide shared client behavior.
- [frontend/src/atoms/debateAtoms.ts](../frontend/src/atoms/debateAtoms.ts), [frontend/src/state/userAtom.ts](../frontend/src/state/userAtom.ts), and [frontend/src/state/commentsAtom.ts](../frontend/src/state/commentsAtom.ts) hold Jotai state for debates, users, and comments.
- [frontend/src/types/](../frontend/src/types/) contains user, Google, and browser speech-recognition types.
- [frontend/src/utils/speechTest.ts](../frontend/src/utils/speechTest.ts) checks browser speech-recognition and microphone support.
- [frontend/src/assets/](../frontend/src/assets/) and `frontend/public/images/` hold local visual assets.

The client uses `VITE_BASE_URL` for the backend origin, stores the user JWT under the `token` local-storage key, and constructs WebSocket URLs from the configured HTTP origin where needed.

## 6. Important end-to-end flows

### Login and protected API call

1. The authentication page sends credentials or a Google ID token.
2. The auth controller validates input, persists/loads the user, and returns a JWT.
3. The frontend stores the JWT with `setAuthToken`.
4. API services send it as a Bearer token.
5. `AuthMiddleware` validates the token and loads the current user into Gin context.

### Human debate

1. The user chooses or joins a room through the debate/room endpoints.
2. The debate page opens `/ws` or the debate-specific WebSocket.
3. The WebSocket room tracks clients, roles, readiness, turn state, text, typing, speech, and spectator state.
4. Each side submits transcripts through the transcript endpoints or room flow.
5. `SubmitTranscripts` waits for both roles, judges the merged transcript, saves results, and updates Glicko-2 ratings.

### AI debate

The bot-debate page calls the `/vsbot` route group. The bot service selects/configures the AI personality, sends prompts through the AI/Gemini integration, tracks the match, and persists the resulting debate record. Transcript and rating views reuse the common saved-transcript and leaderboard features where applicable.

### Team debate

Teams are created and managed through `/teams`. Team matchmaking uses `/matchmaking`, team debates use `/team-debates`, and the browser connects to `/ws/team`. The backend verifies team membership before creating the room, then coordinates team readiness, roles, turns, token buckets, chat, and speech/media signaling.

### Community and gamification

Community screens use the posts/comments/likes/follows service endpoints. Debate outcomes and user actions feed gamification score/badge operations and WebSocket notifications. Leaderboard and notification pages read those resulting records through their service clients.

## 7. Development and verification

### Local processes

The documented manual setup is:

```bash
cd backend
cp config/config.prod.sample.yml config/config.prod.yml
go run cmd/server/main.go
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

The default local frontend URL is `http://localhost:5173`; the backend defaults to port `1313` when configured that way.

### Docker Compose

[docker-compose.yml](../docker-compose.yml) starts:

- backend on port `1313`;
- frontend on port `5173`;
- MongoDB on `27017` with a named data volume;
- Redis on `6379` with a named data volume and health check.

Compose supplies the backend with `DATABASE_URI=mongodb://mongo:27017/debateai`, `REDIS_ADDR=redis:6379`, and `CONFIG_PATH=./config/config.prod.yml`. Secrets still come from the backend/frontend `.env` files.

### Tests and checks

- Go tests: `cd backend && go test ./...`
- Frontend typecheck/build: `cd frontend && npm run build`
- Frontend lint: `cd frontend && npm run lint`
- Backend matchmaking coverage is in [backend/services/matchmaking_test.go](../backend/services/matchmaking_test.go).
- Backend WebSocket coverage is in [backend/websocket/websocket_test.go](../backend/websocket/websocket_test.go).
- [backend/cmd/test_judge/main.go](../backend/cmd/test_judge/main.go) and [backend/test_server.go](../backend/test_server.go) are executable debugging/test harnesses, not the production server.

## 8. Where to start a change

| Change | Start here |
| --- | --- |
| Add an HTTP endpoint | Add a controller in `backend/controllers/`, register it in `backend/routes/`, then add/update a frontend service. |
| Change authentication | `backend/controllers/auth.go`, `backend/middlewares/auth.go`, `backend/utils/auth.go`, and `frontend/src/context/authContext.tsx`. |
| Change a debate screen | The matching page in `frontend/src/Pages/`, then its room components and `useDebateWS.ts`. |
| Change realtime behavior | Matching files under `backend/websocket/`, then the frontend WebSocket hook/service. |
| Change transcript judging | `backend/services/transcriptservice.go`, transcript controller/routes, and `frontend/src/services/transcriptService.ts`. |
| Change rating behavior | `backend/services/rating_service.go` and `backend/rating/glicko2.go`. |
| Change teams | `backend/models/team.go`, team controllers/routes/services/WebSockets, and `frontend/src/services/teamService.ts` or `teamDebateService.ts`. |
| Change admin permissions | `backend/middlewares/rbac.go`, `backend/rbac_model.conf`, admin routes/controllers, and admin frontend pages/services. |
| Change global styling/layout | `frontend/src/components/Layout.tsx`, `frontend/src/App.css`, and `frontend/src/index.css`. |

## 9. Operational caveats

- Startup currently seeds debate data and test users from `cmd/server/main.go`; verify the target environment before treating startup as side-effect free.
- WebSocket origin checking is permissive in the current implementation and should be reviewed before production exposure.
- Several debug/test endpoints and harnesses are present in the source tree; do not assume every route is intended for public production use.
- The codebase uses direct MongoDB collection access, so schema changes require coordinated updates across models, queries, and frontend response types.
- The frontend and backend use a mixture of `/api/...` and root-level paths. When adding an endpoint, follow the existing route group and its matching client service carefully.