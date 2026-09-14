import { and, count, desc, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  debates,
  debatesVsBot,
  savedDebateTranscripts,
  teamDebates,
  users,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { DEFAULT_AVATAR, nameFromEmail } from "@/lib/users";
import { ok, serverError } from "@/lib/http";

// GET /leaderboard  — port of controllers.GetLeaderboard
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  const db = getDb();
  try {
    const rows = await db.select().from(users).orderBy(desc(users.rating));

    const debaters = rows.map((u, i) => {
      const name = u.displayName || nameFromEmail(u.email);
      return {
        id: u.id,
        rank: i + 1,
        name,
        score: u.score,
        rating: Math.trunc(u.rating),
        avatarUrl: u.avatarUrl || DEFAULT_AVATAR(name),
        currentUser: u.email === auth.email,
      };
    });

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const startIso = dayStart.toISOString();
    const endIso = new Date(dayStart.getTime() + 86_400_000).toISOString();
    const startUnix = Math.floor(dayStart.getTime() / 1000);
    const endUnix = startUnix + 86_400;

    const [[tCount], [tdCount], [dCount], [botCount], [activeTeam]] = await Promise.all([
      db
        .select({ n: count() })
        .from(savedDebateTranscripts)
        .where(
          and(
            gte(savedDebateTranscripts.createdAt, startIso),
            lt(savedDebateTranscripts.createdAt, endIso),
          ),
        ),
      db
        .select({ n: count() })
        .from(teamDebates)
        .where(and(gte(teamDebates.createdAt, startIso), lt(teamDebates.createdAt, endIso))),
      db
        .select({ n: count() })
        .from(debates)
        .where(and(gte(debates.date, startIso), lt(debates.date, endIso))),
      db
        .select({ n: count() })
        .from(debatesVsBot)
        .where(
          and(
            gte(debatesVsBot.createdAt, startUnix),
            lt(debatesVsBot.createdAt, endUnix),
          ),
        ),
      db
        .select({ n: count() })
        .from(teamDebates)
        .where(sql`${teamDebates.status} = 'active'`),
    ]);

    const debatesToday =
      (tCount?.n ?? 0) + (tdCount?.n ?? 0) + (dCount?.n ?? 0) + (botCount?.n ?? 0);
    const debatingNow = activeTeam?.n ?? 0;

    const [experts] = await db
      .select({ n: count() })
      .from(users)
      .where(
        and(
          gte(users.rating, 1500),
          gte(users.updatedAt, new Date(Date.now() - 30 * 60_000).toISOString()),
        ),
      );

    const stats = [
      { icon: "crown", value: String(rows.length), label: "REGISTERED DEBATERS" },
      { icon: "chessQueen", value: String(debatesToday), label: "DEBATES TODAY" },
      { icon: "medal", value: String(debatingNow), label: "DEBATING NOW" },
      { icon: "crown", value: String(experts?.n ?? 0), label: "EXPERTS ONLINE" },
    ];

    return ok({ debaters, stats });
  } catch (e) {
    return serverError("Failed to fetch leaderboard data", { message: String(e) });
  }
}
