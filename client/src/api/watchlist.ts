import { api } from './client';
import type { WatchlistAddBody, WatchlistItem, WatchStatus } from '../types/dto';

export const watchlistApi = {
    list: () => api.get<WatchlistItem[]>('/watchlist'),
    add: (body: WatchlistAddBody) => api.post<WatchlistItem>('/watchlist', body),
    update: (id: string, patch: { status?: WatchStatus; note?: string | null; rating?: number | null }) =>
        api.patch<WatchlistItem>(`/watchlist/${id}`, patch),
    remove: (id: string) => api.delete<{ ok: true }>(`/watchlist/${id}`),
    setProgress: (id: string, watched: number) =>
        api.patch<{ watchedEpisodes: number }>(`/watchlist/${id}/progress`, { watched }),
};