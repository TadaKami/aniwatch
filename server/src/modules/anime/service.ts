import { shikimoriGet, type ShikimoriGenreRaw, type ShikimoriAnimeDetails,type ShikimoriAnimeListItem } from './shikimori.js';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { anime as animeTable, episodeProgress, watchItems } from '../../db/schema.js';
import { HttpError } from '../../lib/http.js';
import { normalizeAnime } from './normalize.js';
import { env } from '../../config/env.js';
import { ShikimoriError } from './shikimori.js';

// ========== Жанры: кэш на 24 часа (§4 ТЗ) ==========

export interface GenreDto {
  id: number;
  name: string;
  russian: string | null;
}

const GENRES_TTL_MS = 24 * 60 * 60 * 1000;
let genresCache: { data: GenreDto[]; fetchedAt: number } | null = null;

export async function getGenres(): Promise<GenreDto[]> {
  if (genresCache && Date.now() - genresCache.fetchedAt < GENRES_TTL_MS) {
    return genresCache.data;
  }
  const raw = await shikimoriGet<ShikimoriGenreRaw[]>('/genres');
  const data = raw
    .filter((g) => g.entry_type === 'Anime') // НЕ g.kind — он всегда "genre" (§4 ТЗ)
    .map((g) => ({ id: g.id, name: g.name, russian: g.russian || null }));
  genresCache = { data, fetchedAt: Date.now() };
  console.log(`[SHIKIMORI] genres cached: ${data.length} anime genres`);
  return data;
}

//============ ПОИСК ================
export const searchSchema = z.object({
  query: z.string().trim().max(200).optional(),
  genres: z.array(z.number().int()).max(20).optional(),
  season: z.enum(['winter', 'spring', 'summer', 'fall']).optional(),
  year: z.number().int().min(1950).max(2100).optional(),
  kind: z.enum(['tv', 'movie', 'ova', 'ona', 'special', 'music']).optional(),
  status: z.enum(['anons', 'ongoing', 'released']).optional(),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(50).default(20),
});

export interface PageInfo{
  total: null;
  currentPage: number;
  lastPage: number | null;
  hasNextPage: boolean;
  perPage: number;
}

export async function searchAnimes(input: unknown, userId?: string){
  const parsed = searchSchema.safeParse(input);
  if(!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Validation error');
  const p = parsed.data;

  // Shikimori принимает season как "summer_2024" или просто год
  const seasonParam = p.season && p.year ? `${p.season}_${p.year}` : p.year ? String(p.year) : p.season;

  // Исключаем тайтлы, уже добавленные пользователем
  let excludeIds: string | undefined;
  if(userId){
    const rows = await db
      .select({shikimoriId: animeTable.shikimoriId})
      .from(watchItems)
      .innerJoin(animeTable, eq(watchItems.animeId, animeTable.id))
      .where(eq(watchItems.userId, userId));
    if(rows.length > 0) excludeIds = rows.map((r)=>r.shikimoriId).join(',');
  }

  const items = await shikimoriGet<ShikimoriAnimeListItem[]>('/animes', {
      search: p.query || undefined,
      genre: p.genres?.length ? p.genres.join(',') : undefined,
      season: seasonParam,
      kind: p.kind,
      status: p.status,
      order: p.query ? 'popularity' : 'ranked', // §4 ТЗ
      page: p.page,
      limit: p.perPage,
      exclude_ids: excludeIds,    
  });

  const media = items.map(normalizeAnime);
  const pageInfo: PageInfo = {
    total: null, // Shikimori не отдаёт total — фронт умеет без него (§4 ТЗ)
    currentPage: p.page,
    lastPage: null,
    hasNextPage: items.length === p.perPage,
    perPage: p.perPage,
  };

  return {media, pageInfo};
}

// ========== Детали тайтла + данные пользователя ==========
export async function getAnimeDetails(shikimoriId: number, userId?: string) {
  const raw = await shikimoriGet<ShikimoriAnimeDetails>(`/animes/${shikimoriId}`);
  const anime = normalizeAnime(raw);

  let current: { id: string; status: string; note: string | null } | null = null;
  let progress: { seasonNumber: number; episodeNumber: number }[] = [];

  if (userId) {
    const [localAnime] = await db
      .select({ id: animeTable.id })
      .from(animeTable)
      .where(eq(animeTable.shikimoriId, shikimoriId))
      .limit(1);

    if (localAnime) {
      const [item] = await db
        .select({ id: watchItems.id, status: watchItems.status, note: watchItems.note })
        .from(watchItems)
        .where(and(eq(watchItems.userId, userId), eq(watchItems.animeId, localAnime.id)))
        .limit(1);

      if (item) {
        current = item;
        progress = await db
          .select({
            seasonNumber: episodeProgress.seasonNumber,
            episodeNumber: episodeProgress.episodeNumber,
          })
          .from(episodeProgress)
          .where(and(eq(episodeProgress.userId, userId), eq(episodeProgress.watchItemId, item.id)));
      }
    }
  }

  return {
    anime,
    airedEpisodeCount: anime.episodesAired || anime.episodes || 0,
    watchItem: current,
    progress,
  };
}
// ========== Доступность постера (HEAD + кэш) ==========

const coverCache = new Map<string, boolean>();

async function headSig(path: string): Promise<{ ok: boolean; sig: string }> {
  const base = env.SHIKIMORI_ORIGIN.replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    method: 'HEAD',
    headers: { 'User-Agent': env.SHIKIMORI_USER_AGENT },
  });
  return { ok: res.ok, sig: `${res.headers.get('etag')}|${res.headers.get('content-length')}` };
}

