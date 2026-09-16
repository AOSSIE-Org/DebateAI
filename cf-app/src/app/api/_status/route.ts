import { ok } from "@/lib/http";

/**
 * GET /api/_status — living TODO map for the port. Each Go route group and its
 * Cloudflare status. "ported" = done in this scaffold, "stub" = handler exists
 * but returns 501, "todo" = not yet created.
 */
export async function GET() {
  return ok({
    datastore: { mongo: "→ D1 (drizzle, src/db/schema.ts)", redis: "→ KV (src/lib/kv.ts)" },
    realtime: "→ Durable Object DebateRoom + cron sweep",
    domains: {
      auth: "ported", // /signup /login /verifyEmail /googleLogin /forgotPassword /confirmForgotPassword /verifyToken
      profile: "ported", // /user/fetchprofile /user/updateprofile /user/check-displayname
      leaderboard: "ported", // /leaderboard
      matchmaking: "partial", // HTTP heartbeat + cron sweep done; UI wiring TODO
      "debate-vs-bot": "todo", // routes/debatevsbot.go  -> Gemini via src/lib/gemini.ts
      coach: "todo", // routes/coach.go               -> Gemini
      "debate (live user-vs-user)": "partial", // DebateRoom DO skeleton; results/transcript persistence TODO
      transcripts: "todo", // routes/transcriptroutes.go
      community: "todo", // routes/community.go (posts/comments/likes/follows)
      gamification: "todo", // routes/gamification.go + /ws/gamification
      notifications: "todo", // routes/notification.go
      rooms: "todo", // routes/rooms.go
      team: "todo", // routes/team.go + /ws/team
      admin: "todo", // routes/admin.go + Casbin -> role_grants/user_roles tables
      "python transcription": "external", // transcribeService.py -> Workers AI Whisper or a separate service
    },
  });
}
