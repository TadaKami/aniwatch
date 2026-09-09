import { api } from './client';
import type { AnimeDetailsResponse, GenreDto, SearchResponse, RelatedAnime, NormalizedAnime, ReviewDto } from '../types/dto';

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
    reviews: (id: number) => api.get<ReviewDto[]>(`/anime/${id}/reviews`),
    pick: (excludeId?: number) =>
        api.get<NormalizedAnime>(`/anime/pick${excludeId ? `?exclude=${excludeId}` : ''}`),
};