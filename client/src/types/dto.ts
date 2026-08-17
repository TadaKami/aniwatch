export interface PublicUser{
    id: string;
    email: string;
    name: string;
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
    total: null;
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
}

export interface GenreStat {genre: string; count: number;}

export interface AnimeDetailsResponse { 
    anime: NormalizedAnime; 
    airedEpisodeCount: number; 
    watchItem: 
        { id: string; status: WatchStatus; note: string | null } | null; 
    progress: { seasonNumber: number; episodeNumber: number }[] 
}