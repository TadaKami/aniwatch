import { env } from '../../config/env.js';
import type { ShikimoriAnimeDetails, ShikimoriAnimeListItem } from './shikimori.js';

export interface NormalizedGenre{
    id: number;
    name: string,
    russian: string | null;
}

export interface NormalizedAnime {
    id: number; // shikimoriId
    name: string;
    russian: string | null;
    originalName: string | null;
    image: { original: string; preview: string; x96: string; x48: string };
    kind: string | null;
    score: number | null;
    status: string | null;
    episodes: number | null;
    episodesAired: number | null;
    airedOn: string | null;
    releasedOn: string | null;
    season: string | null;
    seasonYear: number | null;
    genres: NormalizedGenre[];
    studios: string | null;
    description: string | null;
    descriptionHtml: string | null;
}

function abs(path: string): string {
    return path.startsWith('http') ? path : `${env.SHIKIMORI_ORIGIN}${path}`;
}

const MONTH_TO_SEASON: Record<number, string> = {
    12: 'winter', 1: 'winter', 2: 'winter',
    3: 'spring', 4: 'spring', 5: 'spring',
    6: 'summer', 7: 'summer', 8: 'summer',
    9: 'fall', 10: 'fall', 11: 'fall',
}

function seasonFrom(dateIso: string | null): string | null{
    if(!dateIso) return null;
    const month = new Date(dateIso).getUTCMonth() +1;
    return MONTH_TO_SEASON[month];
}

function parseScore(score: string | null): number | null{
    if(!score) return null;
    const n = Number(score);
    return Number.isFinite(n) ? n : null;
}

export function normalizeAnime(item: ShikimoriAnimeListItem | ShikimoriAnimeDetails): NormalizedAnime {
    const details = 'genres' in item ? (item as ShikimoriAnimeDetails) : null;
    return {
        id: item.id,
        name: String(item.name),
        russian: item.russian || null,
        originalName: String(item.name) || null,
        image: {
        original: abs(item.image.original),
        preview: abs(item.image.preview),
        x96: abs(item.image.x96),
        x48: abs(item.image.x48),
        },
        kind: item.kind || null,
        score: parseScore(item.score),
        status: item.status || null,
        episodes: item.episodes ?? null,
        episodesAired: item.episodes_aired ?? null,
        airedOn: item.aired_on || null,
        releasedOn: item.released_on || null,
        season: seasonFrom(item.aired_on),
        seasonYear: item.aired_on ? new Date(item.aired_on).getUTCFullYear() : null,
        genres: details?.genres
        ? details.genres.map((g) => ({ id: g.id, name: g.name, russian: g.russian || null }))
        : [],
        studios: details?.studios?.length ? details.studios.map((s) => s.name).join(', ') : null,
        description: details?.description ?? null,
        descriptionHtml: details?.description_html ?? null,
    };
}