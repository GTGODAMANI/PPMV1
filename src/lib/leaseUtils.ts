import { db, type Lease } from './db';

export function isLeaseActive(lease: Lease): boolean {
    const now = new Date();
    // Normalize "today" to just the date, ignoring time
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const startDate = new Date(lease.startDate);
    // Normalize start date too (in case it has time components)
    const normalizedStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

    // Check start date: If today is BEFORE the start date, it's inactive (future lease)
    if (today.getTime() < normalizedStart.getTime()) return false;

    // Check end date (if exists)
    if (lease.endDate) {
        const endDate = new Date(lease.endDate);
        const normalizedEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        // If today is AFTER the end date, it's inactive (expired)
        if (today.getTime() > normalizedEnd.getTime()) return false;
    }

    // Explicit flag check (manual override)
    if (lease.isActive === false) return false;

    return true;
}

export async function validateNewLease(unitId: string): Promise<{ valid: boolean; error?: string }> {
    // 1. Get all leases for this unit
    const existingLeases = await db.leases.where({ unitId }).toArray();

    // 2. Check for overlapping ACTIVE leases
    // Note: We only care if there is ALREADY an active lease that overlaps with the proposed period.
    // Or strictly: "Only one active lease allowed per unit".

    // Simplest strict rule: Is there ANY currently active lease for this unit?
    const hasActiveLease = existingLeases.some(l => isLeaseActive(l));

    if (hasActiveLease) {
        return { valid: false, error: 'This unit already has an active lease. Please terminate the existing lease first.' };
    }

    return { valid: true };
}

export async function getUnitOccupancyStatus(unitId: string): Promise<'occupied' | 'vacant'> {
    const leases = await db.leases.where({ unitId }).toArray();
    const activeLease = leases.find(l => isLeaseActive(l));
    return activeLease ? 'occupied' : 'vacant';
}
