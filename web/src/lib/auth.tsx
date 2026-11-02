import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { get, post, onUnauthorized } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  refresh: () => Promise<User | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children, initialUser = null }: { children: ReactNode; initialUser?: User | null }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  useEffect(() => {
    let active = true;
    get<{ user: User }>('/auth/me')
      .then((data) => { if (active) setUser(data.user); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      setUser(null);
      queryClient.clear();
    });
    return () => { unsubscribe(); };
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await post<{ user: User }>('/auth/login', { email, password });
    queryClient.clear();
    setUser(data.user);
    return data.user;
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await post('/auth/logout');
    } finally {
      queryClient.clear();
      setUser(null);
    }
  }, [queryClient]);

  const refresh = useCallback(async () => {
    try {
      const data = await get<{ user: User }>('/auth/me');
      setUser(data.user);
      return data.user;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, setUser, refresh }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
