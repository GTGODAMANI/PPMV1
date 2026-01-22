import Dexie, { type EntityTable } from 'dexie';

export interface Building {
    id: string;
    name: string;
    location: string;
}

export type UnitType = 'shop' | 'office' | 'store' | 'internal' | 'apartment';
export type RentPricingType = 'fixed' | 'per_sqm' | 'none';

export interface Unit {
    id: string;
    buildingId: string;
    unitNumber: string;
    floor: string; // e.g., "Ground", "1", "2"
    unitType: UnitType;
    sizeSqm: number;
    rentPricingType: RentPricingType;
    rentAmount?: number; // Optional default listing price
    status: 'occupied' | 'vacant' | 'maintenance';
    currentTenantId?: string; // Kept for quick lookup, but Lease table is source of truth
}

export interface Tenant {
    id: string;
    name: string;
    phone: string;
    email?: string;
    // leaseStart and unitId removed - now in Lease table
    status: 'active' | 'past';
    balance: number;
}

export interface Lease {
    id: string;
    tenantId: string;
    unitId: string;

    // Contract Terms Snapshot
    rentAmount: number; // Actual monthly rent for this contract
    pricingType: RentPricingType;
    sizeSqm: number; // Snapshot of size at signing (in case unit changes)

    startDate: Date;
    endDate: Date;
    rentDueDay: number; // e.g., 1 for 1st of month

    isActive: boolean;
}

export interface Payment {
    id: string;
    tenantId: string;
    unitId: string;
    leaseId?: string; // Optional link to specific lease
    amount: number;
    date: Date;
    method: 'cash' | 'bank_transfer' | 'check' | 'other';
    type: 'rent' | 'deposit' | 'other';
    reference?: string; // Transaction ID or Check Number
    inputDate: number; // For sorting
    synced: boolean;
}

export interface Expense {
    id: string;
    category: string; // e.g. "Maintenance", "Utilities", "Tax"
    description: string;
    amount: number;
    date: Date;

    // Approval Workflow
    requestedByUserId?: string;
    approvedByUserId?: string;

    // Financials
    deductedFromRent: boolean; // If true, this is a credit to the tenant
    paidBy?: string; // e.g., 'Owner', 'Caretaker', 'Tenant'
    vendor?: string;
    reason?: string;

    status: 'requested' | 'approved' | 'rejected' | 'paid';
    synced: boolean;
}

export interface Maintenance {
    id: string;
    unitId: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved';
    date: Date;
    cost?: number;
    synced: boolean;
}

export interface User {
    id: string;
    username: string; // unique
    passwordHash: string;
    role: 'owner' | 'caretaker' | 'admin';
    name: string;
}

export const db = new Dexie('PropertyManagerDB') as Dexie & {
    buildings: EntityTable<Building, 'id'>;
    units: EntityTable<Unit, 'id'>;
    tenants: EntityTable<Tenant, 'id'>;
    leases: EntityTable<Lease, 'id'>; // New Table
    payments: EntityTable<Payment, 'id'>;
    expenses: EntityTable<Expense, 'id'>;
    maintenance: EntityTable<Maintenance, 'id'>;
    users: EntityTable<User, 'id'>;
};

// Schema declaration
db.version(4).stores({
    buildings: 'id, name',
    units: 'id, buildingId, status, currentTenantId',
    tenants: 'id, name, phone, status',
    leases: 'id, tenantId, unitId, isActive, startDate, endDate', // Indexes for lookups
    payments: 'id, tenantId, unitId, date, type, inputDate',
    expenses: 'id, category, date, status, requestedByUserId',
    maintenance: 'id, unitId, status, date',
    users: 'id, &username, role'
});
