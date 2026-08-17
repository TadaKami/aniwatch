import {api} from './client';
import type {AuthResponce} from '../types/dto';

export const authApi = {
    register: (body: {name: string; email: string; password: string}) =>
        api.post<AuthResponce>('/auth/register', body),
    login: (body: {email:string, password: string}) =>
        api.post<AuthResponce>('/auth/login',body),
};