import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { insertLease, updateLease } from '../lib/supabaseHelpers';
import type { Database } from '../lib/database.types';
import { v4 as uuidv4 } from 'uuid';
import { Plus, FileText, CheckCircle, AlertOctagon, TrendingUp, TrendingDown, AlertCircle, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { isLeaseActive, validateNewLease } from '../lib/leaseUtils';
import { calculate30DayCycleFinancials } from '../lib/financialUtils';
import { generateBillingPeriods, getLeasePeriods, type PeriodDisplay } from '../lib/billingPeriodUtils';

type Lease = Database['public']['Tables']['leases']['Row'];
type Unit = Database['public']['Tables']['units']['Row'];
type Tenant = Database['public']['Tables']['tenants']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];
type Building = Database['public']['Tables']['buildings']['Row'];

export default function Leases() {
    const [leases, setLeases] = useState<Lease[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedLeases, setExpandedLeases] = useState<Set<string>>(new Set());
    const [leasePeriods, setLeasePeriods] = useState<Record<string, PeriodDisplay[]>>({});

    const [showAddForm, setShowAddForm] = useState(false);
    const [newLease, setNewLease] = useState({
        buildingId: '',
        floor: '',
        tenantId: '',
        unitId: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
        rentAmount: '',
        rentDueDay: '1'
    });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        setError(null);

        const [leasesRes, unitsRes, tenantsRes, paymentsRes, buildingsRes] = await Promise.all([
            supabase.from('leases').select('*').order('start_date', { ascending: false }),
            supabase.from('units').select('*'),
            supabase.from('tenants').select('*').eq('status', 'active'),
            supabase.from('payments').select('*'),
            supabase.from('buildings').select('*').order('name')
        ]);

        if (leasesRes.error) {
            setError(leasesRes.error.message);
        } else if (unitsRes.error) {
            setError(unitsRes.error.message);
        } else if (tenantsRes.error) {
            setError(tenantsRes.error.message);
        } else if (paymentsRes.error) {
            setError(paymentsRes.error.message);
        } else if (buildingsRes.error) {
            setError(buildingsRes.error.message);
        } else {
            setLeases(leasesRes.data || []);
            setUnits(unitsRes.data || []);
            setTenants(tenantsRes.data || []);
            setPayments(paymentsRes.data || []);
            setBuildings(buildingsRes.data || []);
        }

        setLoading(false);
    }

    // Sort leases: Active first, then by date
    const sortedLeases = [...leases].sort((a, b) => {
        const aActive = isLeaseActive(a);
        const bActive = isLeaseActive(b);
        if (aActive === bActive) {
            return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        }
        return aActive ? -1 : 1;
    });

    // Derive available floors from units in selected building
    const availableFloors = React.useMemo(() => {
        if (!newLease.buildingId) return [];
        
        const floorsSet = new Set(
            units
                .filter(u => u.building_id === newLease.buildingId)
                .map(u => u.floor)
        );
        
        return Array.from(floorsSet).sort((a, b) => {
            if (a === 'G') return -1;
            if (b === 'G') return 1;
            return parseInt(a) - parseInt(b);
        });
    }, [units, newLease.buildingId]);

    // Derive available units (filtered by building + floor + vacancy)
    const availableUnits = React.useMemo(() => {
        if (!newLease.buildingId || !newLease.floor) return [];
        
        return units.filter(u => {
            // Match building and floor
            if (u.building_id !== newLease.buildingId) return false;
            if (u.floor !== newLease.floor) return false;
            
            // Check if unit has active lease
            const hasActiveLease = leases.some(l => 
                l.unit_id === u.id && isLeaseActive(l)
            );
            
            return !hasActiveLease; // Only vacant units
        });
    }, [units, leases, newLease.buildingId, newLease.floor]);

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
        const unit = units.find(u => u.id === newLease.unitId);
        if (!unit) {
            setError("Selected unit not found.");
            return;
        }

        try {
            const leaseId = uuidv4();
            const leaseData = {
                id: leaseId,
                tenant_id: newLease.tenantId,
                unit_id: newLease.unitId,
                start_date: newLease.startDate,
                end_date: newLease.endDate || null,
                rent_amount: parseFloat(newLease.rentAmount),
                pricing_type: unit.rent_pricing_type,
                size_sqm: unit.size_sqm,
                rent_due_day: parseInt(newLease.rentDueDay),
                is_active: true
            };

            const { error: insertError } = await insertLease(leaseData);

            if (insertError) {
                console.error('Failed to create lease:', insertError);
                setError("Database error: " + insertError.message);
            } else {
                // Generate billing periods for the new lease
                try {
                    await generateBillingPeriods(leaseData as Lease);
                    console.log('Billing periods generated successfully');
                } catch (periodError) {
                    console.error('Failed to generate billing periods:', periodError);
                    setError("Lease created but failed to generate billing periods. Please refresh and try again.");
                }

                setNewLease({
                    buildingId: '',
                    floor: '',
                    tenantId: '',
                    unitId: '',
                    startDate: format(new Date(), 'yyyy-MM-dd'),
                    endDate: '',
                    rentAmount: '',
                    rentDueDay: '1'
                });
                setShowAddForm(false);
                fetchData();
            }
        } catch (err: any) {
            console.error('Failed to create lease:', err);
            setError("Database error: " + err.message);
        }
    };

    const handleTerminate = async (leaseId: string) => {
        if (!confirm('Are you sure you want to terminate this lease? It will be marked as inactive and end today.')) return;

        const { error: updateError } = await updateLease(leaseId, {
            is_active: false,
            end_date: new Date().toISOString()
        });

        if (updateError) {
            console.error('Failed to terminate lease:', updateError);
            setError(updateError.message);
        } else {
            fetchData();
        }
    };

    const getUnitName = (id: string) => {
        const u = units.find(u => u.id === id);
        return u ? `${u.unit_type} ${u.unit_number}` : 'Unknown Unit';
    };

    const getTenantName = (id: string) => {
        return tenants.find(t => t.id === id)?.name || 'Unknown Tenant';
    };

    const togglePeriodsExpanded = async (leaseId: string) => {
        const newExpanded = new Set(expandedLeases);
        if (newExpanded.has(leaseId)) {
            newExpanded.delete(leaseId);
        } else {
            newExpanded.add(leaseId);
            // Fetch periods if not already loaded
            if (!leasePeriods[leaseId]) {
                const periods = await getLeasePeriods(leaseId);
                setLeasePeriods(prev => ({ ...prev, [leaseId]: periods }));
            }
        }
        setExpandedLeases(newExpanded);
    };

    if (loading) {
        return (
            <div className="container main-content">
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    Loading leases...
                </div>
            </div>
        );
    }

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
                                    {tenants.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Building</label>
                                <select
                                    className="form-input"
                                    value={newLease.buildingId}
                                    onChange={e => {
                                        setNewLease({ 
                                            ...newLease, 
                                            buildingId: e.target.value,
                                            floor: '',
                                            unitId: '',
                                            rentAmount: ''
                                        });
                                    }}
                                    required
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                                >
                                    <option value="">Select Building</option>
                                    {buildings.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Floor</label>
                                <select
                                    className="form-input"
                                    value={newLease.floor}
                                    onChange={e => {
                                        setNewLease({ 
                                            ...newLease, 
                                            floor: e.target.value,
                                            unitId: '',
                                            rentAmount: ''
                                        });
                                    }}
                                    required
                                    disabled={!newLease.buildingId}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                                >
                                    <option value="">Select Floor</option>
                                    {availableFloors.map(f => (
                                        <option key={f} value={f}>Floor {f}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Unit</label>
                                <select
                                    className="form-input"
                                    value={newLease.unitId}
                                    onChange={e => {
                                        const u = units.find(u => u.id === e.target.value);
                                        setNewLease({
                                            ...newLease,
                                            unitId: e.target.value,
                                            rentAmount: u?.rent_amount ? u.rent_amount.toString() : ''
                                        });
                                    }}
                                    required
                                    disabled={!newLease.floor}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                                >
                                    <option value="">Select Unit</option>
                                    {availableUnits.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.unit_type} {u.unit_number} - {u.rent_amount || 0} ETB
                                        </option>
                                    ))}
                                </select>
                                {availableUnits.length === 0 && newLease.floor && (
                                    <div style={{ color: 'orange', fontSize: '0.85rem', marginTop: '4px' }}>
                                        No vacant units on this floor
                                    </div>
                                )}
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
                {sortedLeases.map(lease => {
                    const active = isLeaseActive(lease);
                    const stats = calculate30DayCycleFinancials(lease, payments);

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
                                            {getUnitName(lease.unit_id)}
                                            <span style={{ fontWeight: 400, color: '#9e9e9e' }}> leased to </span>
                                            {getTenantName(lease.tenant_id)}
                                        </h3>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                            {format(new Date(lease.start_date), 'MMM dd, yyyy')} - {lease.end_date ? format(new Date(lease.end_date), 'MMM dd, yyyy') : 'Indefinite'}
                                            {' '} • <span style={{ fontWeight: 600 }}>{lease.rent_amount.toLocaleString()} ETB</span> / mo
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

                            {/* Financial Stats Bar - 30-Day Cycle */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px',
                                background: 'var(--color-bg)', padding: '10px', borderRadius: '6px',
                                marginTop: '5px'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <TrendingUp size={12} /> Expected Rent
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{stats.expectedRent.toLocaleString()} ETB</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                                        {stats.completePeriods} period(s)
                                    </div>
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
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                        Next Due
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                        {format(stats.nextDueDate, 'MMM dd, yyyy')}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: stats.isOverdue ? '#d32f2f' : 'var(--color-text-muted)' }}>
                                        {stats.isOverdue 
                                            ? `${stats.daysOverdue} days overdue`
                                            : `in ${stats.daysUntilNextDue} days`
                                        }
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic', marginTop: '4px' }}>
                                ℹ️ Rent is calculated in 30-day cycles from lease start
                            </div>

                            {/* Billing Periods Section */}
                            <div style={{ marginTop: '10px', borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
                                <button
                                    onClick={() => togglePeriodsExpanded(lease.id)}
                                    className="btn btn-secondary"
                                    style={{ 
                                        width: '100%', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        padding: '8px 12px',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Calendar size={14} />
                                        Billing Periods History
                                    </span>
                                    {expandedLeases.has(lease.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>

                                {expandedLeases.has(lease.id) && (
                                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {leasePeriods[lease.id] ? (
                                            leasePeriods[lease.id].length > 0 ? (
                                                leasePeriods[lease.id].map(period => (
                                                    <div 
                                                        key={period.id} 
                                                        style={{ 
                                                            padding: '8px 12px', 
                                                            background: 'var(--color-bg)', 
                                                            borderRadius: '4px',
                                                            borderLeft: `3px solid ${
                                                                period.status === 'paid' ? 'var(--color-success)' :
                                                                period.status === 'overdue' ? '#d32f2f' :
                                                                period.status === 'partial' ? '#ed6c02' :
                                                                'var(--color-border)'
                                                            }`,
                                                            fontSize: '0.8rem'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div>
                                                                <span style={{ fontWeight: 600 }}>Period {period.periodNumber}</span>
                                                                <span style={{ color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                                                                    {format(period.startDate, 'MMM dd')} - {format(period.endDate, 'MMM dd, yyyy')}
                                                                </span>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <div style={{ fontWeight: 600 }}>
                                                                    {period.paidAmount.toLocaleString()} / {period.expectedAmount.toLocaleString()} ETB
                                                                </div>
                                                                {period.status === 'paid' && (
                                                                    <div style={{ color: 'var(--color-success)', fontSize: '0.75rem' }}>✓ Paid</div>
                                                                )}
                                                                {period.status === 'partial' && (
                                                                    <div style={{ color: '#ed6c02', fontSize: '0.75rem' }}>
                                                                        ⚠ Outstanding: {period.outstandingAmount.toLocaleString()} ETB
                                                                    </div>
                                                                )}
                                                                {period.status === 'overdue' && (
                                                                    <div style={{ color: '#d32f2f', fontSize: '0.75rem' }}>
                                                                        ⚠ Overdue: {period.outstandingAmount.toLocaleString()} ETB
                                                                    </div>
                                                                )}
                                                                {period.status === 'unpaid' && (
                                                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>⏳ Unpaid</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                                    No billing periods generated yet
                                                </div>
                                            )
                                        ) : (
                                            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                                Loading periods...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
                {leases.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                        <p>No leases found.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
