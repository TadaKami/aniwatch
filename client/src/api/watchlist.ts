import { api } from './client';
import type { WatchlistAddBody, WatchlistItem, WatchStatus } from '../types/dto';

export interface ProgressBody {
    watchItemId: string;
    seasonNumber: number;
    episodeNumber: number;
}

export const watchlistApi = {
    list: () => api.get<WatchlistItem[]>('/watchlist'),
    add: (body: WatchlistAddBody) => api.post<WatchlistItem>('/watchlist', body),
    update: (id: string, status: WatchStatus) =>
        api.patch<WatchlistItem>(`/watchlist/${id}`, { status }),
    remove: (id: string) => api.delete<{ ok: true }>(`/watchlist/${id}`),
    addProgress: (body: ProgressBody) =>
        api.post<{ ok: true; created: boolean }>('/watchlist/progress', body),
    removeProgress: (body: ProgressBody) =>
        api.delete<{ ok: true }>('/watchlist/progress', body),
};