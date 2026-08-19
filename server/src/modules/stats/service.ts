import { and, desc, eq, sql, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { anime as animeTable, episodeProgress, watchItems } from '../../db/schema.js';
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
    for (const genre of genres) {counts.set(genre, (counts.get(genre) ?? 0) + 1);    }
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
  activity: { weekStart: string; count: number }[];
  watching: {
    shikimoriId: number;
    russian: string | null;
    name: string;
    coverImage: string | null;
    watched: number;
    aired: number;
  }[];
}

function startOfWeekMs(d: Date): number {
  const x = new Date(d);
  const day = (x.getUTCDay() + 6) % 7; // понедельник = 0
  x.setUTCHours(0, 0, 0, 0);
  return x.getTime() - day * 24 * 3600 * 1000;
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

  const progressRows = await db
    .select({ watchItemId: episodeProgress.watchItemId, count: sql<number>`count(*)::int` })
    .from(episodeProgress)
    .where(eq(episodeProgress.userId, userId))
    .groupBy(episodeProgress.watchItemId);
  const progressByItem = new Map(progressRows.map((r) => [r.watchItemId, r.count]));

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

  // активность: 12 недель
  const WEEK_MS = 7 * 24 * 3600 * 1000;
  const thisWeek = startOfWeekMs(new Date());
  const since = new Date(thisWeek - 11 * WEEK_MS);
  const marks = await db
    .select({ watchedAt: episodeProgress.watchedAt })
    .from(episodeProgress)
    .where(and(eq(episodeProgress.userId, userId), sql`${episodeProgress.watchedAt} >= ${since}`));

  const buckets = new Map<number, number>();
  for (const m of marks) {
    const idx = 11 - Math.floor((thisWeek - startOfWeekMs(m.watchedAt)) / WEEK_MS);
    if (idx >= 0 && idx <= 11) buckets.set(idx, (buckets.get(idx) ?? 0) + 1);
  }
  const activity = Array.from({ length: 12 }, (_, i) => ({
    weekStart: new Date(thisWeek - (11 - i) * WEEK_MS).toISOString().slice(0, 10),
    count: buckets.get(i) ?? 0,
  }));

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
      episodesWatched: epRow?.count ?? 0,
    },
    activity,
    watching: watchingRows.map((w) => ({
      shikimoriId: w.shikimoriId,
      russian: w.russian,
      name: w.name,
      coverImage: w.coverImage,
      watched: progressByItem.get(w.id) ?? 0,
      aired: w.aired || w.episodes || 0,
    })),
  };
}

// ========== «Что дальше»: непросмотренные сиквелы/онгоинги ==========

export interface NextItem extends RelatedAnime {
  sourceTitle: string;
  inListStatus: string | null;
  source: 'shikimori' | 'tmdb';
  contentType: 'anime' | 'tv' | 'movie';
  relation: 'sequel' | 'similar';
}

const nextCache = new Map<string, { data: NextItem[]; fetchedAt: number }>();
const NEXT_TTL_MS = 5 * 60 * 1000;
let genreIdMapCache: Map<string, number> | null = null;
async function genreIdMap(): Promise<Map<string, number>> {
  if (genreIdMapCache) return genreIdMapCache;
  const list = await getGenres();
  const m = new Map<string, number>();
  for (const g of list) {
    m.set(g.name.toLowerCase(), g.id);
    if (g.russian) m.set(g.russian.toLowerCase(), g.id);
  }
  genreIdMapCache = m;
  return m;
}

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