import { db, type Lease, type Payment } from './db';

export interface LeaseFinancials {
    expectedRent: number;
    paidAmount: number;
    balance: number;
    lastPaymentDate?: Date;
    status: 'paid' | 'partial' | 'overdue' | 'credit';
}

// Helper to get days in month
function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Calculates Expected Rent for a period using STRICT DAILY ACCRUAL.
 * Formula: (Rent * ActiveDays) / DaysInMonth
 */
export function calculatePeriodExpectedRent(leases: Lease[], startDate: Date, endDate: Date): number {
    let totalExpected = 0;

    // Normalize range to start/end of days
    const rangeStart = new Date(startDate); rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(endDate); rangeEnd.setHours(23, 59, 59, 999);

    leases.forEach(lease => {
        const leaseStart = new Date(lease.startDate); leaseStart.setHours(0, 0, 0, 0);
        const leaseEnd = lease.endDate ? new Date(lease.endDate) : null;
        if (leaseEnd) leaseEnd.setHours(23, 59, 59, 999);

        // Optimization: Start checking from the month of the effective start date
        const effectiveStart = rangeStart > leaseStart ? rangeStart : leaseStart;
        const effectiveEnd = (leaseEnd && leaseEnd < rangeEnd) ? leaseEnd : rangeEnd;

        if (effectiveStart > effectiveEnd) return;

        let iter = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1);
        const endMonthDate = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), 1);

        while (iter <= endMonthDate) {
            const currentYear = iter.getFullYear();
            const currentMonth = iter.getMonth();
            const daysInMonth = getDaysInMonth(iter);

            // Define the window for this specific month [1st, Last]
            const monthStart = new Date(currentYear, currentMonth, 1);
            const monthEnd = new Date(currentYear, currentMonth, daysInMonth); monthEnd.setHours(23, 59, 59, 999);

            // Active Intersection = [Max(Start), Min(End)]
            const activeStart = (leaseStart > monthStart ? leaseStart : (rangeStart > monthStart ? rangeStart : monthStart));

            let activeEnd = monthEnd;
            if (leaseEnd && leaseEnd < activeEnd) activeEnd = leaseEnd;
            if (rangeEnd < activeEnd) activeEnd = rangeEnd;

            if (activeStart <= activeEnd) {
                // Inclusive days count
                const durationMs = activeEnd.getTime() - activeStart.getTime();
                // Add 1 day buffer for inclusive start/end (e.g. 1st to 1st is 1 day)
                // Use Math.floor and add 1 to handle potential DST oddities safely
                const activeDays = Math.floor(durationMs / (1000 * 60 * 60 * 24)) + 1;

                // Rent Accrual
                const monthRent = lease.rentAmount;
                const dailyRate = monthRent / daysInMonth;
                totalExpected += (dailyRate * activeDays);
            }

            // Next month
            iter.setMonth(iter.getMonth() + 1);
        }
    });

    return totalExpected;
}

/**
 * Calculates financials for a lease given a list of payments.
 * USES DAILY ACCRUAL logic for consistency.
 */
export function calculateLeaseFinancialsSync(lease: Lease, allPayments: Payment[]): LeaseFinancials {
    // Filter payments for this specific lease
    const payments = allPayments.filter(p => p.leaseId === lease.id);

    // 1. Calculate Paid Amount
    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const lastPayment = payments.length > 0
        ? payments.sort((a, b) => b.date.getTime() - a.date.getTime())[0].date
        : undefined;

    // 2. Calculate Expected Rent (Accrued from Start to Today)
    const now = new Date();
    // Cap accrual at Lease End if it exists and is in the past
    const accrualEnd = (lease.endDate && lease.endDate < now) ? lease.endDate : now;

    let expectedRent = 0;
    // Only calculate if the lease has actually started
    if (lease.startDate <= accrualEnd) {
        expectedRent = calculatePeriodExpectedRent([lease], lease.startDate, accrualEnd);
    }

    const balance = expectedRent - paidAmount;

    let status: LeaseFinancials['status'] = 'paid';
    if (balance > 5) status = 'overdue'; // Increased epsilon slightly for float buffer
    else if (balance < -5) status = 'credit';
    else status = 'paid';

    return {
        expectedRent,
        paidAmount,
        balance,
        lastPaymentDate: lastPayment,
        status
    };
}

// Async wrapper for convenience
export async function calculateLeaseFinancials(lease: Lease): Promise<LeaseFinancials> {
    const payments = await db.payments.where({ leaseId: lease.id }).toArray();
    return calculateLeaseFinancialsSync(lease, payments);
}
