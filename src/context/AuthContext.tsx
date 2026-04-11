import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { insertUser } from '../lib/supabaseHelpers';
import type { Database } from '../lib/database.types';
import { v4 as uuidv4 } from 'uuid';

type User = Database['public']['Tables']['users']['Row'];

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
                const { data: u } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', storedUserId)
                    .single();

                if (u) setUser(u);
            }

            // 2. Ensure Admin Exists (Seeding)
            const { data: adminExists } = await supabase
                .from('users')
                .select('id')
                .eq('username', 'admin')
                .single();

            if (!adminExists) {
                await insertUser({
                    id: uuidv4(),
                    username: 'admin',
                    password_hash: 'admin123', // In real app: hash this!
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
        const { data: u } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (u && (u as any).password_hash === passwordHash) {
            setUser(u as User);
            localStorage.setItem('property_user_id', (u as any).id); // Simple session
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
