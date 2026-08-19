ALTER TABLE "Anime" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'shikimori';
ALTER TABLE "Anime" ADD COLUMN IF NOT EXISTS "contentType" text NOT NULL DEFAULT 'anime';
ALTER TABLE "Anime" DROP CONSTRAINT IF EXISTS "Anime_shikimoriId_unique";
DROP INDEX IF EXISTS "Anime_shikimoriId_uq";
CREATE UNIQUE INDEX IF NOT EXISTS "Anime_source_ext_uq" ON "Anime" ("source", "shikimoriId");