import { z } from 'zod';
import { HttpError } from '../../lib/http.js';
import type { NormalizedAnime } from '../anime/normalize.js';
import { tmdbGet, tmdbImage } from './tmdb.js';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { anime as animeTable, episodeProgress, watchItems } from '../../db/schema.js';

const GENRES_TTL_MS = 24 * 60 * 60 * 1000;
const genreCache = new Map<string, { data: { id: number; name: string }[]; fetchedAt: number }>();

export async function getTmdbGenres(type: 'tv' | 'movie') {
  const c = genreCache.get(type);
  if (c && Date.now() - c.fetchedAt < GENRES_TTL_MS) return c.data;
  const res = await tmdbGet<{ genres: { id: number; name: string }[] }>(`/genre/${type}/list`);
  genreCache.set(type, { data: res.genres, fetchedAt: Date.now() });
  return res.genres;
}

interface TmdbItem {
  id: number;
  name?: string; title?: string;
  original_name?: string; original_title?: string;
  overview?: string | null;
  poster_path?: string | null;
  vote_average?: number;
  genre_ids?: number[];
  first_air_date?: string | null;
  release_date?: string | null;
}
interface TmdbDetails extends TmdbItem {
  genres?: { id: number; name: string }[];
  number_of_episodes?: number;
  status?: string;
  networks?: { name: string }[];
  production_companies?: { name: string }[];
}
interface TmdbList { page: number; total_pages: number; total_results: number; results: TmdbItem[]; }

function mapStatus(type: 'tv' | 'movie', status?: string): string {
  if (type === 'movie') return status === 'Released' ? 'released' : 'anons';
  if (status === 'Ended') return 'released';
  if (status === 'Returning Series') return 'ongoing';
  return 'anons';
}

function normalizeTmdb(item: TmdbItem, type: 'tv' | 'movie', gmap: Map<number, string>): NormalizedAnime {
  const d = item as TmdbDetails;
  const ruName = item.name ?? item.title ?? '';
  const origName = item.original_name ?? item.original_title ?? ruName;
  const date = item.first_air_date ?? item.release_date ?? null;
  const genres = d.genres?.length
    ? d.genres.map((g) => ({ id: g.id, name: g.name, russian: g.name }))
    : (item.genre_ids ?? []).map((id) => ({ id, name: gmap.get(id) ?? String(id), russian: gmap.get(id) ?? null }));
  return {
    id: item.id,
    source: 'tmdb',
    contentType: type,
    name: origName || ruName,
    russian: ruName || null,
    originalName: origName || null,
    image: {
      original: tmdbImage(item.poster_path, 'original') ?? '',
      preview: tmdbImage(item.poster_path) ?? '',
      x96: tmdbImage(item.poster_path) ?? '',
      x48: tmdbImage(item.poster_path) ?? '',
    },
    kind: type,
    score: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
    status: mapStatus(type, d.status),
    episodes: type === 'movie' ? 1 : d.number_of_episodes ?? null,
    episodesAired: type === 'movie' ? 1 : d.number_of_episodes ?? null,
    airedOn: date,
    releasedOn: date,
    season: null,
    seasonYear: date ? new Date(date).getUTCFullYear() : null,
    genres,
    studios: d.networks?.map((n) => n.name).join(', ') ?? d.production_companies?.map((p) => p.name).join(', ') ?? null,
    description: item.overview ?? null,
    descriptionHtml: null,
  };
}

const tmdbSearchSchema = z.object({
  type: z.enum(['tv', 'movie']),
  query: z.string().trim().max(200).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  genres: z.array(z.number().int()).max(20).optional(),
  country: z.string().length(2).optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(20).default(20), // TMDB отдаёт максимум 20/стр
});

