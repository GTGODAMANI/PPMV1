import { supabase } from './supabase';
import type { Database } from './database.types';

type Lease = Database['public']['Tables']['leases']['Row'];
type BillingPeriod = Database['public']['Tables']['billing_periods']['Row'];

export interface PeriodDisplay {
    id: string;
    periodNumber: number;
    startDate: Date;
    endDate: Date;
    expectedAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    status: 'unpaid' | 'partial' | 'paid' | 'overdue';
    displayText: string;
}

/**
 * Generate billing periods for a lease
 * @param lease The lease to generate periods for
 * @returns Array of generated period IDs
 */
export async function generateBillingPeriods(lease: Lease): Promise<string[]> {
    const leaseStart = new Date(lease.start_date);
    leaseStart.setHours(0, 0, 0, 0);
    
    const leaseEnd = lease.end_date ? new Date(lease.end_date) : null;
    
    // Calculate how many periods to generate
    let periodsToGenerate: number;
    if (leaseEnd) {
        const totalDays = Math.floor((leaseEnd.getTime() - leaseStart.getTime()) / (1000 * 60 * 60 * 24));
        periodsToGenerate = Math.ceil(totalDays / 30);
    } else {
        // Open-ended lease: generate 12 periods (1 year)
        periodsToGenerate = 12;
    }
    
    // Check if this is a renewal (find highest period number for this unit)
    const { data: existingPeriods } = await (supabase as any)
        .from('billing_periods')
        .select('period_number')
        .eq('lease_id', lease.id)
        .order('period_number', { ascending: false })
        .limit(1) as { data: Array<{ period_number: number }> | null };
    
    let startingPeriodNumber = 1;
    if (existingPeriods && existingPeriods.length > 0) {
        startingPeriodNumber = existingPeriods[0].period_number + 1;
    }
    
    // Generate periods
    const periods = [];
    for (let i = 0; i < periodsToGenerate; i++) {
        const periodNumber = startingPeriodNumber + i;
        const startDate = new Date(leaseStart.getTime() + (i * 30 * 24 * 60 * 60 * 1000));
        const endDate = new Date(leaseStart.getTime() + ((i + 1) * 30 * 24 * 60 * 60 * 1000));
        
        periods.push({
            lease_id: lease.id,
            period_number: periodNumber,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            expected_amount: lease.rent_amount,
            paid_amount: 0,
            status: 'unpaid' as const
        });
    }
    
    // Insert periods
    const { data, error } = await (supabase as any)
        .from('billing_periods')
        .insert(periods)
        .select('id') as { data: Array<{ id: string }> | null, error: any };
    
    if (error) {
        console.error('Failed to generate billing periods:', error);
        throw error;
    }
    
    return data?.map(p => p.id) || [];
}

/**
 * Get all periods for a lease with formatted display text
 */
export async function getLeasePeriods(leaseId: string): Promise<PeriodDisplay[]> {
    const { data: periods, error } = await supabase
        .from('billing_periods')
        .select('*')
        .eq('lease_id', leaseId)
        .order('period_number', { ascending: true });
    
    if (error) {
        console.error('Failed to fetch periods:', error);
        return [];
    }
    
    return (periods || []).map(formatPeriodDisplay);
}

/**
 * Get unpaid and partial periods for a lease (for payment dropdown)
 */
export async function getUnpaidPeriods(leaseId: string): Promise<PeriodDisplay[]> {
    const { data: periods, error } = await supabase
        .from('billing_periods')
        .select('*')
        .eq('lease_id', leaseId)
        .in('status', ['unpaid', 'partial', 'overdue'])
        .order('period_number', { ascending: true });
    
    if (error) {
        console.error('Failed to fetch unpaid periods:', error);
        return [];
    }
    
    return (periods || []).map(formatPeriodDisplay);
}

/**
 * Get current period for a lease (the period that includes today)
 */
export async function getCurrentPeriod(leaseId: string): Promise<PeriodDisplay | null> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: period, error } = await supabase
        .from('billing_periods')
        .select('*')
        .eq('lease_id', leaseId)
        .lte('start_date', today)
        .gte('end_date', today)
        .single();
    
    if (error || !period) {
        return null;
    }
    
    return formatPeriodDisplay(period);
}

/**
 * Format a period for display
 */
export function formatPeriodDisplay(period: BillingPeriod): PeriodDisplay {
    const startDate = new Date(period.start_date);
    const endDate = new Date(period.end_date);
    const outstandingAmount = period.expected_amount - period.paid_amount;
    
    const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    let displayText = `Period ${period.period_number}: ${startStr} - ${endStr}`;
    
    if (period.status === 'paid') {
        displayText += ` ✓ Paid`;
    } else if (period.status === 'partial') {
        displayText += ` (Outstanding: ${outstandingAmount.toLocaleString()} ETB)`;
    } else if (period.status === 'overdue') {
        displayText += ` ⚠ Overdue (${outstandingAmount.toLocaleString()} ETB)`;
    } else {
        displayText += ` (${period.expected_amount.toLocaleString()} ETB)`;
    }
    
    return {
        id: period.id,
        periodNumber: period.period_number,
        startDate,
        endDate,
        expectedAmount: period.expected_amount,
        paidAmount: period.paid_amount,
        outstandingAmount,
        status: period.status,
        displayText
    };
}

/**
 * Mark overdue periods (call this periodically or on page load)
 */
export async function markOverduePeriods(): Promise<void> {
    const { error } = await supabase.rpc('mark_overdue_periods');
    
    if (error) {
        console.error('Failed to mark overdue periods:', error);
    }
}

/**
 * Get period statistics for a lease
 */
export async function getLeasePeriodStats(leaseId: string) {
    const { data: periods } = await (supabase as any)
        .from('billing_periods')
        .select('*')
        .eq('lease_id', leaseId) as { data: BillingPeriod[] | null };
    
    if (!periods || periods.length === 0) {
        return {
            totalPeriods: 0,
            paidPeriods: 0,
            partialPeriods: 0,
            unpaidPeriods: 0,
            overduePeriods: 0,
            totalExpected: 0,
            totalPaid: 0,
            totalOutstanding: 0
        };
    }
    
    const stats = {
        totalPeriods: periods.length,
        paidPeriods: periods.filter(p => p.status === 'paid').length,
        partialPeriods: periods.filter(p => p.status === 'partial').length,
        unpaidPeriods: periods.filter(p => p.status === 'unpaid').length,
        overduePeriods: periods.filter(p => p.status === 'overdue').length,
        totalExpected: periods.reduce((sum, p) => sum + p.expected_amount, 0),
        totalPaid: periods.reduce((sum, p) => sum + p.paid_amount, 0),
        totalOutstanding: periods.reduce((sum, p) => sum + (p.expected_amount - p.paid_amount), 0)
    };
    
    return stats;
}
