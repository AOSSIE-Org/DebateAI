/**
 * D1 (SQLite) schema — the relational replacement for the Go backend's MongoDB.
 *
 * Strategy ("D1 + JSON columns"): columns that are filtered, sorted, joined, or
 * counted on get real typed columns and indexes. Nested / loosely-structured
 * sub-documents (debate turn arrays, AI evaluation blobs, per-format settings,
 * team rosters, etc.) live in a single `data` TEXT column holding JSON, queried
 * with `json_extract()` on the rare occasions that's needed.
 *
 * IDs: Mongo ObjectIDs become 24-char lowercase-hex strings (see lib/ids.ts
 * `newId()`), so any hex ObjectID exported from Mongo migrates unchanged.
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/** ISO-8601 string timestamp column with a default of "now". */
const ts = (name: string) =>
  text(name).notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

/** JSON blob column. Read/write via JSON.parse/stringify in the repo layer. */
const json = (name: string) => text(name, { mode: "json" });

// ---------------------------------------------------------------------------
// users  (Mongo: "users")
// ---------------------------------------------------------------------------
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    nickname: text("nickname"),
    bio: text("bio").default(""),

    // Glicko-2 / rating fields — queried and sorted on the leaderboard.
    rating: real("rating").notNull().default(1200),
    rd: real("rd").notNull().default(350),
    volatility: real("volatility").notNull().default(0.06),
    lastRatingUpdate: text("last_rating_update"),

    avatarUrl: text("avatar_url"),
    twitter: text("twitter"),
    instagram: text("instagram"),
    linkedin: text("linkedin"),

    password: text("password"), // bcrypt hash (nullable for Google-only accounts)
    isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
    verificationCode: text("verification_code"),
    resetPasswordCode: text("reset_password_code"),

    score: integer("score").notNull().default(0),
    badges: json("badges").$type<string[]>().default(sql`'[]'`),
    currentStreak: integer("current_streak").notNull().default(0),
    lastActivityDate: text("last_activity_date"),

    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    displayNameIdx: uniqueIndex("users_display_name_idx").on(t.displayName),
    ratingIdx: index("users_rating_idx").on(t.rating),
  }),
);