export async function searchTmdb(input: unknown) {
  const parsed = tmdbSearchSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Validation error');
  const p = parsed.data;
  const gmap = new Map((await getTmdbGenres(p.type)).map((g) => [g.id, g.name]));

  const list = p.query
    ? await tmdbGet<TmdbList>(`/search/${p.type}`, { query: p.query, page: p.page, include_adult: false })
    : await tmdbGet<TmdbList>(`/discover/${p.type}`, {
        page: p.page,
        sort_by: 'popularity.desc',
        include_adult: false,
        with_genres: p.genres?.length ? p.genres.join(',') : undefined,
        ...(p.type === 'tv'
          ? { first_air_date_year: p.year, with_origin_country: p.country }
          : { primary_release_year: p.year }),
      });

  return {
    media: list.results.map((r) => normalizeTmdb(r, p.type, gmap)),
    pageInfo: {
      total: list.total_results,
      currentPage: list.page,
      lastPage: list.total_pages,
      hasNextPage: list.page < list.total_pages,
      perPage: p.perPage,
    },
  };
}

export async function getTmdbDetails(type: 'tv' | 'movie', id: number): Promise<NormalizedAnime> {
  const d = await tmdbGet<TmdbDetails>(`/${type}/${id}`);
  return normalizeTmdb(d, type, new Map());
}
// ========== Полные детали: сезоны + прогресс пользователя ==========

interface TmdbFullRaw extends TmdbDetails {
  seasons?: { season_number: number; name: string | null; episode_count: number }[];
}

export interface TmdbSeasonInfo { season: number; name: string | null; episodeCount: number; }
export interface TmdbSeasonEpisode { episode: number; name: string | null; airedOn: string | null; }
export interface TmdbFullDetails extends NormalizedAnime {
  seasons: TmdbSeasonInfo[];
  watchItem: { id: string; status: string; note: string | null } | null;
  progress: { seasonNumber: number; episodeNumber: number }[];
}

export async function getTmdbFullDetails(type: 'tv' | 'movie', id: number, userId?: string): Promise<TmdbFullDetails> {
  const d = await tmdbGet<TmdbFullRaw>(`/${type}/${id}`);
  const base = normalizeTmdb(d, type, new Map());

  const seasons: TmdbSeasonInfo[] = type === 'tv'
    ? (d.seasons ?? [])
        .filter((s) => (s.season_number ?? 0) > 0)
        .map((s) => ({ season: s.season_number, name: s.name ?? null, episodeCount: s.episode_count ?? 0 }))
    : [];

  let watchItem: TmdbFullDetails['watchItem'] = null;
  let progress: { seasonNumber: number; episodeNumber: number }[] = [];
  if (userId) {
    const [local] = await db
      .select({ id: animeTable.id })
      .from(animeTable)
      .where(and(eq(animeTable.source, 'tmdb'), eq(animeTable.shikimoriId, id)))
      .limit(1);
    if (local) {
      const [item] = await db
        .select({ id: watchItems.id, status: watchItems.status, note: watchItems.note })
        .from(watchItems)
        .where(and(eq(watchItems.userId, userId), eq(watchItems.animeId, local.id)))
        .limit(1);
      if (item) {
        watchItem = item;
        progress = await db
          .select({ seasonNumber: episodeProgress.seasonNumber, episodeNumber: episodeProgress.episodeNumber })
          .from(episodeProgress)
          .where(and(eq(episodeProgress.userId, userId), eq(episodeProgress.watchItemId, item.id)));
      }
    }
  }

  return { ...base, seasons, watchItem, progress };
}

// ========== Серии сезона (названия на русском) ==========

export async function getTmdbSeasonEpisodes(id: number, season: number): Promise<TmdbSeasonEpisode[]> {
  const d = await tmdbGet<{ episodes?: { episode_number: number; name: string | null; air_date: string | null }[] }>(
    `/tv/${id}/season/${season}`
  );
  return (d.episodes ?? []).map((e) => ({ episode: e.episode_number, name: e.name ?? null, airedOn: e.air_date ?? null }));
}

// ========== Рекомендации TMDB ==========

export async function getTmdbRelated(type: 'tv' | 'movie', id: number): Promise<NormalizedAnime[]> {
  const d = await tmdbGet<{ results?: TmdbItem[] }>(`/${type}/${id}/recommendations`, { page: 1 });
  return (d.results ?? []).slice(0, 12).map((r) => normalizeTmdb(r, type, new Map()));
}