import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Plus, FileText, CheckCircle, AlertOctagon, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { isLeaseActive, validateNewLease } from '../lib/leaseUtils';
import { calculateLeaseFinancialsSync } from '../lib/financialUtils';

export default function Leases() {
    const leases = useLiveQuery(() => db.leases.toArray());
    const units = useLiveQuery(() => db.units.toArray());
    const tenants = useLiveQuery(() => db.tenants.where('status').equals('active').toArray());
    const payments = useLiveQuery(() => db.payments.toArray());

    // Sort leases: Active first, then by date
    const sortedLeases = leases?.sort((a, b) => {
        const aActive = isLeaseActive(a);
        const bActive = isLeaseActive(b);
        if (aActive === bActive) {
            return b.startDate.getTime() - a.startDate.getTime();
        }
        return aActive ? -1 : 1;
    });

    const [showAddForm, setShowAddForm] = useState(false);
    const [newLease, setNewLease] = useState({
        tenantId: '',
        unitId: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
        rentAmount: '',
        rentDueDay: '1'
    });
    const [error, setError] = useState<string | null>(null);

    const handleAddLease = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!newLease.tenantId || !newLease.unitId || !newLease.startDate || !newLease.rentAmount) {
            setError("Please fill in all required fields.");
            return;
        }

        // 1. Business Logic Validation
        const validation = await validateNewLease(newLease.unitId);
        if (!validation.valid) {
            setError(validation.error || "Validation failed");
            return;
        }

        // 2. Derive Unit Snapshot Data
        const unit = units?.find(u => u.id === newLease.unitId);
        if (!unit) {
            setError("Selected unit not found.");
            return;
        }

        try {
            await db.leases.add({
                id: uuidv4(),
                tenantId: newLease.tenantId,
                unitId: newLease.unitId,
                startDate: new Date(newLease.startDate),
                endDate: newLease.endDate ? new Date(newLease.endDate) : new Date(new Date(newLease.startDate).setFullYear(new Date(newLease.startDate).getFullYear() + 1)), // Default 1 year if empty
                rentAmount: parseFloat(newLease.rentAmount),
                pricingType: unit.rentPricingType,
                sizeSqm: unit.sizeSqm,
                rentDueDay: parseInt(newLease.rentDueDay),
                isActive: true
            });
            setNewLease({
                tenantId: '',
                unitId: '',
                startDate: format(new Date(), 'yyyy-MM-dd'),
                endDate: '',
                rentAmount: '',
                rentDueDay: '1'
            });
            setShowAddForm(false);
        } catch (err: any) {
            console.error('Failed to create lease:', err);
            setError("Database error: " + err.message);
        }
    };

    const handleTerminate = async (leaseId: string) => {
        if (!confirm('Are you sure you want to terminate this lease? It will be marked as inactive and end today.')) return;

        await db.leases.update(leaseId, {
            isActive: false,
            endDate: new Date()
        });
    };

    const getUnitName = (id: string) => {
        const u = units?.find(u => u.id === id);
        return u ? `${u.unitType} ${u.unitNumber}` : 'Unknown Unit';
    };

    const getTenantName = (id: string) => {
        return tenants?.find(t => t.id === id)?.name || 'Unknown Tenant';
    };

    return (
        <div className="container main-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h1>Lease Contracts</h1>
                <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                    <Plus size={20} />
                    New Lease
                </button>
            </div>

            {showAddForm && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', borderLeft: '4px solid var(--color-primary)' }}>
                    <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-3)' }}>Create New Lease</h2>

                    {error && (
                        <div style={{ padding: '10px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertOctagon size={18} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleAddLease} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Tenant</label>
                                <select
                                    className="form-input"
                                    value={newLease.tenantId}
                                    onChange={e => setNewLease({ ...newLease, tenantId: e.target.value })}
                                    required
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                                >
                                    <option value="">Select Tenant</option>
                                    {tenants?.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Unit</label>
                                <select
                                    className="form-input"
                                    value={newLease.unitId}
                                    onChange={e => {
                                        const u = units?.find(u => u.id === e.target.value);
                                        setNewLease({
                                            ...newLease,
                                            unitId: e.target.value,
                                            rentAmount: u?.rentAmount ? u.rentAmount.toString() : ''
                                        });
                                    }}
                                    required
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                                >
                                    <option value="">Select Unit</option>
                                    {units?.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.unitType} {u.unitNumber} ({u.floor}) - {u.status}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Start Date</label>
                                <input
                                    type="date"
                                    value={newLease.startDate}
                                    onChange={e => setNewLease({ ...newLease, startDate: e.target.value })}
                                    required
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>End Date</label>
                                <input
                                    type="date"
                                    value={newLease.endDate}
                                    onChange={e => setNewLease({ ...newLease, endDate: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                    placeholder="Optional (Open-ended)"
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Monthly Rent</label>
                                <input
                                    type="number"
                                    value={newLease.rentAmount}
                                    onChange={e => setNewLease({ ...newLease, rentAmount: e.target.value })}
                                    required
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create Contract</button>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)} style={{ flex: 1 }}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {sortedLeases?.map(lease => {
                    const active = isLeaseActive(lease);
                    const stats = payments ? calculateLeaseFinancialsSync(lease, payments) : { balance: 0, expectedRent: 0, paidAmount: 0, status: 'paid' };

                    return (
                        <div key={lease.id} className="card" style={{ display: 'grid', gap: '10px', opacity: active ? 1 : 0.75 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '50%',
                                        background: active ? '#e8f5e9' : '#f5f5f5',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: active ? '#2e7d32' : '#bdbdbd'
                                    }}>
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                                            {getUnitName(lease.unitId)}
                                            <span style={{ fontWeight: 400, color: '#9e9e9e' }}> leased to </span>
                                            {getTenantName(lease.tenantId)}
                                        </h3>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                            {format(new Date(lease.startDate), 'MMM dd, yyyy')} - {lease.endDate ? format(new Date(lease.endDate), 'MMM dd, yyyy') : 'Indefinite'}
                                            {' '} • <span style={{ fontWeight: 600 }}>{lease.rentAmount.toLocaleString()} ETB</span> / mo
                                        </div>
                                        <div style={{ fontSize: '0.75rem', marginTop: '4px', fontWeight: 600, color: active ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                            {active ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} /> ACTIVE</span> : 'INACTIVE / TERMINATED'}
                                        </div>
                                    </div>
                                </div>

                                {active && (
                                    <button
                                        onClick={() => handleTerminate(lease.id)}
                                        className="btn"
                                        style={{ color: '#d32f2f', border: '1px solid #ffcdd2', background: '#ffebee', fontSize: '0.8rem', padding: '6px 12px' }}
                                        title="Terminate Lease"
                                    >
                                        Terminate
                                    </button>
                                )}
                            </div>

                            {/* Financial Stats Bar */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px',
                                background: 'var(--color-bg)', padding: '10px', borderRadius: '6px',
                                marginTop: '5px'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <TrendingUp size={12} /> Expected Rent
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{stats.expectedRent.toLocaleString()} ETB</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <TrendingDown size={12} /> Paid Amount
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-success)' }}>{stats.paidAmount.toLocaleString()} ETB</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <AlertCircle size={12} /> Balance
                                    </div>
                                    <div style={{
                                        fontWeight: 700, fontSize: '0.9rem',
                                        color: stats.balance > 0 ? '#d32f2f' : stats.balance < 0 ? '#2e7d32' : 'var(--color-text)'
                                    }}>
                                        {stats.balance > 0 ? `Due: ${stats.balance.toLocaleString()}` : stats.balance < 0 ? `Credit: ${Math.abs(stats.balance).toLocaleString()}` : 'Settled'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
                {leases?.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                        <p>No leases found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
