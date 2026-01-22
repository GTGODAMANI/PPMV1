import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, type User } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';

interface AuthContextType {
    user: User | null;
    login: (username: string, passwordHash: string) => Promise<boolean>;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            // 1. Check for stored session (simplified: just id in localStorage for now)
            const storedUserId = localStorage.getItem('property_user_id');
            if (storedUserId) {
                const u = await db.users.get(storedUserId);
                if (u) setUser(u);
            }

            // 2. Ensure Admin Exists (Seeding)
            const adminExists = await db.users.where('username').equals('admin').first();
            if (!adminExists) {
                await db.users.add({
                    id: uuidv4(),
                    username: 'admin',
                    passwordHash: 'admin123', // In real app: hash this!
                    role: 'owner',
                    name: 'Display Owner'
                });
                console.log('Seeded admin user');
            }

            setLoading(false);
        };

        initAuth();
    }, []);

    const login = async (username: string, passwordHash: string) => {
        const u = await db.users.where('username').equals(username).first();
        if (u && u.passwordHash === passwordHash) {
            setUser(u);
            localStorage.setItem('property_user_id', u.id); // Simple session
            return true;
        }
        return false;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('property_user_id');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
