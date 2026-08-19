import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { anime as animeTable, episodeProgress, watchItems } from '../../db/schema.js';
import { HttpError } from '../../lib/http.js';
import { shikimoriGet, type ShikimoriAnimeDetails } from '../anime/shikimori.js';

const STATUSES = ['WANT_TO_WATCH', 'WATCHING', 'WATCHED', 'DROPPED'] as const;

const addSchema = z.object({
  shikimoriId: z.number().int().positive(),
  name: z.string().min(1),
  russian: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  kind: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  episodes: z.number().int().nullable().optional(),
  episodesAired: z.number().int().nullable().optional(),
  season: z.string().nullable().optional(),
  seasonYear: z.number().int().nullable().optional(),
  genres: z.array(z.string()).optional(),
  description: z.string().nullable().optional(),
  studios: z.string().nullable().optional(),
  status: z.enum(STATUSES).default('WANT_TO_WATCH'),
  source: z.enum(['shikimori', 'tmdb']).default('shikimori'),
  contentType: z.enum(['anime', 'tv', 'movie']).default('anime'),
});

const statusSchema = z.object({status: z.enum(STATUSES)});

const progressSchema = z.object({
  watchItemId: z.string().uuid(),
  seasonNumber: z.number().int().min(1).default(1),
  episodeNumber: z.number().int().min(1),
});

function isUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

// ========== GET /watchlist ==========
export async function listWatchlist(userId: string) {
  return db
    .select({
      id: watchItems.id,
      status: watchItems.status,
      note: watchItems.note,
      createdAt: watchItems.createdAt,
      updatedAt: watchItems.updatedAt,
      anime: {
        id: animeTable.id,
        shikimoriId: animeTable.shikimoriId,
        source: animeTable.source,
        contentType: animeTable.contentType,
        name: animeTable.name,
        russian: animeTable.russian,
        coverImage: animeTable.coverImage,
        kind: animeTable.kind,
        score: animeTable.score,
        episodes: animeTable.episodes,
        episodesAired: animeTable.episodesAired,
        season: animeTable.season,
        seasonYear: animeTable.seasonYear,
        genres: animeTable.genres,
      },
    })
    .from(watchItems)
    .innerJoin(animeTable, eq(watchItems.animeId, animeTable.id))
    .where(eq(watchItems.userId, userId))
    .orderBy(desc(watchItems.updatedAt));
}

// ========== POST /watchlist (upsert Anime + create WatchItem, 409 при дубле) ==========
export async function addToWatchlist(userId: string, input: unknown) {
    const parsed = addSchema.safeParse(input);
    if(!parsed.success) throw new HttpError(400,  parsed.error.issues[0]?.message ?? 'Validation error');
    const p = parsed.data;
    // Список поиска Shikimori не отдаёт жанры — берём из деталей тайтла
    let genres = p.genres ?? [];
    if (genres.length === 0) {
        try {
            const d = await shikimoriGet<ShikimoriAnimeDetails>(`/animes/${p.shikimoriId}`);
            genres = (d.genres ?? []).map((g) => g.russian || g.name);
        } catch { /* останутся пустыми — не блокируем добавление */ }
    }    

    const animeValues = {
        name: p.name,
        source: p.source,
        contentType: p.contentType,
        russian: p.russian ?? null,
        coverImage: p.coverImage ?? null,
        kind: p.kind ?? null,
        score: p.score ?? null,
        episodes: p.episodes ?? null,
        episodesAired: p.episodesAired ?? null,
        season: p.season ?? null,
        seasonYear: p.seasonYear ?? null,
        genres,
        description: p.description ?? null,
        studios: p.studios ?? null,
    };

    const [animeRow] = await db
        .insert(animeTable)
        .values({shikimoriId: p.shikimoriId, ...animeValues})
        .onConflictDoUpdate({
            target: [animeTable.source, animeTable.shikimoriId],
            set: {...animeValues, updatedAt: new Date()},
        })
        .returning();

    try{
        const [item] = await db
            .insert(watchItems)
            .values({userId, animeId: animeRow.id, status: p.status})
            .returning();
        return {...item, anime: animeRow};
    }catch(err){
        if (isUniqueViolation(err)) throw new HttpError(409, 'This title is already in your list');
        throw err;
    }
}

// ========== PATCH /watchlist/:id (владелец) ==========

export async function updateWatchItem(userId: string, itemId: string, input: unknown) {
    const parsed = statusSchema.safeParse(input);
    if (!parsed.success) throw new HttpError(400, 'Invalid status');
    const [updated] = await db
        .update(watchItems)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(and(eq(watchItems.id, itemId), eq(watchItems.userId, userId)))
        .returning();
    if (!updated) throw new HttpError(404, 'Watch item not found');
    return updated;
}

// ========== DELETE /watchlist/:id (владелец) ==========
export async function removeWatchItem(userId: string, itemId: string) {
    const [deleted] = await db
        .delete(watchItems)
        .where(and(eq(watchItems.id, itemId), eq(watchItems.userId, userId)))
        .returning();
    if (!deleted) throw new HttpError(404, 'Watch item not found');
    return { ok: true };
}

// ========== POST /watchlist/progress (идемпотентно) ==========
export async function addProgress(userId: string, input: unknown) {
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Validation error');
  const p = parsed.data;

  const [item] = await db
    .select({ id: watchItems.id })
    .from(watchItems)
    .where(and(eq(watchItems.id, p.watchItemId), eq(watchItems.userId, userId)))
    .limit(1);
  if (!item) throw new HttpError(404, 'Watch item not found');

  const [created] = await db
    .insert(episodeProgress)
    .values({
      userId,
      watchItemId: p.watchItemId,
      seasonNumber: p.seasonNumber,
      episodeNumber: p.episodeNumber,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    // двигаем список в топ сортировки по updatedAt
    await db.update(watchItems).set({ updatedAt: new Date() }).where(eq(watchItems.id, p.watchItemId));
  }
  return { ok: true, created: Boolean(created) };
}

// ========== DELETE /watchlist/progress ==========
export async function removeProgress(userId: string, input: unknown) {
  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Validation error');
  const p = parsed.data;

  const deleted = await db
    .delete(episodeProgress)
    .where(
      and(
        eq(episodeProgress.userId, userId),
        eq(episodeProgress.watchItemId, p.watchItemId),
        eq(episodeProgress.seasonNumber, p.seasonNumber),
        eq(episodeProgress.episodeNumber, p.episodeNumber)
      )
    )
    .returning();
  if (deleted.length === 0) throw new HttpError(404, 'Progress not found');
  return { ok: true };
}