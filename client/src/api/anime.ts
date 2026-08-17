import { api } from './client';
import type { AnimeDetailsResponse, GenreDto, SearchResponse, RelatedAnime } from '../types/dto';

export interface SearchParams {
    query?: string;
    genres?: number[];
    season?: string;
    year?: number;
    kind?: string;
    status?: string;
    page?: number;
    perPage?: number;
}

export const animeApi = {
    search: (p: SearchParams) => api.post<SearchResponse>('/anime/search', p),
    genres: () => api.get<{ genres: GenreDto[] }>('/anime/genres'),
    details: (id: number) => api.get<AnimeDetailsResponse>(`/anime/${id}`),
    related: (id: number) => api.get<RelatedAnime[]>(`/anime/${id}/related`),
};