import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { insertPayment, insertExpense } from '../lib/supabaseHelpers';
import type { Database } from '../lib/database.types';
import { v4 as uuidv4 } from 'uuid';
import { Plus, ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, DollarSign, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import EmptyState from '../components/EmptyState';
import { getUnpaidPeriods, type PeriodDisplay } from '../lib/billingPeriodUtils';

type Payment = Database['public']['Tables']['payments']['Row'];
type Expense = Database['public']['Tables']['expenses']['Row'];
type Tenant = Database['public']['Tables']['tenants']['Row'];
type Lease = Database['public']['Tables']['leases']['Row'];
type Unit = Database['public']['Tables']['units']['Row'];

export default function Financials() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'payments' | 'expenses'>('payments');

    const [payments, setPayments] = useState<Payment[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [leases, setLeases] = useState<Lease[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [newPayment, setNewPayment] = useState({
        tenantId: '',
        leaseId: '',
        periodId: '',
        amount: '',
        type: 'rent' as const,
        method: 'cash' as const,
        date: format(new Date(), 'yyyy-MM-dd'),
        reference: ''
    });

    const [availablePeriods, setAvailablePeriods] = useState<PeriodDisplay[]>([]);

    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [editPaymentData, setEditPaymentData] = useState({
        amount: '',
        date: '',
        method: 'cash' as import('../lib/database.types').PaymentMethod,
        type: 'rent' as import('../lib/database.types').PaymentType,
        reference: ''
    });

    const [newExpense, setNewExpense] = useState({
        category: '',
        description: '',
        amount: '',
        vendor: '',
        reason: '',
        paidBy: 'Owner',
        requestedBy: '',
        approvedBy: '',
        deductedFromRent: false,
        status: 'paid' as const
    });

    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [editExpenseData, setEditExpenseData] = useState({
        category: '',
        description: '',
        amount: '',
        date: '',
        vendor: '',
        reason: '',
        paidBy: '',
        status: 'paid' as import('../lib/database.types').ExpenseStatus,
        deductedFromRent: false
    });

    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        setError(null);

        const [paymentsRes, expensesRes, tenantsRes, leasesRes, unitsRes] = await Promise.all([
            supabase.from('payments').select('*').order('date', { ascending: false }),
            supabase.from('expenses').select('*').order('date', { ascending: false }),
            supabase.from('tenants').select('*'),
            supabase.from('leases').select('*'),
            supabase.from('units').select('*')
        ]);

        if (paymentsRes.error) {
            setError(paymentsRes.error.message);
        } else if (expensesRes.error) {
            setError(expensesRes.error.message);
        } else if (tenantsRes.error) {
            setError(tenantsRes.error.message);
        } else if (leasesRes.error) {
            setError(leasesRes.error.message);
        } else if (unitsRes.error) {
            setError(unitsRes.error.message);
        } else {
            setPayments(paymentsRes.data || []);
            setExpenses(expensesRes.data || []);
            setTenants(tenantsRes.data || []);
            setLeases(leasesRes.data || []);
            setUnits(unitsRes.data || []);
        }

        setLoading(false);
    }

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalExpenses = expenses.filter(e => e.status === 'approved' || e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    // Derive tenant's leases for payment form
    const tenantLeases = useMemo(() => {
        if (!newPayment.tenantId) return [];
        
        return leases
            .filter(l => l.tenant_id === newPayment.tenantId)
            .sort((a, b) => {
                // Active first
                if (a.is_active && !b.is_active) return -1;
                if (!a.is_active && b.is_active) return 1;
                // Then by start date (newest first)
                return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
            });
    }, [leases, newPayment.tenantId]);

    // Get unit info for selected lease
    const selectedLeaseUnit = useMemo(() => {
        if (!newPayment.leaseId) return null;
        const lease = leases.find(l => l.id === newPayment.leaseId);
        if (!lease) return null;
        const unit = units.find(u => u.id === lease.unit_id);
        return unit;
    }, [newPayment.leaseId, leases, units]);

    // Fetch unpaid periods when lease is selected
    useEffect(() => {
        if (newPayment.leaseId) {
            getUnpaidPeriods(newPayment.leaseId).then(periods => {
                setAvailablePeriods(periods);
            });
        } else {
            setAvailablePeriods([]);
        }
    }, [newPayment.leaseId]);

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newPayment.tenantId || !newPayment.leaseId || !newPayment.amount) {
            setError("Please fill in all required fields including lease selection");
            return;
        }

        const lease = leases.find(l => l.id === newPayment.leaseId);
        if (!lease) {
            setError("Selected lease not found");
            return;
        }

        try {
            const { error: insertError } = await insertPayment({
                id: uuidv4(),
                tenant_id: newPayment.tenantId,
                unit_id: lease.unit_id,
                lease_id: newPayment.leaseId,
                period_id: newPayment.periodId || null,
                amount: parseFloat(newPayment.amount),
                date: newPayment.date,
                type: newPayment.type,
                method: newPayment.method,
                reference: newPayment.reference || null,
                input_date: Date.now(),
                synced: false
            });

            if (insertError) {
                console.error('Payment failed:', insertError);
                setError(insertError.message);
            } else {
                setNewPayment({ 
                    tenantId: '', 
                    leaseId: '',
                    periodId: '',
                    amount: '', 
                    type: 'rent', 
                    method: 'cash', 
                    date: format(new Date(), 'yyyy-MM-dd'),
                    reference: '' 
                });
                setAvailablePeriods([]);
                setShowForm(false);
                fetchData();
            }
        } catch (error) {
            console.error('Payment failed:', error);
        }
    };

    const handleUpdatePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPayment) return;

        try {
            const { error: updateError } = await (supabase as any)
                .from('payments')
                .update({
                    amount: parseFloat(editPaymentData.amount),
                    date: editPaymentData.date,
                    method: editPaymentData.method,
                    type: editPaymentData.type,
                    reference: editPaymentData.reference || null
                })
                .eq('id', editingPayment.id);

            if (updateError) {
                console.error('Payment update failed:', updateError);
                setError(updateError.message);
            } else {
                setEditingPayment(null);
                setEditPaymentData({ amount: '', date: '', method: 'cash', type: 'rent', reference: '' });
                fetchData();
            }
        } catch (error) {
            console.error('Payment update failed:', error);
        }
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newExpense.amount || !newExpense.category) return;

        try {
            const { error: insertError } = await insertExpense({
                id: uuidv4(),
                category: newExpense.category,
                description: newExpense.description,
                amount: parseFloat(newExpense.amount),
                date: new Date().toISOString(),
                vendor: newExpense.vendor || null,
                reason: newExpense.reason || null,
                paid_by: newExpense.paidBy || null,
                requested_by_user_id: newExpense.requestedBy || null,
                approved_by_user_id: newExpense.approvedBy || null,
                status: newExpense.status,
                deducted_from_rent: newExpense.deductedFromRent,
                synced: false
            });

            if (insertError) {
                console.error('Expense failed:', insertError);
                setError(insertError.message);
            } else {
                setNewExpense({
                    category: '', description: '', amount: '', vendor: '', reason: '',
                    paidBy: 'Owner', requestedBy: '', approvedBy: '', deductedFromRent: false, status: 'paid'
                });
                setShowForm(false);
                fetchData();
            }
        } catch (error) {
            console.error('Expense failed:', error);
        }
    };

    const handleUpdateExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingExpense) return;

        try {
            const { error: updateError } = await (supabase as any)
                .from('expenses')
                .update({
                    category: editExpenseData.category,
                    description: editExpenseData.description,
                    amount: parseFloat(editExpenseData.amount),
                    date: editExpenseData.date,
                    vendor: editExpenseData.vendor || null,
                    paid_by: editExpenseData.paidBy || null,
                    reason: editExpenseData.reason || null,
                    status: editExpenseData.status,
                    deducted_from_rent: editExpenseData.deductedFromRent
                })
                .eq('id', editingExpense.id);

            if (updateError) {
                console.error('Expense update failed:', updateError);
                setError(updateError.message);
            } else {
                setEditingExpense(null);
                setEditExpenseData({
                    category: '', description: '', amount: '', date: '', vendor: '',
                    reason: '', paidBy: '', status: 'paid', deductedFromRent: false
                });
                fetchData();
            }
        } catch (error) {
            console.error('Expense update failed:', error);
        }
    };

    const getTenantName = (id: string) => {
        return tenants.find(t => t.id === id)?.name || 'Unknown';
    };

    if (loading) {
        return (
            <div className="container main-content">
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    Loading financials...
                </div>
            </div>
        );
    }

    return (
        <div className="container main-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h1>{t('financials')}</h1>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    <Plus size={20} />
                    {activeTab === 'payments' ? 'Record Payment' : 'Add Expense'}
                </button>
            </div>

            {error && (
                <div style={{ padding: '10px', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '10px' }}>
                    Error: {error}
                </div>
            )}

            {/* Financial Dashboard */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)'
            }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TrendingUp size={16} /> Total Revenue
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>
                        {totalRevenue.toLocaleString()} ETB
                    </div>
                </div>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TrendingDown size={16} /> Total Expenses
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-danger)' }}>
                        {totalExpenses.toLocaleString()} ETB
                    </div>
                </div>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid', borderColor: netIncome >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <DollarSign size={16} /> Net Income
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                        {netIncome.toLocaleString()} ETB
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <button
                    className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('payments')}
                    style={{ flex: 1 }}
                >
                    Income / Payments
                </button>
                <button
                    className={`btn ${activeTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('expenses')}
                    style={{ flex: 1 }}
                >
                    Expenses
                </button>
            </div>

            {/* Forms */}
            {showForm && !editingPayment && !editingExpense && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
                    <h3 style={{ marginBottom: 'var(--space-3)' }}>{activeTab === 'payments' ? 'New Payment' : 'New Expense'}</h3>
                    {activeTab === 'payments' ? (
                        <form onSubmit={handleAddPayment} style={{ display: 'grid', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Tenant</label>
                                <select
                                    value={newPayment.tenantId}
                                    onChange={e => setNewPayment({ ...newPayment, tenantId: e.target.value, leaseId: '', periodId: '' })}
                                    required
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                >
                                    <option value="">Select Tenant</option>
                                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Lease</label>
                                <select
                                    value={newPayment.leaseId}
                                    onChange={e => setNewPayment({ ...newPayment, leaseId: e.target.value, periodId: '' })}
                                    required
                                    disabled={!newPayment.tenantId}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                >
                                    <option value="">Select Lease</option>
                                    {tenantLeases.map(l => {
                                        const unit = units.find(u => u.id === l.unit_id);
                                        return (
                                            <option key={l.id} value={l.id}>
                                                {unit ? `${unit.unit_type} ${unit.unit_number} (Floor ${unit.floor})` : 'Unknown Unit'} - {l.rent_amount.toLocaleString()} ETB/mo - {l.is_active ? 'Active' : 'Ended'}
                                            </option>
                                        );
                                    })}
                                </select>
                                {newPayment.tenantId && tenantLeases.length === 0 && (
                                    <div style={{ color: 'orange', fontSize: '0.85rem', marginTop: '4px' }}>
                                        This tenant has no leases
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Billing Period (Optional)</label>
                                <select
                                    value={newPayment.periodId}
                                    onChange={e => setNewPayment({ ...newPayment, periodId: e.target.value })}
                                    disabled={!newPayment.leaseId}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                >
                                    <option value="">No specific period (general payment)</option>
                                    {availablePeriods.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.displayText}
                                        </option>
                                    ))}
                                </select>
                                {newPayment.leaseId && availablePeriods.length === 0 && (
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                                        All periods are fully paid
                                    </div>
                                )}
                            </div>

                            {selectedLeaseUnit && (
                                <div style={{ padding: '10px', background: 'var(--color-bg)', borderRadius: '6px', fontSize: '0.85rem' }}>
                                    <div style={{ color: 'var(--color-text-muted)' }}>Unit: {selectedLeaseUnit.unit_type} {selectedLeaseUnit.unit_number}</div>
                                    <div style={{ color: 'var(--color-text-muted)' }}>Floor: {selectedLeaseUnit.floor}</div>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Amount</label>
                                    <input
                                        type="number" 
                                        placeholder="Amount"
                                        value={newPayment.amount}
                                        onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
                                        required
                                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Date</label>
                                    <input
                                        type="date"
                                        value={newPayment.date}
                                        onChange={e => setNewPayment({ ...newPayment, date: e.target.value })}
                                        required
                                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Payment Method</label>
                                    <select
                                        value={newPayment.method}
                                        onChange={e => setNewPayment({ ...newPayment, method: e.target.value as any })}
                                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="check">Check</option>
                                        <option value="other">Other / In-Kind</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Reference # (Optional)</label>
                                    <input
                                        placeholder="Ref #"
                                        value={newPayment.reference}
                                        onChange={e => setNewPayment({ ...newPayment, reference: e.target.value })}
                                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                    />
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary">Save Payment</button>
                        </form>
                    ) : (
                        <form onSubmit={handleAddExpense} style={{ display: 'grid', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <input
                                    placeholder="Category (Maintenance, Utilities)"
                                    value={newExpense.category}
                                    onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
                                    required
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                                <input
                                    type="number" placeholder="Amount"
                                    value={newExpense.amount}
                                    onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                                    required
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                            </div>

                            <textarea
                                placeholder="Description / Reason"
                                value={newExpense.description}
                                onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                                rows={2}
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                            />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <input
                                    placeholder="Requested By (Name)"
                                    value={newExpense.requestedBy}
                                    onChange={e => setNewExpense({ ...newExpense, requestedBy: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                                <input
                                    placeholder="Approved By (Name)"
                                    value={newExpense.approvedBy}
                                    onChange={e => setNewExpense({ ...newExpense, approvedBy: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <input
                                    placeholder="Vendor / Payee"
                                    value={newExpense.vendor}
                                    onChange={e => setNewExpense({ ...newExpense, vendor: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                                <input
                                    placeholder="Paid By (e.g. Owner)"
                                    value={newExpense.paidBy}
                                    onChange={e => setNewExpense({ ...newExpense, paidBy: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                <input
                                    type="checkbox"
                                    checked={newExpense.deductedFromRent}
                                    onChange={e => setNewExpense({ ...newExpense, deductedFromRent: e.target.checked })}
                                />
                                Deducted from Rent (Informational - Does not auto-credit tenant)
                            </label>

                            <button type="submit" className="btn btn-primary">Save Expense</button>
                        </form>
                    )}
                </div>
            )}

            {/* Edit Payment Form */}
            {editingPayment && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', borderLeft: '4px solid var(--color-primary)' }}>
                    <h3 style={{ marginBottom: 'var(--space-3)' }}>Edit Payment</h3>
                    <form onSubmit={handleUpdatePayment} style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        <div style={{ padding: '10px', background: 'var(--color-bg)', borderRadius: '6px', fontSize: '0.85rem' }}>
                            <div style={{ color: 'var(--color-text-muted)' }}>Tenant: {getTenantName(editingPayment.tenant_id)}</div>
                            <div style={{ color: 'var(--color-text-muted)' }}>
                                Lease: {(() => {
                                    const lease = leases.find(l => l.id === editingPayment.lease_id);
                                    const unit = lease ? units.find(u => u.id === lease.unit_id) : null;
                                    return unit ? `${unit.unit_type} ${unit.unit_number} (Floor ${unit.floor})` : 'Unknown';
                                })()}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Amount</label>
                                <input
                                    type="number"
                                    value={editPaymentData.amount}
                                    onChange={e => setEditPaymentData({ ...editPaymentData, amount: e.target.value })}
                                    required
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Date</label>
                                <input
                                    type="date"
                                    value={editPaymentData.date}
                                    onChange={e => setEditPaymentData({ ...editPaymentData, date: e.target.value })}
                                    required
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Payment Method</label>
                                <select
                                    value={editPaymentData.method}
                                    onChange={e => setEditPaymentData({ ...editPaymentData, method: e.target.value as any })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                >
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="check">Check</option>
                                    <option value="other">Other / In-Kind</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Reference # (Optional)</label>
                                <input
                                    value={editPaymentData.reference}
                                    onChange={e => setEditPaymentData({ ...editPaymentData, reference: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Update Payment</button>
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={() => {
                                    setEditingPayment(null);
                                    setEditPaymentData({ amount: '', date: '', method: 'cash', type: 'rent', reference: '' });
                                }}
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Edit Expense Form */}
            {editingExpense && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', borderLeft: '4px solid var(--color-primary)' }}>
                    <h3 style={{ marginBottom: 'var(--space-3)' }}>Edit Expense</h3>
                    <form onSubmit={handleUpdateExpense} style={{ display: 'grid', gap: 'var(--space-3)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Category</label>
                                <input
                                    placeholder="Category (Maintenance, Utilities)"
                                    value={editExpenseData.category}
                                    onChange={e => setEditExpenseData({ ...editExpenseData, category: e.target.value })}
                                    required
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Amount</label>
                                <input
                                    type="number"
                                    placeholder="Amount"
                                    value={editExpenseData.amount}
                                    onChange={e => setEditExpenseData({ ...editExpenseData, amount: e.target.value })}
                                    required
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Date</label>
                            <input
                                type="date"
                                value={editExpenseData.date}
                                onChange={e => setEditExpenseData({ ...editExpenseData, date: e.target.value })}
                                required
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                            />
                        </div>

                        <textarea
                            placeholder="Description / Reason"
                            value={editExpenseData.description}
                            onChange={e => setEditExpenseData({ ...editExpenseData, description: e.target.value })}
                            rows={2}
                            style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Vendor / Payee</label>
                                <input
                                    placeholder="Vendor / Payee"
                                    value={editExpenseData.vendor}
                                    onChange={e => setEditExpenseData({ ...editExpenseData, vendor: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Paid By</label>
                                <input
                                    placeholder="Paid By (e.g. Owner)"
                                    value={editExpenseData.paidBy}
                                    onChange={e => setEditExpenseData({ ...editExpenseData, paidBy: e.target.value })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Status</label>
                            <select
                                value={editExpenseData.status}
                                onChange={e => setEditExpenseData({ ...editExpenseData, status: e.target.value as any })}
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                            >
                                <option value="requested">Requested</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                            <input
                                type="checkbox"
                                checked={editExpenseData.deductedFromRent}
                                onChange={e => setEditExpenseData({ ...editExpenseData, deductedFromRent: e.target.checked })}
                            />
                            Deducted from Rent (Informational - Does not auto-credit tenant)
                        </label>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Update Expense</button>
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={() => {
                                    setEditingExpense(null);
                                    setEditExpenseData({
                                        category: '', description: '', amount: '', date: '', vendor: '',
                                        reason: '', paidBy: '', status: 'paid', deductedFromRent: false
                                    });
                                }}
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Lists */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {activeTab === 'payments' ? (
                    payments.length === 0 ? (
                        <EmptyState
                            title="No Payments Records"
                            description="Keep track of all rent collected. Record your first payment to see it here."
                            icon={ArrowDownLeft}
                            actionLabel="Record Payment"
                            onAction={() => setShowForm(true)}
                        />
                    ) :
                        payments.map(p => (
                            <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
                                    <div style={{ background: 'hsla(145, 65%, 40%, 0.1)', padding: '10px', borderRadius: '50%' }}>
                                        <ArrowDownLeft size={20} color="var(--color-success)" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold' }}>{getTenantName(p.tenant_id)}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                            {format(new Date(p.date), 'MMM d, yyyy')} • {p.method.replace('_', ' ')} {p.reference ? `#${p.reference}` : ''}
                                        </div>
                                        {p.lease_id && (() => {
                                            const lease = leases.find(l => l.id === p.lease_id);
                                            const unit = lease ? units.find(u => u.id === lease.unit_id) : null;
                                            return unit ? (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                                    Lease: {unit.unit_type} {unit.unit_number} (Floor {unit.floor})
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                                        +{p.amount.toLocaleString()} ETB
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEditingPayment(p);
                                            setEditPaymentData({
                                                amount: p.amount.toString(),
                                                date: p.date,
                                                method: p.method,
                                                type: p.type,
                                                reference: p.reference || ''
                                            });
                                            setShowForm(false);
                                        }}
                                        className="btn btn-secondary"
                                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                        title="Edit Payment"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                ) : (
                    expenses.length === 0 ? (
                        <EmptyState
                            title="No Expenses Logged"
                            description="Track maintenance costs, utilities, and other expenses. Add an expense to get started."
                            icon={ArrowUpRight}
                            actionLabel="Add Expense"
                            onAction={() => setShowForm(true)}
                        />
                    ) :
                        expenses.map(e => (
                            <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
                                    <div style={{ background: 'hsla(350, 60%, 45%, 0.1)', padding: '10px', borderRadius: '50%' }}>
                                        <ArrowUpRight size={20} color="var(--color-danger)" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold' }}>
                                            {e.category}
                                            <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                                                {e.deducted_from_rent && '(Rent Deduction)'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                            {e.description}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                            {format(new Date(e.date), 'MMM d, yyyy')} • {e.vendor ? `To: ${e.vendor}` : ''}
                                            {e.requested_by_user_id && ` • Req: ${e.requested_by_user_id}`}
                                            {e.approved_by_user_id && ` • Appr: ${e.approved_by_user_id}`}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                                        -{e.amount.toLocaleString()} ETB
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEditingExpense(e);
                                            setEditExpenseData({
                                                category: e.category,
                                                description: e.description || '',
                                                amount: e.amount.toString(),
                                                date: e.date,
                                                vendor: e.vendor || '',
                                                reason: e.reason || '',
                                                paidBy: e.paid_by || '',
                                                status: e.status,
                                                deductedFromRent: e.deducted_from_rent
                                            });
                                            setShowForm(false);
                                        }}
                                        className="btn btn-secondary"
                                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                        title="Edit Expense"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                )}
            </div>
        </div>
    );
}
