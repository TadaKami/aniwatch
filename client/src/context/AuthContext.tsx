import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth.js';
import { clearToken, setToken } from '../api/client.js';
import type { PublicUser } from '../types/dto.js';

const USER_KEY = 'user';

interface AuthContextValue {
  user: PublicUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (u: PublicUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): PublicUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as PublicUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(readStoredUser);

  const value = useMemo<AuthContextValue>(() => {
    const applySession = (token: string, u: PublicUser) => {
      setToken(token);
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      setUser(u);
    };
    return {
      user,
      login: async (email, password) => {
        const res = await authApi.login({ email, password });
        applySession(res.token, res.user);
      },
      register: async (name, email, password) => {
        const res = await authApi.register({ name, email, password });
        applySession(res.token, res.user);
      },
      logout: () => {
        clearToken();
        localStorage.removeItem(USER_KEY);
        setUser(null);
      },
      updateUser: (u: PublicUser) => {
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        setUser(u);
      },      
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}