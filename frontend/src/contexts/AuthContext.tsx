'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { User } from '@/lib/types';
import { landing } from '@/permissions';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      queueMicrotask(() => { if (active) setLoading(false); });
    } else {
      api.getMe().then(userData => {
        if (!active) return;
        setToken(storedToken);
        setUser(userData);
        setLoading(false);
      }).catch(() => {
        if (!active) return;
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setLoading(false);
        router.replace('/');
      });
    }
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    const expire = () => {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      router.replace('/');
    };
    window.addEventListener('crm:session-expired', expire);
    return () => window.removeEventListener('crm:session-expired', expire);
  }, [router]);

  const login = (newToken: string, userData: User) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    router.push(landing(userData));
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
