import { api } from './client';
import type { GenreDto, NormalizedAnime, SearchResponse } from '../types/dto';
import { TmdbFullDetails, TmdbSeasonEpisode } from '../types/dto';

export interface TmdbSearchParams {
    type: 'tv' | 'movie';
    query?: string;
    year?: number;
    genres?: number[];
    country?: string;
    page?: number;
    perPage?: number;
    sort?: string;
}

export const tmdbApi = {
    search: (p: TmdbSearchParams) => api.post<SearchResponse>('/tmdb/search', p),
    genres: (type: 'tv' | 'movie') => api.get<{ genres: GenreDto[] }>(`/tmdb/genres?type=${type}`),
    details: (type: 'tv' | 'movie', id: number) => api.get<NormalizedAnime>(`/tmdb/${type}/${id}`),
    full: (type: 'tv' | 'movie', id: number) => api.get<TmdbFullDetails>(`/tmdb/${type}/${id}/full`),
    season: (id: number, n: number) => api.get<TmdbSeasonEpisode[]>(`/tmdb/tv/${id}/season/${n}`),
    related: (type: 'tv' | 'movie', id: number) => api.get<NormalizedAnime[]>(`/tmdb/${type}/${id}/related`),
    pick: (type: 'tv' | 'movie') => api.get<NormalizedAnime>(`/tmdb/pick/${type}`),
};