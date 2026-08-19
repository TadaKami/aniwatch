export interface PublicUser{
    id: string;
    email: string;
    name: string;
    avatar: string | null;
}

export interface AuthResponce{
    token: string;
    user: PublicUser;
}

export type WatchStatus = 'WANT_TO_WATCH' | 'WATCHING' | 'WATCHED' | 'DROPPED';

export interface NormalizedGenre{
    id: number;
    name: string;
    russian: string | null;
}

export interface NormalizedAnime{
    id: number;
    source: 'shikimori' | 'tmdb';
    contentType: 'anime' | 'tv' | 'movie';
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

export interface PageInfo{
    total: number | null;
    currentPage: number;
    lastPage: number | null;
    hasNextPage: boolean;
    perPage: number;
}

export interface SearchResponse {media: NormalizedAnime[]; pageInfo: PageInfo}
export interface GenreDto {id: number; name: string; russian: string | null;}

export interface WatchlistAnime {
    id: string;
    shikimoriId: number;
    source: 'shikimori' | 'tmdb';
    contentType: 'anime' | 'tv' | 'movie';
    name: string;
    russian: string | null;
    coverImage: string | null;
    kind: string | null;
    score: number | null;
    episodes: number | null;
    episodesAired: number | null;
    season: string | null;
    seasonYear: number | null;
    genres: string[] | null;    
}

export interface WatchlistItem {
    id: string;
    status: WatchStatus;
    note: string | null;
    createdAt: string;
    updatedAt: string;
    anime: WatchlistAnime;    
}

export interface WatchlistAddBody {
    shikimoriId: number;
    name: string;
    russian?: string | null;
    coverImage?: string | null;
    kind?: string | null;
    score?: number | null;
    episodes?: number | null;
    episodesAired?: number | null;
    season?: string | null;
    seasonYear?: number | null;
    genres?: string[];
    description?: string | null;
    studios?: string | null;
    status?: WatchStatus;    
    source?: 'shikimori' | 'tmdb';
    contentType?: 'anime' | 'tv' | 'movie';
}

export interface GenreStat {genre: string; count: number;}

export interface AnimeDetailsResponse { 
    anime: NormalizedAnime; 
    airedEpisodeCount: number; 
    watchItem: 
        { id: string; status: WatchStatus; note: string | null } | null; 
    progress: { seasonNumber: number; episodeNumber: number }[] 
}

export interface RelatedAnime {
    id: number;
    name: string;
    russian: string | null;
    kind: string | null;
    airedOn: string | null;
    image: { preview: string; original: string } | null;
}

export interface StatsOverview {
    totals: { totalTitles: number; watchedTitles: number; watchingTitles: number; episodesWatched: number };
    activity: { weekStart: string; count: number }[];
    watching: {
        shikimoriId: number;
        russian: string | null;
        name: string;
        coverImage: string | null;
        watched: number;
        aired: number;
        source?: 'shikimori' | 'tmdb';
        contentType?: 'anime' | 'tv' | 'movie';        
    }[];
}

export interface NextItem {
    id: number;
    name: string;
    russian: string | null;
    kind: string | null;
    status: string | null;
    airedOn: string | null;
    image: { preview: string; original: string } | null;
    sourceTitle: string;
    inListStatus: WatchStatus | null;
    source: 'shikimori' | 'tmdb';
    contentType: 'anime' | 'tv' | 'movie';
    relation: 'sequel' | 'similar';   
}

export interface TmdbFullDetails extends NormalizedAnime {
    seasons: { season: number; name: string | null; episodeCount: number }[];
    watchItem: { id: string; status: WatchStatus; note: string | null } | null;
    progress: { seasonNumber: number; episodeNumber: number }[];
}

export interface TmdbSeasonEpisode { episode: number; name: string | null; airedOn: string | null; }