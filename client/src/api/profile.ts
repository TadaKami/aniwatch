import { api } from './client';
import type { PublicUser } from '../types/dto.js';

export interface Profile extends PublicUser { createdAt: string; }

export const profileApi = {
    get: () => api.get<Profile>('/profile'),
    update: (body: { name?: string; email?: string; avatar?: string | null }) =>
        api.patch<PublicUser>('/profile', body),
};