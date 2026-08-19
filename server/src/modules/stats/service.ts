import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { anime as animeTable, watchItems } from '../../db/schema.js';
import { getRelated, getSimilarByGenres, type RelatedAnime } from '../anime/service.js';
import { getTmdbRelated, getTmdbSequels } from '../tmdb/service.js';

export interface GenreStat {
  genre: string;
  count: number;
}

// Сезоны/фильмы одной франшизы считаем за один тайтл (эвристика по имени)
function franchiseKey(rawName: string): string {
  const clean = rawName
    .replace(/\s*(\d+(st|nd|rd|th)?\s*Season|Season\s*\d+|Movie|The\s*Movie|Part\s*\d+|Film\s*\d+)\s*$/i, '')
    .replace(/\s*\d+$/, '')
    .trim();
  const base = clean.includes(':') ? clean.split(':')[0].trim() : clean;
  return base.toLowerCase().replace(/[^\p{L}\p{N}]+$/gu, '');
}

export async function getGenreStats(userId: string): Promise<GenreStat[]> {
  const rows = await db
    .select({ genres: animeTable.genres, name: animeTable.name })
    .from(watchItems)
    .innerJoin(animeTable, eq(watchItems.animeId, animeTable.id))
    .where(and(eq(watchItems.userId, userId), inArray(watchItems.status, ['WATCHED', 'WATCHING'])));

  const groups = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = franchiseKey(row.name);
    const set = groups.get(key) ?? new Set<string>();
    for (const genre of row.genres ?? []) set.add(genre);
    groups.set(key, set);
  }

  const counts = new Map<string, number>();
  for (const genres of groups.values()) {
    for (const genre of genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
}

// ========== Обзор профиля ==========

export interface StatsOverview {
  totals: {
    totalTitles: number;
    watchedTitles: number;
    watchingTitles: number;
    episodesWatched: number;
  };
  watching: {
    itemId: string;
    shikimoriId: number;
    source: 'shikimori' | 'tmdb';
    contentType: 'anime' | 'tv' | 'movie';
    russian: string | null;
    name: string;
    coverImage: string | null;
    watched: number;
    aired: number;
  }[];
}

export async function getOverview(userId: string): Promise<StatsOverview> {
  const statusRows = await db
    .select({ status: watchItems.status, name: animeTable.name })
    .from(watchItems)
    .innerJoin(animeTable, eq(watchItems.animeId, animeTable.id))
    .where(eq(watchItems.userId, userId));

  const [epRow] = await db
    .select({ total: sql<number>`coalesce(sum(${watchItems.watchedEpisodes}), 0)::int` })
    .from(watchItems)
    .where(eq(watchItems.userId, userId));

  const watchingRows = await db
    .select({
      id: watchItems.id,
      shikimoriId: animeTable.shikimoriId,
      source: animeTable.source,
      contentType: animeTable.contentType,
      russian: animeTable.russian,
      name: animeTable.name,
      coverImage: animeTable.coverImage,
      watchedEpisodes: watchItems.watchedEpisodes,
      aired: animeTable.episodesAired,
      episodes: animeTable.episodes,
    })
    .from(watchItems)
    .innerJoin(animeTable, eq(watchItems.animeId, animeTable.id))
    .where(and(eq(watchItems.userId, userId), eq(watchItems.status, 'WATCHING')))
    .orderBy(desc(watchItems.updatedAt))
    .limit(6);

  const groupStatuses = new Map<string, Set<string>>();
  for (const r of statusRows) {
    const key = franchiseKey(r.name);
    const set = groupStatuses.get(key) ?? new Set<string>();
    set.add(r.status);
    groupStatuses.set(key, set);
  }
  const totalTitles = groupStatuses.size;
  let watchedTitles = 0;
  let watchingTitles = 0;
  for (const s of groupStatuses.values()) {
    if (s.has('WATCHED')) watchedTitles++;
    if (s.has('WATCHING')) watchingTitles++;
  }

  return {
    totals: {
      totalTitles,
      watchedTitles,
      watchingTitles,
      episodesWatched: epRow?.total ?? 0,
    },
    watching: watchingRows.map((w) => ({
      itemId: w.id,
      shikimoriId: w.shikimoriId,
      source: w.source,
      contentType: w.contentType,
      russian: w.russian,
      name: w.name,
      coverImage: w.coverImage,
      watched: w.watchedEpisodes,
      aired: w.aired || w.episodes || 0,
    })),
  };
}

// ========== «Что дальше»: продолжения + похожие ==========

export interface NextItem extends RelatedAnime {
  sourceTitle: string;
  inListStatus: string | null;
  source: 'shikimori' | 'tmdb';
  contentType: 'anime' | 'tv' | 'movie';
  relation: 'sequel' | 'similar';
}

const nextCache = new Map<string, { data: NextItem[]; fetchedAt: number }>();
const NEXT_TTL_MS = 5 * 60 * 1000;

export async function getNext(userId: string): Promise<NextItem[]> {
  const cached = nextCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < NEXT_TTL_MS) return cached.data;

  const watchedRows = await db
    .select({
      shikimoriId: animeTable.shikimoriId,
      russian: animeTable.russian,
      name: animeTable.name,
      source: animeTable.source,
      contentType: animeTable.contentType,
    })
    .from(watchItems)
    .innerJoin(animeTable, eq(watchItems.animeId, animeTable.id))
    .where(and(eq(watchItems.userId, userId), inArray(watchItems.status, ['WATCHED', 'WATCHING'])))
    .orderBy(desc(watchItems.updatedAt))
    .limit(20);

  const listRows = await db
    .select({ shikimoriId: animeTable.shikimoriId, status: watchItems.status, source: animeTable.source })
    .from(watchItems)
    .innerJoin(animeTable, eq(watchItems.animeId, animeTable.id))
    .where(eq(watchItems.userId, userId));
  const statusByKey = new Map(listRows.map((r) => [`${r.source}:${r.shikimoriId}`, r.status]));

  const out: NextItem[] = [];
  const seen = new Set<string>();

  for (const w of watchedRows) {
    const isTmdb = w.source === 'tmdb';
    const rSource = isTmdb ? 'tmdb' : 'shikimori';
    const rType = isTmdb ? (w.contentType === 'movie' ? 'movie' : 'tv') : 'anime';
    const skey = (id: number) => `${rSource}:${id}`;

    // 1) Настоящие продолжения
    let related: RelatedAnime[] = [];
    try {
      related = isTmdb
        ? await getTmdbSequels(rType, w.shikimoriId)
        : await getRelated(w.shikimoriId, [w.name, w.russian]);
    } catch { continue; }
    for (const r of related) {
      if (r.id === w.shikimoriId || seen.has(skey(r.id))) continue;
      const inList = statusByKey.get(skey(r.id)) ?? null;
      if (inList) continue;
      seen.add(skey(r.id));
      out.push({ ...r, sourceTitle: w.russian ?? w.name, inListStatus: inList, source: rSource, contentType: rType, relation: 'sequel' });
    }

    // 2) Похожие по жанрам — отдельной секцией и с подписью
    try {
      const similar: RelatedAnime[] = isTmdb
        ? (await getTmdbRelated(rType, w.shikimoriId)).map((m) => ({
            id: m.id, name: m.name, russian: m.russian, kind: m.kind,
            status: m.status, airedOn: m.airedOn, image: m.image,
          }))
        : await getSimilarByGenres(w.shikimoriId, userId, 4);
      for (const r of similar) {
        if (r.id === w.shikimoriId || seen.has(skey(r.id))) continue;
        const inList = statusByKey.get(skey(r.id)) ?? null;
        if (inList) continue;
        seen.add(skey(r.id));
        out.push({ ...r, sourceTitle: w.russian ?? w.name, inListStatus: inList, source: rSource, contentType: rType, relation: 'similar' });
      }
    } catch { /* пропускаем */ }
  }

  const rank = (s: string | null) => (s === 'ongoing' ? 0 : s === 'anons' ? 1 : 2);
  const byRank = (a: NextItem, b: NextItem) =>
    rank(a.status) - rank(b.status) || (b.airedOn ?? '').localeCompare(a.airedOn ?? '');
  const data = [
    ...out.filter((o) => o.relation === 'sequel').sort(byRank),
    ...out.filter((o) => o.relation === 'similar').sort(byRank),
  ];

  nextCache.set(userId, { data, fetchedAt: Date.now() });
  return data;
}