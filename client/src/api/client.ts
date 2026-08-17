const BASE = '/api';

export class ApiError extends Error{
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    } 
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers ?? {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined }),
};

export function setToken(token: string | null): void {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export const clearToken = (): void => localStorage.removeItem('token');