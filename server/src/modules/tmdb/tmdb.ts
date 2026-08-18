import { env } from '../../config/env.js';

export class TmdbError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'TmdbError';
    this.status = status;
  }
}

const BASE = 'https://api.themoviedb.org/3';
const TIMEOUT_MS = 10_000;

export function tmdbConfigured(): boolean {
  return Boolean(env.TMDB_READ_TOKEN || env.TMDB_API_KEY);
}

/** GET к TMDB: Bearer-токен приоритетнее, api_key — фолбэк; язык — русский с авто-фолбэком TMDB */
export async function tmdbGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  if (!tmdbConfigured()) throw new TmdbError(503, 'TMDB is not configured');
  const url = new URL(`${BASE}${path}`);
  if (!env.TMDB_READ_TOKEN && env.TMDB_API_KEY) url.searchParams.set('api_key', env.TMDB_API_KEY);
  url.searchParams.set('language', 'ru-RU');
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        ...(env.TMDB_READ_TOKEN ? { Authorization: `Bearer ${env.TMDB_READ_TOKEN}` } : {}),
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[TMDB] ${res.status} ${url.pathname}${url.search}: ${text.slice(0, 300)}`);
      throw new TmdbError(res.status, `TMDB API error: ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof TmdbError) throw err;
    console.error(`[TMDB] network error ${url.pathname}:`, err);
    throw new TmdbError(502, 'TMDB API is unavailable');
  } finally {
    clearTimeout(timer);
  }
}

/** Постеры TMDB */
export const tmdbImage = (
  path: string | null,
  size: 'w342' | 'w780' | 'original' = 'w342',
): string | null => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null);