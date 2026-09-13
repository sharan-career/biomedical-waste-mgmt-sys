'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiRequest, clearTokens, getAccessToken, setTokens } from './api-client';

export type RoleName = 'SUPER_ADMIN' | 'ACCOUNTS_MANAGER' | 'COLLECTION_EXECUTIVE' | 'MANAGEMENT';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  roles: RoleName[];
}

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: RoleName[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const response = await apiRequest<{ data: UserProfile }>('/users/me');
      setUser(response.data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<{ data: { accessToken: string; refreshToken: string } }>(
      '/auth/login',
      { method: 'POST', body: { email, password } },
    );
    setTokens(response.data.accessToken, response.data.refreshToken);
    await loadProfile();
  }, [loadProfile]);

  const logout = useCallback(async () => {
    const refreshToken = window.localStorage.getItem('bwms.refreshToken');
    clearTokens();
    setUser(null);
    if (refreshToken) {
      // Best-effort — the tokens are already cleared client-side regardless of outcome.
      await apiRequest('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => undefined);
    }
  }, []);

  const hasRole = useCallback(
    (...roles: RoleName[]) => Boolean(user && roles.some((role) => user.roles.includes(role))),
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