/** true — постер существует, false — на его месте заглушка Shikimori. */
export async function coverExists(url: string): Promise<boolean> {
  const origin = env.SHIKIMORI_ORIGIN.replace(/\/$/, '');
  if (!url.startsWith(origin)) return true;
  const path = url.slice(origin.length);
  const cached = coverCache.get(path);
  if (cached !== undefined) return cached;

  try {
    const sig = await headSig(path);
    if (!sig.ok) {
      coverCache.set(path, false);
      return false;
    }
    // сигнатура заглушки в ТОМ же размере: меняем только id на отсутствующий
    const phPath = path.replace(/\/\d+\.jpg([?#].*)?$/, '/99999999.jpg$1');
    const ph = await headSig(phPath);
    const exists = !(ph.ok && ph.sig === sig.sig);
    coverCache.set(path, exists);
    return exists;
  } catch {
    coverCache.set(path, true); // сеть мигнула — считаем, что постер есть
    return true;
  }
}

// ========== Названия серий: REST → GraphQL → фолбэк (кэш 24ч / негатив 5мин) ==========

export interface EpisodeInfo {
  episode: number;
  name: string | null;
  russian: string | null;
  airedOn: string | null;
}

type RawEpisode = {
  episode: number;
  name: string | null;
  russian: string | null;
  aired_on?: string | null; // REST
  airedOn?: string | null;  // GraphQL
};

const episodesCache = new Map<number, { data: EpisodeInfo[]; fetchedAt: number }>();
const EPISODES_NEGATIVE_TTL = 5 * 60 * 1000;
let restEpisodesBroken = false; // после первого 404 REST больше не трогаем

async function episodesViaRest(id: number): Promise<RawEpisode[]> {
  return shikimoriGet<RawEpisode[]>(`/episodes?anime_id=${id}`);
}

async function episodesViaGraphql(id: number): Promise<RawEpisode[]> {
  const base = env.SHIKIMORI_API_URL.replace(/\/$/, '');
  const res = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: {
      'User-Agent': env.SHIKIMORI_USER_AGENT,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: 'query($id: ID!) { anime(id: $id) { episodes { episode name russian airedOn } } }',
      variables: { id: String(id) },
    }),
  });
  if (!res.ok) throw new ShikimoriError(res.status, `Shikimori GraphQL error: ${res.status}`);
  const json = (await res.json()) as {
    data?: { anime?: { episodes?: RawEpisode[] | null } | null };
  };
  return json.data?.anime?.episodes ?? [];
}

