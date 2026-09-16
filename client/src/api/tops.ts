import { api } from './client';
import type { TopDto } from '../types/dto';

export const topsApi = {
    list: () => api.get<TopDto[]>('/tops'),
    create: (body: { name: string; description?: string | null; contentType?: string }) =>
        api.post<TopDto>('/tops', body),
    remove: (id: string) => api.delete<{ ok: true }>(`/tops/${id}`),
    addItem: (topId: string, animeId: string) =>
        api.post<{ ok: true }>(`/tops/${topId}/items`, { animeId }),
    removeItem: (topId: string, animeId: string) =>
        api.delete<{ ok: true }>(`/tops/${topId}/items/${animeId}`),
    reorder: (topId: string, items: string[]) => api.patch<{ ok: true }>(`/tops/${topId}/reorder`, { items }),
};