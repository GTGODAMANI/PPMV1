import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Plus, ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import EmptyState from '../components/EmptyState';

export default function Financials() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'payments' | 'expenses'>('payments');

    // Queries
    const payments = useLiveQuery(() => db.payments.toArray());
    const expenses = useLiveQuery(() => db.expenses.toArray());
    const tenants = useLiveQuery(() => db.tenants.toArray());

    // Financial calculations
    const totalRevenue = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    const totalExpenses = expenses?.filter(e => e.status === 'approved' || e.status === 'paid').reduce((sum, e) => sum + e.amount, 0) || 0;
    const netIncome = totalRevenue - totalExpenses;

    // Form States - Payment
    const [newPayment, setNewPayment] = useState({
        tenantId: '',
        amount: '',
        type: 'rent' as const,
        method: 'cash' as const,
        reference: ''
    });

    // Form States - Expense
    const [newExpense, setNewExpense] = useState({
        category: '',
        description: '',
        amount: '',
        vendor: '',
        reason: '',
        paidBy: 'Owner',
        requestedBy: '', // New Field
        approvedBy: '',  // New Field
        deductedFromRent: false,
        status: 'paid' as const
    });

    const [showForm, setShowForm] = useState(false);

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPayment.tenantId || !newPayment.amount) return;

        const tenant = await db.tenants.get(newPayment.tenantId);
        if (!tenant) return;

        // Find active lease to get Unit ID
        const activeLease = await db.leases.where({ tenantId: tenant.id, isActive: true }).first() ||
            await db.leases.where({ tenantId: tenant.id }).last(); // Fallback to any lease

        if (!activeLease) {
            alert("This tenant does not have an active lease/unit assigned.");
            return;
        }

        try {
            await db.payments.add({
                id: uuidv4(),
                tenantId: newPayment.tenantId,
                unitId: activeLease.unitId,
                leaseId: activeLease.id,
                amount: parseFloat(newPayment.amount),
                date: new Date(),
                type: newPayment.type,
                method: newPayment.method,
                reference: newPayment.reference,
                inputDate: Date.now(),
                synced: false
            });
            // NOTE: We do NOT update tenant balance here. It's derived dynamically.

            setNewPayment({ tenantId: '', amount: '', type: 'rent', method: 'cash', reference: '' });
            setShowForm(false);
        } catch (error) {
            console.error('Payment failed:', error);
        }
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newExpense.amount || !newExpense.category) return;

        try {
            await db.expenses.add({
                id: uuidv4(),
                category: newExpense.category,
                description: newExpense.description,
                amount: parseFloat(newExpense.amount),
                date: new Date(),
                vendor: newExpense.vendor,
                reason: newExpense.reason,
                paidBy: newExpense.paidBy,
                requestedByUserId: newExpense.requestedBy, // Storing as string for now
                approvedByUserId: newExpense.approvedBy,   // Storing as string for now
                status: newExpense.status,
                deductedFromRent: newExpense.deductedFromRent,
                synced: false
            });
            setNewExpense({
                category: '', description: '', amount: '', vendor: '', reason: '',
                paidBy: 'Owner', requestedBy: '', approvedBy: '', deductedFromRent: false, status: 'paid'
            });
            setShowForm(false);
        } catch (error) {
            console.error('Expense failed:', error);
        }
    };

    const getTenantName = (id: string) => {
        return tenants?.find(t => t.id === id)?.name || 'Unknown';
    };

    return (
        <div className="container main-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h1>{t('financials')}</h1>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    <Plus size={20} />
                    {activeTab === 'payments' ? 'Record Payment' : 'Add Expense'}
                </button>
            </div>

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
            {showForm && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
                    <h3 style={{ marginBottom: 'var(--space-3)' }}>{activeTab === 'payments' ? 'New Payment' : 'New Expense'}</h3>
                    {activeTab === 'payments' ? (
                        <form onSubmit={handleAddPayment} style={{ display: 'grid', gap: 'var(--space-3)' }}>
                            <select
                                value={newPayment.tenantId}
                                onChange={e => setNewPayment({ ...newPayment, tenantId: e.target.value })}
                                required
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                            >
                                <option value="">Select Tenant</option>
                                {tenants?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <input
                                type="number" placeholder="Amount"
                                value={newPayment.amount}
                                onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
                                required
                                style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <select
                                    value={newPayment.method}
                                    onChange={e => setNewPayment({ ...newPayment, method: e.target.value as any })}
                                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                >
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="check">Check</option>
                                    <option value="other">Other / In-Kind</option>
                                </select>
                                <input
                                    placeholder="Ref # (Optional)"
                                    value={newPayment.reference}
                                    onChange={e => setNewPayment({ ...newPayment, reference: e.target.value })}
                                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                                />
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

            {/* Lists */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {activeTab === 'payments' ? (
                    !payments ? <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div> :
                        payments.length === 0 ? (
                            <EmptyState
                                title="No Payments Records"
                                description="Keep track of all rent collected. Record your first payment to see it here."
                                icon={ArrowDownLeft}
                                actionLabel="Record Payment"
                                onAction={() => setShowForm(true)}
                            />
                        ) :
                            payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(p => (
                                <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <div style={{ background: 'hsla(145, 65%, 40%, 0.1)', padding: '10px', borderRadius: '50%' }}>
                                            <ArrowDownLeft size={20} color="var(--color-success)" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>{getTenantName(p.tenantId)}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                                {format(p.date, 'MMM d, yyyy')} • {p.method.replace('_', ' ')} {p.reference ? `#${p.reference}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                                        +{p.amount.toLocaleString()} ETB
                                    </div>
                                </div>
                            ))
                ) : (
                    !expenses ? <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div> :
                        expenses.length === 0 ? (
                            <EmptyState
                                title="No Expenses Logged"
                                description="Track maintenance costs, utilities, and other expenses. Add an expense to get started."
                                icon={ArrowUpRight}
                                actionLabel="Add Expense"
                                onAction={() => setShowForm(true)}
                            />
                        ) :
                            expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(e => (
                                <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        <div style={{ background: 'hsla(350, 60%, 45%, 0.1)', padding: '10px', borderRadius: '50%' }}>
                                            <ArrowUpRight size={20} color="var(--color-danger)" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>
                                                {e.category}
                                                <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '8px' }}>
                                                    {e.deductedFromRent && '(Rent Deduction)'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                                                {e.description}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                                {format(e.date, 'MMM d, yyyy')} • {e.vendor ? `To: ${e.vendor}` : ''}
                                                {e.requestedByUserId && ` • Req: ${e.requestedByUserId}`}
                                                {e.approvedByUserId && ` • Appr: ${e.approvedByUserId}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: 'var(--color-danger)' }}>
                                        -{e.amount.toLocaleString()} ETB
                                    </div>
                                </div>
                            ))
                )}
            </div>
        </div>
    );
}