export async function getEpisodes(shikimoriId: number): Promise<EpisodeInfo[]> {
  const cached = episodesCache.get(shikimoriId);
  if (cached) {
    const ttl = cached.data.length > 0 ? GENRES_TTL_MS : EPISODES_NEGATIVE_TTL;
    if (Date.now() - cached.fetchedAt < ttl) return cached.data;
  }

  let data: EpisodeInfo[] = [];
  try {
    let raw: RawEpisode[];
    if (!restEpisodesBroken) {
      try {
        raw = await episodesViaRest(shikimoriId);
      } catch {
        restEpisodesBroken = true;
        raw = await episodesViaGraphql(shikimoriId);
      }
    } else {
      raw = await episodesViaGraphql(shikimoriId);
    }
    data = raw.map((e) => ({
      episode: e.episode,
      name: e.name || null,
      russian: e.russian || null,
      airedOn: e.airedOn ?? e.aired_on ?? null,
    }));
  } catch {
    data = []; // оба источника недоступны — остаются «Серия N»
  }

  episodesCache.set(shikimoriId, { data, fetchedAt: Date.now() });
  return data;
}

// ========== Сезоны и фильмы (франшиза) ==========

export interface RelatedAnime {
  id: number;
  name: string;
  russian: string | null;
  kind: string | null;
  status: string | null;
  airedOn: string | null;
  image: { preview: string; original: string } | null;
}

type FranchiseNode = {
  id: number | string;
  name?: string | null;
  russian?: string | null;
  kind?: string | null;
  status?: string | null;
  airedOn?: string | null;
  aired_on?: string | null;
  image?: { preview?: string; original?: string } | null;
};

const relatedCache = new Map<number, { data: RelatedAnime[]; fetchedAt: number }>();

function absImg(path: string): string {
  return path.startsWith('http') ? path : `${env.SHIKIMORI_ORIGIN}${path}`;
}

function mapNode(n: FranchiseNode): RelatedAnime {
  return {
    id: Number(n.id),
    name: n.name ?? '',
    russian: n.russian ?? null,
    kind: n.kind ?? null,
    status: n.status ?? null,
    airedOn: n.airedOn ?? n.aired_on ?? null,
    image: n.image?.preview
      ? { preview: absImg(n.image.preview), original: absImg(n.image.original ?? n.image.preview) }
      : null,
  };
}

async function graphqlQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const base = env.SHIKIMORI_API_URL.replace(/\/$/, '');
  const res = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: { 'User-Agent': SHIKIMORI_UA, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new ShikimoriError(res.status, `Shikimori GraphQL error: ${res.status}`);
  const json = (await res.json()) as { data?: T };
  if (!json.data) throw new ShikimoriError(502, 'GraphQL: no data');
  return json.data;
}

const Q_FRANCHISE = `
query($id: ID!) {
  animes(ids: [$id]) {
    franchise {
      id
      name
      nodes {
        id
        name
        russian
        kind
        airedOn
        image { preview original }
      }
    }
  }
}`;

function extractFromRest(fr: unknown): RelatedAnime[] {
  const arr = (x: unknown): FranchiseNode[] => (Array.isArray(x) ? (x as FranchiseNode[]) : []);
  if (Array.isArray(fr)) return arr(fr).map(mapNode);
  if (fr && typeof fr === 'object') {
    const o = fr as Record<string, unknown>;
    return arr(o.nodes ?? o.animes ?? o.anime).map(mapNode);
  }
  return [];
}

