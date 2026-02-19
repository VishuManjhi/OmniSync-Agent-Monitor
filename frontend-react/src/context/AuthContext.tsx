import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
    id: string;
    role: 'agent' | 'supervisor';
    loginTime: number;
}

interface AuthContextType {
    user: User | null;
    login: (id: string, role: 'agent' | 'supervisor') => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => {
        const stored = sessionStorage.getItem('restro_auth');
        return stored ? JSON.parse(stored) : null;
    });

    const login = (id: string, role: 'agent' | 'supervisor') => {
        const normalizedId = id.toLowerCase();
        const newUser: User = {
            id: normalizedId,
            role,
            loginTime: Date.now()
        };
        setUser(newUser);
        sessionStorage.setItem('restro_auth', JSON.stringify(newUser));
    };

    const logout = () => {
        setUser(null);
        sessionStorage.removeItem('restro_auth');
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
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
