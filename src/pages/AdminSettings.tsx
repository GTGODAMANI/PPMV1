import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { insertUser } from '../lib/supabaseHelpers';
import type { Database } from '../lib/database.types';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';
import { Trash2, Plus, User as UserIcon, Shield, Database as DatabaseIcon, RefreshCw } from 'lucide-react';

type User = Database['public']['Tables']['users']['Row'];

export default function AdminSettings() {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'caretaker' as const, name: '' });
    const [showForm, setShowForm] = useState(false);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (user?.role === 'owner') {
            fetchUsers();
        }
    }, [user]);

    async function fetchUsers() {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .order('name');

        if (fetchError) {
            setError(fetchError.message);
        } else {
            setUsers(data || []);
        }
        setLoading(false);
    }

    if (user?.role !== 'owner') {
        return <div className="container main-content">Access Denied</div>;
    }

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error: insertError } = await insertUser({
                id: uuidv4(),
                username: newUser.username,
                password_hash: newUser.password, // Simple storage for MVP
                role: newUser.role,
                name: newUser.name
            });

            if (insertError) {
                alert('Error adding user (username likely exists)');
            } else {
                setNewUser({ username: '', password: '', role: 'caretaker', name: '' });
                setShowForm(false);
                fetchUsers();
            }
        } catch (error) {
            alert('Error adding user');
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (confirm('Are you sure you want to delete this user?')) {
            const { error: deleteError } = await supabase
                .from('users')
                .delete()
                .eq('id', id);

            if (deleteError) {
                console.error('Failed to delete user:', deleteError);
                setError(deleteError.message);
            } else {
                fetchUsers();
            }
        }
    };

    const generateDemoData = async () => {
        setGenerating(true);
        try {
            // 1. Create Building
            const bId = uuidv4();
            await supabase.from('buildings').insert({
                id: bId,
                name: 'Luxury Heights',
                location: 'Addis Ababa, Bole'
            } as any);

            // 2. Create Units
            const u1 = uuidv4(); const u2 = uuidv4(); const u3 = uuidv4(); const u4 = uuidv4();
            await supabase.from('units').insert([
                { id: u1, building_id: bId, unit_number: '101', floor: '1', unit_type: 'apartment', size_sqm: 80, rent_pricing_type: 'fixed', rent_amount: 15000, status: 'occupied' },
                { id: u2, building_id: bId, unit_number: '102', floor: '1', unit_type: 'apartment', size_sqm: 85, rent_pricing_type: 'fixed', rent_amount: 18000, status: 'occupied' },
                { id: u3, building_id: bId, unit_number: '201', floor: '2', unit_type: 'apartment', size_sqm: 100, rent_pricing_type: 'fixed', rent_amount: 22000, status: 'vacant' },
                { id: u4, building_id: bId, unit_number: 'Shop-A', floor: 'Ground', unit_type: 'shop', size_sqm: 40, rent_pricing_type: 'per_sqm', rent_amount: 25000, status: 'maintenance' }
            ] as any);

            // 3. Create Tenants
            const t1 = uuidv4(); const t2 = uuidv4();
            await supabase.from('tenants').insert([
                { id: t1, name: 'Aman Tesfaye', phone: '+251911000000', status: 'active' },
                { id: t2, name: 'Sara Kebede', phone: '+251922000000', status: 'active' }
            ] as any);

            // 4. Create Leases
            const l1 = uuidv4(); const l2 = uuidv4();
            const now = new Date();
            const lastMonth = new Date(); lastMonth.setMonth(now.getMonth() - 1);

            await supabase.from('leases').insert([
                {
                    id: l1, tenant_id: t1, unit_id: u1,
                    rent_amount: 15000, pricing_type: 'fixed', size_sqm: 80,
                    start_date: lastMonth.toISOString(), end_date: new Date(now.getFullYear() + 1, now.getMonth(), 1).toISOString(),
                    rent_due_day: 1, is_active: true
                },
                {
                    id: l2, tenant_id: t2, unit_id: u2,
                    rent_amount: 18000, pricing_type: 'fixed', size_sqm: 85,
                    start_date: new Date(now.getFullYear(), 0, 1).toISOString(), end_date: new Date(now.getFullYear(), 12, 31).toISOString(),
                    rent_due_day: 5, is_active: true
                }
            ] as any);

            // 5. Create Payments
            await supabase.from('payments').insert([
                { id: uuidv4(), tenant_id: t1, unit_id: u1, lease_id: l1, amount: 15000, date: new Date(now.getTime() - 86400000 * 2).toISOString(), type: 'rent', method: 'bank_transfer', reference: 'TXN12345', input_date: Date.now(), synced: false },
                { id: uuidv4(), tenant_id: t2, unit_id: u2, lease_id: l2, amount: 13000, date: new Date(now.getTime() - 86400000 * 5).toISOString(), type: 'rent', method: 'cash', reference: 'Reciept#001', input_date: Date.now(), synced: false }
            ] as any);

            // 6. Create Expenses
            await supabase.from('expenses').insert([
                { id: uuidv4(), category: 'Utilities', description: 'Water Bill - Bole Branch', amount: 2500, date: new Date(now.getTime() - 86400000 * 1).toISOString(), status: 'paid', paid_by: 'Owner', vendor: 'Addis Water', deducted_from_rent: false, synced: false },
                { id: uuidv4(), category: 'Maintenance', description: 'Broken Window Repair Unit 202', amount: 5500, date: new Date(now.getTime() - 86400000 * 10).toISOString(), status: 'approved', paid_by: 'Owner', vendor: 'GlassFix Pros', deducted_from_rent: false, synced: false }
            ] as any);

            // 7. Maintenance
            await supabase.from('maintenance').insert({
                id: uuidv4(), unit_id: u4, status: 'in_progress', date: new Date().toISOString(), description: 'Painting and wall repair needed before new tenant.', synced: false
            } as any);

            alert('Demo Data Generated Successfully! Go to Dashboard to see changes.');
        } catch (e) {
            console.error(e);
            alert('Error generating data');
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="container main-content">
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    Loading users...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container main-content">
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-danger)' }}>
                    Error: {error}
                </div>
            </div>
        );
    }

    return (
        <div className="container main-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h1>Admin Settings</h1>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    <Plus size={18} />
                    Add User
                </button>
            </div>

            {/* Demo Data Section */}
            <div className="card" style={{ marginBottom: 'var(--space-4)', background: 'linear-gradient(to right, hsla(35, 60%, 50%, 0.1), transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ padding: '8px', background: 'var(--color-primary)', borderRadius: '50%', color: 'white' }}>
                        <DatabaseIcon size={20} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.1rem' }}>Demo Data</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Populate the app with sample buildings, tenants, and transactions to visualize the features.</p>
                    </div>
                </div>
                <button onClick={generateDemoData} disabled={generating} className="btn btn-secondary" style={{ width: '100%', borderColor: 'var(--color-primary)', color: 'var(--color-primary-hover)' }}>
                    {generating ? <RefreshCw className="spin" size={18} /> : <DatabaseIcon size={18} />}
                    {generating ? 'Generating...' : 'Generate Sample Portfolio'}
                </button>
            </div>

            {showForm && (
                <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                    <h3 style={{ marginBottom: 'var(--space-3)' }}>Create New User</h3>
                    <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <input
                            placeholder="Full Name"
                            value={newUser.name}
                            onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                            required
                        />
                        <input
                            placeholder="Username"
                            value={newUser.username}
                            onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={newUser.password}
                            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                            required
                        />
                        <select
                            value={newUser.role}
                            onChange={(e: any) => setNewUser({ ...newUser, role: e.target.value })}
                        >
                            <option value="caretaker">Caretaker (Limited Access)</option>
                            {/* <option value="owner">Owner (Full Access)</option> */}
                        </select>
                        <button type="submit" className="btn btn-primary">Create User</button>
                    </form>
                </div>
            )}

            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {users.map(u => (
                    <div key={u.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                            <div style={{
                                padding: '10px',
                                borderRadius: '50%',
                                background: u.role === 'owner' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                color: 'white'
                            }}>
                                {u.role === 'owner' ? <Shield size={20} /> : <UserIcon size={20} />}
                            </div>
                            <div>
                                <div style={{ fontWeight: 'bold' }}>{u.name || u.username}</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>@{u.username} • {u.role}</div>
                            </div>
                        </div>

                        {u.username !== 'admin' && u.id !== user.id && (
                            <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="btn btn-secondary"
                                style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
