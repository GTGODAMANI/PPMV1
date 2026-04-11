import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { TrendingUp, TrendingDown, DollarSign, Calendar, AlertCircle, Filter, X } from 'lucide-react';

type Lease = Database['public']['Tables']['leases']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];
type Expense = Database['public']['Tables']['expenses']['Row'];
type Unit = Database['public']['Tables']['units']['Row'];

export default function Reports() {
    const { t } = useTranslation();

    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [selectedUnitType, setSelectedUnitType] = useState<string>('all');
    const [paymentStatus, setPaymentStatus] = useState<'all' | 'paid' | 'unpaid'>('all');
    const [selectedFloor, setSelectedFloor] = useState<string>('all');

    const [leases, setLeases] = useState<Lease[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);

        const [leasesRes, paymentsRes, expensesRes, unitsRes] = await Promise.all([
            supabase.from('leases').select('*'),
            supabase.from('payments').select('*'),
            supabase.from('expenses').select('*'),
            supabase.from('units').select('*')
        ]);

        if (leasesRes.data) setLeases(leasesRes.data);
        if (paymentsRes.data) setPayments(paymentsRes.data);
        if (expensesRes.data) setExpenses(expensesRes.data);
        if (unitsRes.data) setUnits(unitsRes.data);

        setLoading(false);
    }

    if (loading) {
        return (
            <div className="container main-content">
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    Loading reports...
                </div>
            </div>
        );
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const availableFloors = Array.from(new Set(units.map(u => u.floor))).sort();

    const filteredUnits = units.filter(u => {
        if (selectedUnitType !== 'all' && u.unit_type !== selectedUnitType) return false;
        if (selectedFloor !== 'all' && u.floor !== selectedFloor) return false;
        return true;
    });
    const filteredUnitIds = new Set(filteredUnits.map(u => u.id));

    const relevantLeases = leases.filter(l => filteredUnitIds.has(l.unit_id));

    const leaseStats = relevantLeases.map(lease => {
        const leaseStart = new Date(lease.start_date);
        leaseStart.setHours(0, 0, 0, 0);
        const leaseEnd = lease.end_date ? new Date(lease.end_date) : null;
        if (leaseEnd) leaseEnd.setHours(23, 59, 59, 999);
        
        // Calculate overlap between lease period and report period
        const periodStart = leaseStart > start ? leaseStart : start;
        const periodEnd = (leaseEnd && leaseEnd < end) ? leaseEnd : end;
        
        let expected = 0;
        if (periodStart <= periodEnd) {
            // Calculate days in the report period that the lease was active
            const daysInPeriod = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            // Calculate expected rent based on 30-day cycles
            const completePeriods = Math.floor(daysInPeriod / 30);
            expected = completePeriods * lease.rent_amount;
        }

        const collected = payments
            .filter(p => p.lease_id === lease.id && p.type === 'rent' && new Date(p.date) >= start && new Date(p.date) <= end)
            .reduce((sum, p) => sum + p.amount, 0);

        const outstanding = expected - collected;

        return {
            lease,
            expected,
            collected,
            outstanding,
            isPaid: outstanding <= 1,
            isUnpaid: outstanding > 1
        };
    });

    const finalLeaseStats = leaseStats.filter(stat => {
        if (paymentStatus === 'paid') return stat.isPaid;
        if (paymentStatus === 'unpaid') return stat.isUnpaid;
        return true;
    });

    const totalExpected = finalLeaseStats.reduce((sum, s) => sum + s.expected, 0);
    const totalCollected = finalLeaseStats.reduce((sum, s) => sum + s.collected, 0);
    const totalOutstanding = totalExpected - totalCollected;

    const totalExpenses = expenses
        .filter(e => (e.status === 'approved' || e.status === 'paid') && new Date(e.date) >= start && new Date(e.date) <= end)
        .reduce((sum, e) => sum + e.amount, 0);

    const netIncome = totalCollected - totalExpenses;

    const activeLeasesAtEnd = leases.filter(l => {
        const leaseStart = new Date(l.start_date);
        leaseStart.setHours(0, 0, 0, 0);
        const leaseEnd = l.end_date ? new Date(l.end_date) : null;
        if (leaseEnd) leaseEnd.setHours(23, 59, 59, 999);
        return leaseStart <= end && (!leaseEnd || leaseEnd >= end);
    });
    const occupiedUnitIds = new Set(activeLeasesAtEnd.map(l => l.unit_id));

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
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Expected Rent (30-Day Cycle)</div>
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
