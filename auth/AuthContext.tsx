import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthSession } from '../services/authService';
import { getSession, login as loginService, logout as logoutService } from '../services/authService';

type AuthContextValue = {
    isAuthenticated: boolean;
    isLoading: boolean;
    userName?: string;
    error?: string;
    isLocalAuth?: boolean;
    refreshSession: () => Promise<void>;
    login: (password: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth debe usarse dentro de AuthProvider');
    }
    return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<AuthSession>({ authenticated: false });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | undefined>();
    const [isLocalAuth, setIsLocalAuth] = useState(false);

    const refreshSession = async () => {
        setIsLoading(true);
        setError(undefined);
        try {
            const data = await getSession();
            setSession(data);
            setIsLocalAuth(Boolean(data.isLocal));
        } catch (err: any) {
            setSession({ authenticated: false });
            setError(err?.message || 'No se pudo validar la sesión');
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (password: string) => {
        setIsLoading(true);
        setError(undefined);
        try {
            const data = await loginService(password);
            setSession(data);
            setIsLocalAuth(Boolean(data.isLocal));
        } catch (err: any) {
            setSession({ authenticated: false });
            setError(err?.message || 'No se pudo iniciar sesión');
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setIsLoading(true);
        setError(undefined);
        try {
            await logoutService();
            setSession({ authenticated: false });
            setIsLocalAuth(false);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void refreshSession();
    }, []);

    const value = useMemo<AuthContextValue>(() => ({
        isAuthenticated: session.authenticated,
        isLoading,
        userName: session.user?.name,
        error,
        isLocalAuth,
        refreshSession,
        login,
        logout
    }), [session, isLoading, error, isLocalAuth]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
