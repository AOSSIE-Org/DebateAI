-- Initial D1 schema for DebateAI (Cloudflare edition).
-- Hand-written to match src/db/schema.ts so `wrangler d1 migrations apply` works
-- before you run `npm run db:generate`. Regenerate from schema.ts thereafter.

CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `display_name` text,
  `nickname` text,
  `bio` text DEFAULT '',
  `rating` real NOT NULL DEFAULT 1200,
  `rd` real NOT NULL DEFAULT 350,
  `volatility` real NOT NULL DEFAULT 0.06,
  `last_rating_update` text,
  `avatar_url` text,
  `twitter` text,
  `instagram` text,
  `linkedin` text,
  `password` text,
  `is_verified` integer NOT NULL DEFAULT 0,
  `verification_code` text,
  `reset_password_code` text,
  `score` integer NOT NULL DEFAULT 0,
  `badges` text DEFAULT '[]',
  `current_streak` integer NOT NULL DEFAULT 0,
  `last_activity_date` text,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);
CREATE UNIQUE INDEX `users_display_name_idx` ON `users` (`display_name`);
CREATE INDEX `users_rating_idx` ON `users` (`rating`);

CREATE TABLE `saved_debate_transcripts` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `topic` text,
  `result` text,
  `opponent` text,
  `debate_type` text,
  `data` text,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX `transcripts_user_idx` ON `saved_debate_transcripts` (`user_id`);
CREATE INDEX `transcripts_created_idx` ON `saved_debate_transcripts` (`created_at`);

CREATE TABLE `debates_vs_bot` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `user_id` text,
  `outcome` text,
  `created_at` integer NOT NULL,
  `data` text
);
CREATE INDEX `dvb_email_idx` ON `debates_vs_bot` (`email`);
CREATE INDEX `dvb_created_idx` ON `debates_vs_bot` (`created_at`);

CREATE TABLE `debates` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `topic` text,
  `result` text,
  `elo_change` real DEFAULT 0,
  `rating` real,
  `date` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX `debates_email_idx` ON `debates` (`email`);
CREATE INDEX `debates_date_idx` ON `debates` (`date`);

CREATE TABLE `team_debates` (
  `id` text PRIMARY KEY NOT NULL,
  `status` text,
  `format` text,
  `data` text,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  `updated_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX `team_debates_status_idx` ON `team_debates` (`status`);
CREATE INDEX `team_debates_created_idx` ON `team_debates` (`created_at`);

CREATE TABLE `posts` (
  `id` text PRIMARY KEY NOT NULL,
  `author_id` text NOT NULL,
  `content` text NOT NULL,
  `like_count` integer NOT NULL DEFAULT 0,
  `data` text,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX `posts_author_idx` ON `posts` (`author_id`);
CREATE INDEX `posts_created_idx` ON `posts` (`created_at`);
CREATE INDEX `posts_likes_idx` ON `posts` (`like_count`);

CREATE TABLE `comments` (
  `id` text PRIMARY KEY NOT NULL,
  `author_id` text NOT NULL,
  `post_id` text,
  `transcript_id` text,
  `content` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX `comments_post_idx` ON `comments` (`post_id`);
CREATE INDEX `comments_transcript_idx` ON `comments` (`transcript_id`);

CREATE TABLE `likes` (
  `id` text PRIMARY KEY NOT NULL,
  `post_id` text NOT NULL,
  `user_id` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX `likes_post_user_idx` ON `likes` (`post_id`,`user_id`);

CREATE TABLE `follows` (
  `id` text PRIMARY KEY NOT NULL,
  `follower_id` text NOT NULL,
  `followee_id` text NOT NULL,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX `follows_pair_idx` ON `follows` (`follower_id`,`followee_id`);
CREATE INDEX `follows_followee_idx` ON `follows` (`followee_id`);

CREATE TABLE `notifications` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `type` text,
  `message` text,
  `is_read` integer NOT NULL DEFAULT 0,
  `data` text,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);

CREATE TABLE `rooms` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `owner_id` text NOT NULL,
  `topic` text,
  `is_private` integer NOT NULL DEFAULT 0,
  `participants` text DEFAULT '[]',
  `data` text,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX `rooms_owner_idx` ON `rooms` (`owner_id`);

CREATE TABLE `teams` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `owner_id` text NOT NULL,
  `members` text DEFAULT '[]',
  `data` text,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE `ratings_history` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `opponent_id` text,
  `outcome` text,
  `topic` text,
  `rating_before` real,
  `rating_after` real,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX `ratings_history_user_idx` ON `ratings_history` (`user_id`);

CREATE TABLE `admin_action_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `admin_id` text NOT NULL,
  `action` text NOT NULL,
  `target_type` text,
  `target_id` text,
  `data` text,
  `created_at` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE `role_grants` (
  `id` text PRIMARY KEY NOT NULL,
  `role` text NOT NULL,
  `resource` text NOT NULL,
  `action` text NOT NULL
);
CREATE UNIQUE INDEX `role_grants_idx` ON `role_grants` (`role`,`resource`,`action`);

CREATE TABLE `user_roles` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `role` text NOT NULL
);
CREATE UNIQUE INDEX `user_roles_idx` ON `user_roles` (`user_id`,`role`);

-- RBAC seed (was rbac_model.conf + Casbin policy rows)
INSERT INTO `role_grants` (`id`,`role`,`resource`,`action`) VALUES
  ('seed-admin-debate-delete',   'admin',     'debate',  'delete'),
  ('seed-admin-comment-delete',  'admin',     'comment', 'delete'),
  ('seed-mod-comment-delete',    'moderator', 'comment', 'delete');
