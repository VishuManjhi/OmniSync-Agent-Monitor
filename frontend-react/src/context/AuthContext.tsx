import React, { createContext, useContext, useState } from 'react';

const API_BASE = 'http://localhost:3003';
const TOKEN_KEY = 'omnisync_jwt';

interface User {
    id: string;
    role: 'agent' | 'supervisor';
    loginTime: number;
}

interface AuthContextType {
    user: User | null;
    login: (id: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
}

function decodePayload(token: string): any {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('[Auth] Decoding failed:', e);
        return null;
    }
}

function userFromToken(token: string): User | null {
    const payload = decodePayload(token);
    if (!payload) return null;
    return { id: payload.id, role: payload.role, loginTime: Date.now() };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const token = localStorage.getItem(TOKEN_KEY);
        return token ? userFromToken(token) : null;
    });

    const login = async (id: string, password: string): Promise<void> => {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password })
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || 'INVALID_CREDENTIALS');
        }

        const { token } = await res.json();
        localStorage.setItem(TOKEN_KEY, token);
        setUser(userFromToken(token)!);
    };

    const logout = () => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        window.location.href = '/';
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
