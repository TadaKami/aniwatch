ALTER TABLE "WatchItem" ADD COLUMN IF NOT EXISTS "watchedEpisodes" integer NOT NULL DEFAULT 0;
UPDATE "WatchItem" w SET "watchedEpisodes" = COALESCE((
  SELECT count(*) FROM "EpisodeProgress" p WHERE p."watchItemId" = w.id
), 0);
DROP TABLE IF EXISTS "EpisodeProgress";