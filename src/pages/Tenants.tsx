import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Plus, User, Phone, Trash2, Wallet } from 'lucide-react';
import { calculateLeaseFinancialsSync } from '../lib/financialUtils';

export default function Tenants() {
    const { t } = useTranslation();
    const tenants = useLiveQuery(() => db.tenants.toArray());
    const leases = useLiveQuery(() => db.leases.toArray());
    const payments = useLiveQuery(() => db.payments.toArray());
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTenant, setNewTenant] = useState({ name: '', phone: '' });

    const handleAddTenant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTenant.name) return;

        try {
            await db.tenants.add({
                id: uuidv4(),
                name: newTenant.name,
                phone: newTenant.phone,
                status: 'active'
            });
            setNewTenant({ name: '', phone: '' });
            setShowAddForm(false);
        } catch (error) {
            console.error('Failed to add tenant:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this tenant?')) {
            await db.tenants.delete(id);
        }
    };

    const getTenantBalance = (tenantId: string) => {
        if (!leases || !payments) return 0;
        const tenantLeases = leases.filter(l => l.tenantId === tenantId);
        let totalBalance = 0;
        tenantLeases.forEach(l => {
            const stats = calculateLeaseFinancialsSync(l, payments);
            totalBalance += stats.balance;
        });
        return totalBalance;
    };

    return (
        <div className="container main-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h1>{t('tenants')}</h1>
                <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                    <Plus size={20} />
                    Add Tenant
                </button>
            </div>

            {showAddForm && (
                <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                    <form onSubmit={handleAddTenant} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label htmlFor="t-name" style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('name')}</label>
                            <input
                                id="t-name"
                                type="text"
                                value={newTenant.name}
                                onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem' }}
                                placeholder="Full Name"
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label htmlFor="t-phone" style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('phone')}</label>
                            <input
                                id="t-phone"
                                type="tel"
                                value={newTenant.phone}
                                onChange={(e) => setNewTenant({ ...newTenant, phone: e.target.value })}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem' }}
                                placeholder="09..."
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{t('save')}</button>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)} style={{ flex: 1 }}>{t('cancel')}</button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {tenants?.map((tenant) => {
                    const balance = getTenantBalance(tenant.id);
                    return (
                        <div key={tenant.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                                <div style={{ background: 'var(--color-bg)', padding: '10px', borderRadius: '50%' }}>
                                    <User size={24} color="var(--color-primary)" />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', marginBottom: '2px' }}>{tenant.name}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                        <Phone size={14} />
                                        <span>{tenant.phone || 'No phone'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', marginTop: '4px', fontWeight: 600, color: balance > 0 ? '#d32f2f' : 'var(--color-success)' }}>
                                        <Wallet size={14} />
                                        <span>{balance > 0 ? `Due: ${balance.toLocaleString()} ETB` : `Settled / Credit: ${Math.abs(balance).toLocaleString()} ETB`}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(tenant.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', padding: '8px' }}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    );
                })}
                {tenants?.length === 0 && !showAddForm && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                        <p>No tenants yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
