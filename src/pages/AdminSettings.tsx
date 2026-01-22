import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../context/AuthContext';
import { Trash2, Plus, User as UserIcon, Shield, Database, RefreshCw } from 'lucide-react';

export default function AdminSettings() {
    const { user } = useAuth();
    const users = useLiveQuery(() => db.users.toArray());

    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'caretaker' as const, name: '' });
    const [showForm, setShowForm] = useState(false);
    const [generating, setGenerating] = useState(false);

    if (user?.role !== 'owner') {
        return <div className="container main-content">Access Denied</div>;
    }

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await db.users.add({
                id: uuidv4(),
                username: newUser.username,
                passwordHash: newUser.password, // Simple storage for MVP
                role: newUser.role,
                name: newUser.name
            });
            setNewUser({ username: '', password: '', role: 'caretaker', name: '' });
            setShowForm(false);
        } catch (error) {
            alert('Error adding user (username likely exists)');
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (confirm('Are you sure you want to delete this user?')) {
            await db.users.delete(id);
        }
    };

    const generateDemoData = async () => {
        setGenerating(true);
        try {
            await db.transaction('rw', [db.buildings, db.units, db.tenants, db.leases, db.payments, db.expenses, db.maintenance], async () => {
                // 1. Create Building
                const bId = uuidv4();
                await db.buildings.add({ id: bId, name: 'Luxury Heights', location: 'Addis Ababa, Bole' });

                // 2. Create Units
                const u1 = uuidv4(); const u2 = uuidv4(); const u3 = uuidv4(); const u4 = uuidv4();
                await db.units.bulkAdd([
                    { id: u1, buildingId: bId, unitNumber: '101', floor: '1', unitType: 'apartment', sizeSqm: 80, rentPricingType: 'fixed', rentAmount: 15000, status: 'occupied' },
                    { id: u2, buildingId: bId, unitNumber: '102', floor: '1', unitType: 'apartment', sizeSqm: 85, rentPricingType: 'fixed', rentAmount: 18000, status: 'occupied' },
                    { id: u3, buildingId: bId, unitNumber: '201', floor: '2', unitType: 'apartment', sizeSqm: 100, rentPricingType: 'fixed', rentAmount: 22000, status: 'vacant' },
                    { id: u4, buildingId: bId, unitNumber: 'Shop-A', floor: 'Ground', unitType: 'shop', sizeSqm: 40, rentPricingType: 'per_sqm', rentAmount: 25000, status: 'maintenance' }
                ]);

                // 3. Create Tenants (Clean Identity Only)
                const t1 = uuidv4(); const t2 = uuidv4();
                await db.tenants.bulkAdd([
                    { id: t1, name: 'Aman Tesfaye', phone: '+251911000000', status: 'active', balance: 0 },
                    { id: t2, name: 'Sara Kebede', phone: '+251922000000', status: 'active', balance: -5000 }
                ]);

                // 4. Create Leases (Connecting Tenant -> Unit)
                const l1 = uuidv4(); const l2 = uuidv4();
                const now = new Date();
                const lastMonth = new Date(); lastMonth.setMonth(now.getMonth() - 1);

                await db.leases.bulkAdd([
                    {
                        id: l1, tenantId: t1, unitId: u1,
                        rentAmount: 15000, pricingType: 'fixed', sizeSqm: 80,
                        startDate: lastMonth, endDate: new Date(now.getFullYear() + 1, now.getMonth(), 1),
                        rentDueDay: 1, isActive: true
                    },
                    {
                        id: l2, tenantId: t2, unitId: u2,
                        rentAmount: 18000, pricingType: 'fixed', sizeSqm: 85,
                        startDate: new Date(now.getFullYear(), 0, 1), endDate: new Date(now.getFullYear(), 12, 31),
                        rentDueDay: 5, isActive: true
                    }
                ]);

                // Update Units to reflect occupancy (optional, but good for quick UI)
                await db.units.update(u1, { currentTenantId: t1 });
                await db.units.update(u2, { currentTenantId: t2 });

                // 5. Create Payments
                await db.payments.bulkAdd([
                    { id: uuidv4(), tenantId: t1, unitId: u1, leaseId: l1, amount: 15000, date: new Date(now.getTime() - 86400000 * 2), type: 'rent', method: 'bank_transfer', reference: 'TXN12345', inputDate: Date.now(), synced: false },
                    { id: uuidv4(), tenantId: t2, unitId: u2, leaseId: l2, amount: 13000, date: new Date(now.getTime() - 86400000 * 5), type: 'rent', method: 'cash', reference: 'Reciept#001', inputDate: Date.now(), synced: false }
                ]);

                // 6. Create Expenses
                await db.expenses.bulkAdd([
                    { id: uuidv4(), category: 'Utilities', description: 'Water Bill - Bole Branch', amount: 2500, date: new Date(now.getTime() - 86400000 * 1), status: 'paid', paidBy: 'Owner', vendor: 'Addis Water', deductedFromRent: false, synced: false },
                    { id: uuidv4(), category: 'Maintenance', description: 'Broken Window Repair Unit 202', amount: 5500, date: new Date(now.getTime() - 86400000 * 10), status: 'approved', paidBy: 'Owner', vendor: 'GlassFix Pros', deductedFromRent: false, synced: false }
                ]);

                // 7. Maintenance
                await db.maintenance.add({
                    id: uuidv4(), unitId: u4, status: 'in_progress', date: new Date(), description: 'Painting and wall repair needed before new tenant.', synced: false
                });
            });
            alert('Demo Data Generated Successfully! Go to Dashboard to see changes.');
        } catch (e) {
            console.error(e);
            alert('Error generating data');
        } finally {
            setGenerating(false);
        }
    };

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
                        <Database size={20} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.1rem' }}>Demo Data</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Populate the app with sample buildings, tenants, and transactions to visualize the features.</p>
                    </div>
                </div>
                <button onClick={generateDemoData} disabled={generating} className="btn btn-secondary" style={{ width: '100%', borderColor: 'var(--color-primary)', color: 'var(--color-primary-hover)' }}>
                    {generating ? <RefreshCw className="spin" size={18} /> : <Database size={18} />}
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
                {users?.map(u => (
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
