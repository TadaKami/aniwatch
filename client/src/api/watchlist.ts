import { api } from './client';
import type { WatchlistAddBody, WatchlistItem, WatchStatus } from '../types/dto';

export const watchlistApi = {
    list: () => api.get<WatchlistItem[]>('/watchlist'),
    add: (body: WatchlistAddBody) => api.post<WatchlistItem>('/watchlist', body),
    update: (id: string, status: WatchStatus) =>
        api.patch<WatchlistItem>(`/watchlist/${id}`, { status }),
    remove: (id: string) => api.delete<{ ok: true }>(`/watchlist/${id}`),
    setProgress: (id: string, watched: number) =>
        api.patch<{ watchedEpisodes: number }>(`/watchlist/${id}/progress`, { watched }),
};