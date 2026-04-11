import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { CreditCard, Home, TrendingUp, Download, AlertCircle, ArrowUpRight, ArrowDownLeft, Activity, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow, startOfMonth, endOfMonth, addMonths, subMonths, format } from 'date-fns';
import EmptyState from '../components/EmptyState';
type Payment = Database['public']['Tables']['payments']['Row'];
type Expense = Database['public']['Tables']['expenses']['Row'];
type Unit = Database['public']['Tables']['units']['Row'];
type Lease = Database['public']['Tables']['leases']['Row'];
type Maintenance = Database['public']['Tables']['maintenance']['Row'];

export default function Dashboard() {
    const { t } = useTranslation();
    const { user } = useAuth();

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [payments, setPayments] = useState<Payment[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [leases, setLeases] = useState<Lease[]>([]);
    const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);

        const [paymentsRes, expensesRes, unitsRes, leasesRes, maintenanceRes] = await Promise.all([
            supabase.from('payments').select('*'),
            supabase.from('expenses').select('*'),
            supabase.from('units').select('*'),
            supabase.from('leases').select('*'),
            supabase.from('maintenance').select('*')
        ]);

        if (paymentsRes.data) setPayments(paymentsRes.data);
        if (expensesRes.data) setExpenses(expensesRes.data);
        if (unitsRes.data) setUnits(unitsRes.data);
        if (leasesRes.data) setLeases(leasesRes.data);
        if (maintenanceRes.data) setMaintenance(maintenanceRes.data);

        setLoading(false);
    }

    const periodStart = startOfMonth(currentMonth);
    const periodEnd = endOfMonth(currentMonth);
    periodEnd.setHours(23, 59, 59, 999);
    periodStart.setHours(0, 0, 0, 0);

    // Expected Rent (30-Day Cycle)
    const expectedRent = useMemo(() => {
        if (leases.length === 0) return 0;
        
        let total = 0;
        leases.forEach(lease => {
            const leaseStart = new Date(lease.start_date);
            leaseStart.setHours(0, 0, 0, 0);
            const leaseEnd = lease.end_date ? new Date(lease.end_date) : null;
            if (leaseEnd) leaseEnd.setHours(23, 59, 59, 999);
            
            // Calculate overlap between lease period and report period
            const periodStartCalc = leaseStart > periodStart ? leaseStart : periodStart;
            const periodEndCalc = (leaseEnd && leaseEnd < periodEnd) ? leaseEnd : periodEnd;
            
            if (periodStartCalc <= periodEndCalc) {
                // Calculate days in the report period that the lease was active
                const daysInPeriod = Math.floor((periodEndCalc.getTime() - periodStartCalc.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                // Calculate expected rent based on 30-day cycles
                const completePeriods = Math.floor(daysInPeriod / 30);
                total += completePeriods * lease.rent_amount;
            }
        });
        
        return total;
    }, [leases, periodStart, periodEnd]);

    // Collected Rent
    const collectedRent = payments.filter(p =>
        p.type === 'rent' && new Date(p.date) >= periodStart && new Date(p.date) <= periodEnd
    ).reduce((sum, p) => sum + p.amount, 0);

    // Expenses
    const periodExpenses = expenses.filter(e =>
        (e.status === 'approved' || e.status === 'paid') && new Date(e.date) >= periodStart && new Date(e.date) <= periodEnd
    ).reduce((sum, e) => sum + e.amount, 0);

    // Net Income & Outstanding
    const netIncome = collectedRent - periodExpenses;
    const outstanding = expectedRent - collectedRent;

    // Occupancy
    const totalUnits = units.length;

    const occupiedCount = useMemo(() => {
        if (leases.length === 0 || units.length === 0) return 0;

        const activeLeaseIds = leases.filter(l => {
            const start = new Date(l.start_date);
            start.setHours(0, 0, 0, 0);
            const end = l.end_date ? new Date(l.end_date) : null;
            if (end) end.setHours(23, 59, 59, 999);

            return start <= periodEnd && (!end || end >= periodEnd);
        }).map(l => l.unit_id);

        const uniqueOccupiedUnits = new Set(activeLeaseIds);
        return uniqueOccupiedUnits.size;
    }, [leases, units, periodEnd]);

    const occupancyRate = totalUnits ? Math.round((occupiedCount / totalUnits) * 100) : 0;

    // Cards Config
    const cards = [
        {
            label: 'Expected Rent',
            value: `${Math.round(expectedRent).toLocaleString()} ETB`,
            sub: '30-Day Cycle',
            icon: Calendar,
            color: 'var(--color-primary)',
            bg: 'hsla(210, 80%, 40%, 0.1)'
        },
        {
            label: t('rent_collected'),
            value: `${collectedRent.toLocaleString()} ETB`,
            icon: CreditCard,
            color: 'var(--color-success)',
            bg: 'hsla(145, 65%, 40%, 0.1)'
        },
        {
            label: 'Outstanding (Period)',
            value: `${Math.round(outstanding).toLocaleString()} ETB`,
            icon: AlertCircle,
            color: outstanding > 10 ? '#ed6c02' : 'var(--color-text-muted)',
            bg: 'hsla(30, 80%, 50%, 0.1)'
        }
    ];

    if (user?.role === 'owner') {
        cards.push({
            label: 'Expenses',
            value: `${periodExpenses.toLocaleString()} ETB`,
            icon: TrendingUp,
            color: 'var(--color-danger)',
            bg: 'hsla(350, 60%, 45%, 0.1)'
        });
        cards.push({
            label: t('net_income'),
            value: `${netIncome.toLocaleString()} ETB`,
            icon: TrendingUp,
            color: netIncome >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
            bg: 'hsla(210, 20%, 98%, 1)'
        });
        cards.push({
            label: t('occupancy'),
            value: `${occupancyRate}%`,
            sub: `${occupiedCount}/${totalUnits} Units`,
            icon: Home,
            color: 'var(--color-text-main)',
            bg: 'hsla(0, 0%, 90%, 0.5)'
        });
    }

    // Activity Feed
    const activityFeed = useMemo(() => {
        const allActivities = [
            ...payments.filter(p => new Date(p.date) >= periodStart && new Date(p.date) <= periodEnd).map(p => ({
                id: p.id,
                type: 'payment',
                date: new Date(p.date),
                title: 'Payment Received',
                amount: p.amount,
                details: `Method: ${p.method}`
            })),
            ...expenses.filter(e => new Date(e.date) >= periodStart && new Date(e.date) <= periodEnd).map(e => ({
                id: e.id,
                type: 'expense',
                date: new Date(e.date),
                title: 'Expense Recorded',
                amount: e.amount,
                details: e.category
            })),
            ...maintenance.filter(m => new Date(m.date) >= periodStart && new Date(m.date) <= periodEnd).map(m => ({
                id: m.id,
                type: 'maintenance',
                date: new Date(m.date),
                title: 'Maintenance Update',
                amount: 0,
                details: `Status: ${m.status}`
            }))
        ];

        return allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [payments, expenses, maintenance, periodStart, periodEnd]);

    if (loading) {
        return (
            <div className="container main-content">
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    Loading dashboard...
                </div>
            </div>
        );
    }

    return (
        <div className="container main-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h1>{t('dashboard')}</h1>

                {/* Month Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', background: 'var(--color-bg)', padding: '4px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn btn-sm btn-ghost"><ChevronLeft size={20} /></button>
                    <span style={{ fontWeight: 600, minWidth: '120px', textAlign: 'center' }}>{format(currentMonth, 'MMMM yyyy')}</span>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn btn-sm btn-ghost"><ChevronRight size={20} /></button>
                </div>

                <button
                    className="btn btn-secondary"
                    onClick={() => {
                        const headers = ['Date', 'Type', 'Amount', 'Description'];
                        const rows = activityFeed.map(item => [
                            format(item.date, 'yyyy-MM-dd'),
                            item.type,
                            item.amount.toString(),
                            item.title + ' ' + item.details
                        ]);

                        const csvContent = "data:text/csv;charset=utf-8,"
                            + headers.join(",") + "\n"
                            + rows.map(e => e.join(",")).join("\n");

                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `report_${format(currentMonth, 'yyyy_MM')}.csv`);
                        document.body.appendChild(link);
                        link.click();
                    }}
                >
                    <Download size={18} />
                    Export {format(currentMonth, 'MMM')} CSV
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                {cards.map((card, idx) => {
                    const Icon = card.icon;
                    return (
                        <div key={idx} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <div style={{ padding: '8px', borderRadius: '50%', background: card.bg }}>
                                    <Icon size={20} color={card.color} />
                                </div>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{card.label}</span>
                            </div>
                            <div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{card.value}</div>
                                {card.sub && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{card.sub}</div>}
                            </div>
                        </div>
                    );
                })}
            </div>

            <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-3)' }}>Activity ({format(currentMonth, 'MMMM')})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {activityFeed.length === 0 ? (
                    <EmptyState
                        title="No Activity in Period"
                        description="No payments, expenses, or maintenance records found for this month."
                        icon={Activity}
                    />
                ) : (
                    activityFeed.map((item) => (
                        <div key={`${item.type}-${item.id}`} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                <div style={{
                                    padding: '8px',
                                    borderRadius: '50%',
                                    background: item.type === 'payment' ? 'hsla(145, 65%, 40%, 0.1)' :
                                        item.type === 'expense' ? 'hsla(350, 60%, 45%, 0.1)' : 'hsla(40, 90%, 50%, 0.1)'
                                }}>
                                    {item.type === 'payment' ? <ArrowDownLeft size={16} color="var(--color-success)" /> :
                                        item.type === 'expense' ? <ArrowUpRight size={16} color="var(--color-danger)" /> :
                                            <AlertCircle size={16} color="var(--color-warning)" />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.title}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                                        {item.details} • {formatDistanceToNow(item.date, { addSuffix: true })}
                                    </div>
                                </div>
                            </div>
                            {item.amount > 0 && (
                                <div style={{ fontWeight: 600, color: item.type === 'payment' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                    {item.type === 'payment' ? '+' : '-'}{item.amount.toLocaleString()}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
