import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { calculatePeriodExpectedRent } from '../lib/financialUtils';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { TrendingUp, TrendingDown, DollarSign, Calendar, AlertCircle, Filter, X } from 'lucide-react';


export default function Reports() {
    const { t } = useTranslation();

    // Filters State
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [selectedUnitType, setSelectedUnitType] = useState<string>('all');
    const [paymentStatus, setPaymentStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
    const [selectedFloor, setSelectedFloor] = useState<string>('all');

    const leases = useLiveQuery(() => db.leases.toArray());
    const payments = useLiveQuery(() => db.payments.toArray());
    const expenses = useLiveQuery(() => db.expenses.toArray());
    const units = useLiveQuery(() => db.units.toArray());
    const tenants = useLiveQuery(() => db.tenants.toArray());

    if (!leases || !payments || !expenses || !units || !tenants) return <div>Loading...</div>;

    // --- Calculation Logic ---
    const start = new Date(startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(endDate); end.setHours(23, 59, 59, 999);

    // 1. Filter Units first (Structural Filter)
    const availableFloors = Array.from(new Set(units.map(u => u.floor))).sort();


    const filteredUnits = units.filter(u => {
        if (selectedUnitType !== 'all' && u.unitType !== selectedUnitType) return false;
        if (selectedFloor !== 'all' && u.floor !== selectedFloor) return false;
        return true;
    });
    const filteredUnitIds = new Set(filteredUnits.map(u => u.id));

    // 2. Calculate Financials PER LEASE first (to support Status filter)
    // We only care about leases linked to our filtered units
    const relevantLeases = leases.filter(l => filteredUnitIds.has(l.unitId));

    const leaseStats = relevantLeases.map(lease => {
        // Expected Rent (Daily Accrual)
        const expected = calculatePeriodExpectedRent([lease], start, end);

        // Collected Rent (Payments in range)
        const collected = payments
            .filter(p => p.leaseId === lease.id && p.type === 'rent' && p.date >= start && p.date <= end)
            .reduce((sum, p) => sum + p.amount, 0);

        const outstanding = expected - collected;

        return {
            lease,
            expected,
            collected,
            outstanding,
            isPaid: outstanding <= 1, // Epsilon
            isUnpaid: outstanding > 1
        };
    });

    // 3. Apply Payment Status Filter
    const finalLeaseStats = leaseStats.filter(stat => {
        // Optimization: If range has no expected rent and no payments, ignore?
        // Maybe, but "Paid" filter usually implies "Fully Settled" or "No Debt".
        // Let's stick to explicit choice.

        if (paymentStatus === 'paid') return stat.isPaid;
        if (paymentStatus === 'unpaid') return stat.isUnpaid;
        return true;
    });

    // 4. Aggregate Totals
    const totalExpected = finalLeaseStats.reduce((sum, s) => sum + s.expected, 0);
    const totalCollected = finalLeaseStats.reduce((sum, s) => sum + s.collected, 0);
    const totalOutstanding = totalExpected - totalCollected;

    // Expenses (Global within date range, optionally could filter by unit if data allowed, but currently global)
    // If strict unit filter is on, expenses might be misleading if they aren't linked.
    // For now, we show Accrued Expenses for the period globally, unless we want to hide them when unit filters are active?
    // Let's show them but maybe add a note? Or just show global. The user asked for "Expenses inside range".
    const totalExpenses = expenses
        .filter(e => (e.status === 'approved' || e.status === 'paid') && e.date >= start && e.date <= end)
        .reduce((sum, e) => sum + e.amount, 0);

    const netIncome = totalCollected - totalExpenses;

    // --- Occupancy Stats (Snapshot at END of range) ---
    // Only consider units passing the Unit/Floor filters
    const activeLeasesAtEnd = leases.filter(l => {
        const leaseStart = new Date(l.startDate); leaseStart.setHours(0, 0, 0, 0);
        const leaseEnd = l.endDate ? new Date(l.endDate) : null; if (leaseEnd) leaseEnd.setHours(23, 59, 59, 999);
        return leaseStart <= end && (!leaseEnd || leaseEnd >= end);
    });
    const occupiedUnitIds = new Set(activeLeasesAtEnd.map(l => l.unitId));

    // Count ONLY from filteredUnits
    const occupiedCount = filteredUnits.filter(u => occupiedUnitIds.has(u.id)).length;
    const totalFilteredUnits = filteredUnits.length;
    const vacantCount = totalFilteredUnits - occupiedCount;
    const occupancyRate = totalFilteredUnits > 0 ? ((occupiedCount / totalFilteredUnits) * 100).toFixed(1) : '0';

    return (
        <div className="container main-content">
            <h1 style={{ marginBottom: 'var(--space-4)' }}>{t('Owner Reports')}</h1>

            {/* Advanced Filters */}
            <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontWeight: 600 }}>
                    <Filter size={18} /> Report Filters
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                    {/* Dates */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--color-border)', padding: '4px 8px', borderRadius: '6px' }}>
                        <Calendar size={16} />
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ border: 'none', background: 'transparent' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ border: 'none', background: 'transparent' }} />
                    </div>

                    {/* Unit Type */}
                    <select
                        value={selectedUnitType}
                        onChange={e => setSelectedUnitType(e.target.value)}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                    >
                        <option value="all">All Unit Types</option>
                        <option value="shop">Shop</option>
                        <option value="apartment">Apartment</option>
                        <option value="office">Office</option>
                        <option value="store">Store</option>
                    </select>

                    {/* Floor */}
                    <select
                        value={selectedFloor}
                        onChange={e => setSelectedFloor(e.target.value)}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                    >
                        <option value="all">All Floors</option>
                        {availableFloors.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>

                    {/* Payment Status */}
                    <select
                        value={paymentStatus}
                        onChange={e => setPaymentStatus(e.target.value as any)}
                        style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                    >
                        <option value="all">All Payment Status</option>
                        <option value="paid">Fully Paid</option>
                        <option value="unpaid">Unpaid / Outstanding</option>
                    </select>

                    {/* Clear Button */}
                    <button
                        onClick={() => { setSelectedUnitType('all'); setSelectedFloor('all'); setPaymentStatus('all'); }}
                        className="btn btn-sm"
                        style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}
                    >
                        <X size={16} /> Clear Filters
                    </button>
                </div>
            </div>

            {/* Financial Summary */}
            <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)' }}>Period Financials</h2>
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)',
                marginBottom: 'var(--space-6)'
            }}>
                {/* Expected */}
                <div className="card">
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Expected Rent (Daily Accrual)</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{Math.round(totalExpected).toLocaleString()} ETB</div>
                </div>

                {/* Collected */}
                <div className="card">
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px' }}>
                        <TrendingUp size={16} color="var(--color-success)" /> Collected Rent
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-success)' }}>{totalCollected.toLocaleString()} ETB</div>
                </div>

                {/* Outstanding */}
                <div className="card">
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px' }}>
                        <AlertCircle size={16} color="#ed6c02" /> Outstanding (Period)
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: totalOutstanding > 10 ? '#ed6c02' : 'var(--color-text-muted)' }}>
                        {Math.round(totalOutstanding).toLocaleString()} ETB
                    </div>
                </div>

                {/* Expenses */}
                <div className="card">
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px' }}>
                        <TrendingDown size={16} color="var(--color-danger)" /> Period Expenses
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-danger)' }}>{totalExpenses.toLocaleString()} ETB</div>
                </div>

                {/* Net Income */}
                <div className="card" style={{ borderTop: `4px solid ${netIncome >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}` }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', gap: '6px' }}>
                        <DollarSign size={16} /> Net Income
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{netIncome.toLocaleString()} ETB</div>
                </div>
            </div>

            {/* Occupancy Stats */}
            <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)' }}>Occupancy (Filtered Units)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-4)' }}>
                    <div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)' }}>{occupancyRate}%</div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Occupancy Rate</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600 }}>{occupiedCount} Occupied</div>
                        <div style={{ color: 'var(--color-text-muted)' }}>{vacantCount} Vacant</div>
                        <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Total: {totalFilteredUnits} Units</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