// ---------------------------------------------------------------------------
// saved_debate_transcripts  (Mongo: "saved_debate_transcripts")
// ---------------------------------------------------------------------------
export const savedDebateTranscripts = sqliteTable(
  "saved_debate_transcripts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    topic: text("topic"),
    result: text("result"), // win | loss | draw | pending
    opponent: text("opponent"),
    debateType: text("debate_type"),
    // full turn-by-turn transcript, scores, AI feedback
    data: json("data"),
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => ({
    userIdx: index("transcripts_user_idx").on(t.userId),
    createdIdx: index("transcripts_created_idx").on(t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// debates_vs_bot  (Mongo: "debates_vs_bot")
// ---------------------------------------------------------------------------
export const debatesVsBot = sqliteTable(
  "debates_vs_bot",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    userId: text("user_id"),
    outcome: text("outcome"),
    createdAt: integer("created_at").notNull(), // unix seconds, matches Go int64
    data: json("data"),
  },
  (t) => ({
    emailIdx: index("dvb_email_idx").on(t.email),
    createdIdx: index("dvb_created_idx").on(t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// debates  (Mongo: "debates" — lightweight elo-history rows)
// ---------------------------------------------------------------------------
export const debates = sqliteTable(
  "debates",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    topic: text("topic"),
    result: text("result"),
    eloChange: real("elo_change").default(0),
    rating: real("rating"),
    date: ts("date"),
  },
  (t) => ({
    emailIdx: index("debates_email_idx").on(t.email),
    dateIdx: index("debates_date_idx").on(t.date),
  }),
);

// ---------------------------------------------------------------------------
// team_debates  (Mongo: "team_debates")
// ---------------------------------------------------------------------------
export const teamDebates = sqliteTable(
  "team_debates",
  {
    id: text("id").primaryKey(),
    status: text("status"), // active | completed | ...
    format: text("format"),
    data: json("data"), // rosters, turn order, per-side scores
    createdAt: ts("created_at"),
    updatedAt: ts("updated_at"),
  },
  (t) => ({
    statusIdx: index("team_debates_status_idx").on(t.status),
    createdIdx: index("team_debates_created_idx").on(t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// Community: posts / comments / likes / follows
// ---------------------------------------------------------------------------
export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id").notNull(),
    content: text("content").notNull(),
    likeCount: integer("like_count").notNull().default(0),
    data: json("data"),
    createdAt: ts("created_at"),
  },
  (t) => ({
    authorIdx: index("posts_author_idx").on(t.authorId),
    createdIdx: index("posts_created_idx").on(t.createdAt),
    likesIdx: index("posts_likes_idx").on(t.likeCount),
  }),
);

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id").notNull(),
    // a comment targets either a post or a transcript (mirrors the Go routes)
    postId: text("post_id"),
    transcriptId: text("transcript_id"),
    content: text("content").notNull(),
    createdAt: ts("created_at"),
  },
  (t) => ({
    postIdx: index("comments_post_idx").on(t.postId),
    transcriptIdx: index("comments_transcript_idx").on(t.transcriptId),
  }),
);

export const likes = sqliteTable(
  "likes",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: ts("created_at"),
  },
  (t) => ({
    uniq: uniqueIndex("likes_post_user_idx").on(t.postId, t.userId),
  }),
);

export const follows = sqliteTable(
  "follows",
  {
    id: text("id").primaryKey(),
    followerId: text("follower_id").notNull(),
    followeeId: text("followee_id").notNull(),
    createdAt: ts("created_at"),
  },
  (t) => ({
    uniq: uniqueIndex("follows_pair_idx").on(t.followerId, t.followeeId),
    followeeIdx: index("follows_followee_idx").on(t.followeeId),
  }),
);

// ---------------------------------------------------------------------------
// notifications  (Mongo: "notifications")
// ---------------------------------------------------------------------------
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type"),
    message: text("message"),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    data: json("data"),
    createdAt: ts("created_at"),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
  }),
);

// ---------------------------------------------------------------------------
// rooms  (Mongo: "rooms" — custom debate rooms)
// ---------------------------------------------------------------------------
export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id").notNull(),
    topic: text("topic"),
    isPrivate: integer("is_private", { mode: "boolean" }).notNull().default(false),
    participants: json("participants").$type<string[]>().default(sql`'[]'`),
    data: json("data"),
    createdAt: ts("created_at"),
  },
  (t) => ({ ownerIdx: index("rooms_owner_idx").on(t.ownerId) }),
);

// ---------------------------------------------------------------------------
// teams  (Mongo: "teams")
// ---------------------------------------------------------------------------
export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  members: json("members").$type<string[]>().default(sql`'[]'`),
  data: json("data"),
  createdAt: ts("created_at"),
});

// ---------------------------------------------------------------------------
// ratings_history  (rating-service audit rows)
// ---------------------------------------------------------------------------
export const ratingsHistory = sqliteTable(
  "ratings_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    opponentId: text("opponent_id"),
    outcome: text("outcome"),
    topic: text("topic"),
    ratingBefore: real("rating_before"),
    ratingAfter: real("rating_after"),
    createdAt: ts("created_at"),
  },
  (t) => ({ userIdx: index("ratings_history_user_idx").on(t.userId) }),
);

// ---------------------------------------------------------------------------
// admin_action_logs  (Mongo: "admin_action_logs")
// ---------------------------------------------------------------------------
export const adminActionLogs = sqliteTable("admin_action_logs", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  data: json("data"),
  createdAt: ts("created_at"),
});

// ---------------------------------------------------------------------------
// permissions  (replaces Casbin + casbin/mongodb-adapter)
// The Go app used an RBAC model `sub, obj, act`. That collapses to a flat
// grant table plus a role column on membership; check with a single SELECT.
// ---------------------------------------------------------------------------
export const roleGrants = sqliteTable(
  "role_grants",
  {
    id: text("id").primaryKey(),
    role: text("role").notNull(), // admin | moderator | user
    resource: text("resource").notNull(), // debate | comment | ...
    action: text("action").notNull(), // delete | update | ...
  },
  (t) => ({
    uniq: uniqueIndex("role_grants_idx").on(t.role, t.resource, t.action),
  }),
);

export const userRoles = sqliteTable(
  "user_roles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
  },
  (t) => ({ uniq: uniqueIndex("user_roles_idx").on(t.userId, t.role) }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
