import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { anime as animeTable, episodeProgress, watchItems } from '../../db/schema.js';

export interface GenreStat {
  genre: string;
  count: number;
}

export async function getGenreStats(userId: string): Promise<GenreStat[]> {
  const rows = await db
    .select({ genres: animeTable.genres })
    .from(watchItems)
    .innerJoin(animeTable, eq(watchItems.animeId, animeTable.id))
    .where(and(eq(watchItems.userId, userId), eq(watchItems.status, 'WATCHED')));

  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const genre of row.genres ?? []) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
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
    .select({ status: watchItems.status, count: sql<number>`count(*)::int` })
    .from(watchItems)
    .where(eq(watchItems.userId, userId))
    .groupBy(watchItems.status);

  const [epRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(episodeProgress)
    .where(eq(episodeProgress.userId, userId));

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
      russian: animeTable.russian,
      name: animeTable.name,
      coverImage: animeTable.coverImage,
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

  let totalTitles = 0;
  let watchedTitles = 0;
  let watchingTitles = 0;
  for (const r of statusRows) {
    totalTitles += r.count;
    if (r.status === 'WATCHED') watchedTitles = r.count;
    if (r.status === 'WATCHING') watchingTitles = r.count;
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