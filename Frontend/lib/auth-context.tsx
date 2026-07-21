'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { User, AuthContextType } from './types';
import { AUTH_TOKEN_KEY, fetchCurrentUser, loginWithApi, loginWithGoogleApi } from '@/lib/api-client';
import { GoogleOAuthProvider } from '@react-oauth/google';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_LOGIN_TIME_KEY = 'mosq_session_start';
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 horas

function isSessionExpired(): boolean {
  if (typeof window === 'undefined') return false;
  const loginTime = window.localStorage.getItem(SESSION_LOGIN_TIME_KEY);
  if (!loginTime) return false;
  return Date.now() - Number(loginTime) > SESSION_TIMEOUT_MS;
}

function saveSessionStart() {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SESSION_LOGIN_TIME_KEY, String(Date.now()));
  }
}

function clearSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(SESSION_LOGIN_TIME_KEY);
    window.localStorage.removeItem('mosq_pending_loan_id');
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const performLogout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (typeof window === 'undefined') {
        if (isMounted) setLoading(false);
        return;
      }

      const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      // Check session timeout before even trying to fetch user
      if (isSessionExpired()) {
        clearSession();
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const currentUser = await fetchCurrentUser();
        if (isMounted) {
          setUser(currentUser);
          // Redirect students with incomplete profiles
          if (currentUser.requiere_completar_perfil && typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            if (currentPath !== '/completar-perfil') {
              window.location.href = '/completar-perfil';
            }
          }
        }
      } catch {
        clearSession();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  // Periodic session check every 60 seconds (only for students)
  useEffect(() => {
    if (!user || user.role === 'admin') return;

    checkIntervalRef.current = setInterval(() => {
      if (isSessionExpired()) {
        performLogout();
        // Force redirect to login
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }
    }, 60_000); // check every minute

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [user, performLogout]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await loginWithApi(email, password);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTH_TOKEN_KEY, response.token);
      }
      saveSessionStart();
      setUser(response.user);
      return response.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async (credential: string) => {
    setLoading(true);
    try {
      const response = await loginWithGoogleApi(credential);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTH_TOKEN_KEY, response.token);
      }
      saveSessionStart();
      setUser(response.user);
      return response; // Devolvemos todo el response para ver si requiere perfil
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
      <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout }}>
        {children}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

