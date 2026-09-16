import { api } from './client';
import type { TopDto } from '../types/dto';

export const topsApi = {
    list: () => api.get<TopDto[]>('/tops'),
    get: (id: string) => api.get<TopDto>(`/tops/${id}`),
    create: (body: { name: string; description?: string | null; contentType?: string; items?: { animeId: string; comment?: string | null }[] }) =>
        api.post<{ id: string }>('/tops', body),
    remove: (id: string) => api.delete<{ ok: true }>(`/tops/${id}`),
    addItem: (topId: string, animeId: string, comment?: string | null) =>
        api.post<{ ok: true }>(`/tops/${topId}/items`, { animeId, comment: comment ?? null }),
    removeItem: (topId: string, animeId: string) => api.delete<{ ok: true }>(`/tops/${topId}/items/${animeId}`),
    reorder: (topId: string, items: string[]) => api.patch<{ ok: true }>(`/tops/${topId}/reorder`, { items }),
};