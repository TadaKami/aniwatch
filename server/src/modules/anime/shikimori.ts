import { env } from '../../config/env.js';

export class ShikimoriError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ShikimoriError';
    this.status = status;
  }
}

const TIMEOUT_MS = 10_000;

/** GET к Shikimori с заголовками из ТЗ и таймаутом. */
export async function shikimoriGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const base = env.SHIKIMORI_API_URL.replace(/\/$/, '');
  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': env.SHIKIMORI_USER_AGENT,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[SHIKIMORI] ${res.status} ${url.pathname}${url.search}: ${text.slice(0, 300)}`);
      throw new ShikimoriError(res.status, `Shikimori API error: ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ShikimoriError) throw err;
    console.error(`[SHIKIMORI] network error ${url.pathname}:`, err);
    throw new ShikimoriError(502, 'Shikimori API is unavailable');
  } finally {
    clearTimeout(timer);
  }
}

// ==== Сырые типы Shikimori (то, что приходит из API) ====

export interface ShikimoriImage {
  original: string;
  preview: string;
  x96: string;
  x48: string;
}

export interface ShikimoriAnimeListItem {
  id: number;
  name: string;
  russian: string | null;
  image: ShikimoriImage;
  kind: string | null;
  score: string | null; // Shikimori отдаёт строкой!
  status: string | null;
  episodes: number | null;
  episodes_aired: number | null;
  aired_on: string | null;
  released_on: string | null;
}

export interface ShikimoriGenreRaw {
  id: number;
  name: string;
  russian: string | null;
  kind: string;
  entry_type: string; // ВАЖНО: фильтруем по нему, НЕ по kind (§4 ТЗ)
}

export interface ShikimoriAnimeDetails extends ShikimoriAnimeListItem {
  description: string | null;
  description_html: string | null;
  studios: { id: number; name: string }[];
  genres: ShikimoriGenreRaw[];
}