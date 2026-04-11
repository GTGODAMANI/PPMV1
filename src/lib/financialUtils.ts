import { supabase } from './supabase';
import type { Database } from './database.types';

type Lease = Database['public']['Tables']['leases']['Row'];
type Payment = Database['public']['Tables']['payments']['Row'];

export interface LeaseFinancials {
    expectedRent: number;
    paidAmount: number;
    balance: number;
    completePeriods: number;
    nextDueDate: Date;
    daysSinceStart: number;
    daysUntilNextDue: number;
    isOverdue: boolean;
    daysOverdue: number;
    lastPaymentDate?: Date;
    status: 'paid' | 'partial' | 'overdue' | 'credit';
}

/**
 * Calculates financials for a lease using 30-DAY BILLING CYCLE.
 * Formula: Expected Rent = floor(daysSinceStart / 30) × monthlyRent
 * 
 * Rules:
 * - Rent is due every 30 days from lease start
 * - Partial periods are NOT counted
 * - No daily prorating
 */
export function calculate30DayCycleFinancials(lease: Lease, allPayments: Payment[]): LeaseFinancials {
    // Filter payments for this specific lease
    const payments = allPayments.filter(p => p.lease_id === lease.id);

    // 1. Calculate Paid Amount
    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const lastPayment = payments.length > 0
        ? payments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
        : undefined;

    // 2. Calculate days since lease start
    const leaseStart = new Date(lease.start_date);
    leaseStart.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    // Cap at lease end if exists and is in the past
    const leaseEnd = lease.end_date ? new Date(lease.end_date) : null;
    const accrualEnd = (leaseEnd && leaseEnd < today) ? leaseEnd : today;
    
    // Calculate days since start
    const daysSinceStart = Math.floor(
        (accrualEnd.getTime() - leaseStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // 3. Calculate complete 30-day periods
    const completePeriods = Math.floor(daysSinceStart / 30);
    
    // 4. Expected rent = complete periods × monthly rent
    const expectedRent = completePeriods * lease.rent_amount;
    
    // 5. Calculate next due date
    const nextDueDate = new Date(leaseStart.getTime() + ((completePeriods + 1) * 30 * 24 * 60 * 60 * 1000));
    
    // 6. Calculate days until next due
    const daysUntilNextDue = Math.max(0, Math.floor(
        (nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    ));
    
    // 7. Calculate balance
    const balance = expectedRent - paidAmount;
    
    // 8. Determine if overdue
    const isOverdue = today > nextDueDate && balance > 0;
    const daysOverdue = isOverdue 
        ? Math.floor((today.getTime() - nextDueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    
    // 9. Determine status
    let status: LeaseFinancials['status'] = 'paid';
    if (balance > 5) status = 'overdue';
    else if (balance < -5) status = 'credit';
    else status = 'paid';

    return {
        expectedRent,
        paidAmount,
        balance,
        completePeriods,
        nextDueDate,
        daysSinceStart,
        daysUntilNextDue,
        isOverdue,
        daysOverdue,
        lastPaymentDate: lastPayment ? new Date(lastPayment) : undefined,
        status
    };
}

/**
 * Alias for backward compatibility
 */
export function calculateLeaseFinancialsSync(lease: Lease, allPayments: Payment[]): LeaseFinancials {
    return calculate30DayCycleFinancials(lease, allPayments);
}

// Async wrapper for convenience
export async function calculateLeaseFinancials(lease: Lease): Promise<LeaseFinancials> {
    const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('lease_id', lease.id);

    return calculate30DayCycleFinancials(lease, payments || []);
}