export async function getRelated(shikimoriId: number): Promise<RelatedAnime[]> {
  const cached = relatedCache.get(shikimoriId);
  if (cached && Date.now() - cached.fetchedAt < (cached.data.length ? GENRES_TTL_MS : EPISODES_NEGATIVE_TTL)) {
    return cached.data;
  }

  let data: RelatedAnime[] = [];

  // 1) GraphQL: франшиза с узлами
  try {
    const d = await graphqlQuery<{ animes?: Array<{ franchise?: { nodes?: FranchiseNode[] } | null } | null> }>(
      Q_FRANCHISE, { id: String(shikimoriId) }
    );
    data = (d.animes?.[0]?.franchise?.nodes ?? []).map(mapNode).filter((n) => Number.isFinite(n.id) && n.id > 0);
    console.log(`[SHIKIMORI] related via graphql: ${data.length}`);
  } catch (e) {
    console.error('[SHIKIMORI] related graphql failed:', (e as Error).message);
  }

  // 2) Фолбэк: REST /franchises/<slug>
  if (data.length === 0) {
    try {
      const details = await shikimoriGet<{ franchise?: string | null }>(`/animes/${shikimoriId}`);
      if (details.franchise) {
        data = extractFromRest(await shikimoriGet<unknown>(`/franchises/${details.franchise}`));
        console.log(`[SHIKIMORI] related via rest: ${data.length}`);
      }
    } catch (e) {
      console.error('[SHIKIMORI] related rest failed:', (e as Error).message);
    }
  }
  
  // 3) Фолбэк: префиксный поиск по базовому названию (сезоны/фильмы делят префикс)
  if (data.length === 0) {
    try {
      const details = await shikimoriGet<ShikimoriAnimeDetails>(`/animes/${shikimoriId}`);
      const clean = (details.name ?? '')
        .replace(/\s*(\d+(st|nd|rd|th)?\s*Season|Season\s*\d+|Movie|The\s*Movie)\s*$/i, '')
        .replace(/\s*\d+$/, '')
        .trim();
      const bases = new Set<string>();
      if (clean.length >= 3) bases.add(clean);
      if (clean.includes(':')) bases.add(clean.split(':')[0].trim());

      const seen = new Set<number>();
      for (const base of bases) {
        const list = await shikimoriGet<ShikimoriAnimeListItem[]>('/animes', { search: base, limit: 50 });
        for (const a of list) {
          if (!a.name.toLowerCase().startsWith(base.toLowerCase())) continue;
          if (seen.has(a.id)) continue;
          seen.add(a.id);
          data.push({
            id: a.id,
            name: a.name,
            russian: a.russian ?? null,
            kind: a.kind ?? null,
            status: a.status ?? null,
            airedOn: a.aired_on ?? null,
            image: { preview: absImg(a.image.preview), original: absImg(a.image.original) },
          });
        }
      }
      console.log(`[SHIKIMORI] related via name search: ${data.length}`);
    } catch (e) {
      console.error('[SHIKIMORI] related name search failed:', (e as Error).message);
    }
  }

  data.sort((a, b) => (a.airedOn ?? '9999').localeCompare(b.airedOn ?? '9999'));
  relatedCache.set(shikimoriId, { data, fetchedAt: Date.now() });
  return data;
}

// ========== «Что посмотреть»: случайный тайтл из топа ==========

export async function pickRandom(userId?: string) {
  let excludeIds: string | undefined;
  if (userId) {
    const rows = await db
      .select({ shikimoriId: animeTable.shikimoriId })
      .from(watchItems)
      .where(eq(watchItems.userId, userId));
    if (rows.length > 0) excludeIds = rows.map((r) => r.shikimoriId).join(',');
  }

  const items = await shikimoriGet<ShikimoriAnimeListItem[]>('/animes', {
    order: 'ranked',
    status: 'released',
    kind: 'tv',
    limit: 50,
    exclude_ids: excludeIds,
  });
  if (items.length === 0) throw new HttpError(404, 'Nothing to pick');
  return normalizeAnime(items[Math.floor(Math.random() * items.length)]);
}