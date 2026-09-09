ALTER TABLE "WatchItem" ADD COLUMN IF NOT EXISTS rating integer;

CREATE TABLE IF NOT EXISTS "UserTop" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  "contentType" text NOT NULL DEFAULT 'any',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "UserTopItem" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "topId" uuid NOT NULL REFERENCES "UserTop"(id) ON DELETE CASCADE,
  "animeId" uuid NOT NULL REFERENCES "Anime"(id) ON DELETE CASCADE,
  position integer NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("topId", "animeId")
);