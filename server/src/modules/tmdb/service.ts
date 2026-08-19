import { z } from 'zod';
import { HttpError } from '../../lib/http.js';
import type { NormalizedAnime } from '../anime/normalize.js';
import { tmdbGet, tmdbImage } from './tmdb.js';

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