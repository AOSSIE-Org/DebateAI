export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 720 }}>
      <h1>DebateAI — Cloudflare edition</h1>
      <p>
        Next.js on Workers · D1 (was MongoDB) · KV (was Redis) · Durable Objects
        (live debates). This app can host the existing React frontend or be
        consumed as an API by it.
      </p>
      <p>
        Ported reference endpoints: <code>/signup</code>, <code>/login</code>,{" "}
        <code>/verifyEmail</code>, <code>/googleLogin</code>,{" "}
        <code>/forgotPassword</code>, <code>/confirmForgotPassword</code>,{" "}
        <code>/verifyToken</code>, <code>/user/fetchprofile</code>,{" "}
        <code>/user/updateprofile</code>, <code>/user/check-displayname</code>,{" "}
        <code>/leaderboard</code>, <code>/debug/matchmaking-pool</code>.
      </p>
      <p>
        See <code>GET /api/_status</code> for the full migration map, and{" "}
        <code>docs/CLOUDFLARE-MIGRATION.md</code> for the porting guide.
      </p>
    </main>
  );
}
