-- 1) episodeId больше не обязателен: код v2 не использует таблицу Episode
ALTER TABLE "EpisodeProgress" ALTER COLUMN "episodeId" DROP NOT NULL;

-- 2) Чистим дубли, которых в v1 не мешало ничего (оставляем свежие по updatedAt)
DELETE FROM "WatchItem"
WHERE ctid NOT IN (
  SELECT DISTINCT ON ("userId", "animeId") ctid
  FROM "WatchItem"
  ORDER BY "userId", "animeId", "updatedAt" DESC
);

DELETE FROM "EpisodeProgress"
WHERE ctid NOT IN (
  SELECT DISTINCT ON ("userId", "watchItemId", "seasonNumber", "episodeNumber") ctid
  FROM "EpisodeProgress"
  ORDER BY "userId", "watchItemId", "seasonNumber", "episodeNumber", "watchedAt" DESC
);

-- 3) Добавляем ограничения, которых не было в v1
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_uq"          ON "User" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Anime_shikimoriId_uq"  ON "Anime" ("shikimoriId");
CREATE UNIQUE INDEX IF NOT EXISTS "WatchItem_user_anime_uq" ON "WatchItem" ("userId", "animeId");
CREATE UNIQUE INDEX IF NOT EXISTS "EpisodeProgress_uq"
  ON "EpisodeProgress" ("userId", "watchItemId", "seasonNumber", "episodeNumber");