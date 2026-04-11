// TypeScript types generated from PostgreSQL schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UnitType = 'shop' | 'office' | 'store' | 'internal' | 'apartment';
export type RentPricingType = 'fixed' | 'per_sqm' | 'none';
export type UnitStatus = 'occupied' | 'vacant' | 'maintenance';
export type TenantStatus = 'active' | 'past';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'check' | 'other';
export type PaymentType = 'rent' | 'deposit' | 'other';
export type ExpenseStatus = 'requested' | 'approved' | 'rejected' | 'paid';
export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved';
export type UserRole = 'owner' | 'caretaker' | 'admin';

export interface Database {
  public: {
    Tables: {
      buildings: {
        Row: {
          id: string;
          name: string;
          location: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          location?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      units: {
        Row: {
          id: string;
          building_id: string;
          unit_number: string;
          floor: string;
          unit_type: UnitType;
          size_sqm: number;
          rent_pricing_type: RentPricingType;
          rent_amount: number | null;
          status: UnitStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          building_id: string;
          unit_number: string;
          floor: string;
          unit_type: UnitType;
          size_sqm: number;
          rent_pricing_type: RentPricingType;
          rent_amount?: number | null;
          status?: UnitStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          building_id?: string;
          unit_number?: string;
          floor?: string;
          unit_type?: UnitType;
          size_sqm?: number;
          rent_pricing_type?: RentPricingType;
          rent_amount?: number | null;
          status?: UnitStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      tenants: {
        Row: {
          id: string;
          name: string;
          phone: string;
          email: string | null;
          status: TenantStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          email?: string | null;
          status?: TenantStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          email?: string | null;
          status?: TenantStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      leases: {
        Row: {
          id: string;
          tenant_id: string;
          unit_id: string;
          rent_amount: number;
          pricing_type: RentPricingType;
          size_sqm: number;
          start_date: string;
          end_date: string | null;
          rent_due_day: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          unit_id: string;
          rent_amount: number;
          pricing_type: RentPricingType;
          size_sqm: number;
          start_date: string;
          end_date?: string | null;
          rent_due_day: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          unit_id?: string;
          rent_amount?: number;
          pricing_type?: RentPricingType;
          size_sqm?: number;
          start_date?: string;
          end_date?: string | null;
          rent_due_day?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          tenant_id: string;
          unit_id: string;
          lease_id: string;
          period_id: string | null;
          amount: number;
          date: string;
          method: PaymentMethod;
          type: PaymentType;
          reference: string | null;
          input_date: number;
          synced: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          unit_id: string;
          lease_id: string;
          period_id?: string | null;
          amount: number;
          date: string;
          method: PaymentMethod;
          type: PaymentType;
          reference?: string | null;
          input_date: number;
          synced?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          unit_id?: string;
          lease_id?: string;
          period_id?: string | null;
          amount?: number;
          date?: string;
          method?: PaymentMethod;
          type?: PaymentType;
          reference?: string | null;
          input_date?: number;
          synced?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          category: string;
          description: string;
          amount: number;
          date: string;
          requested_by_user_id: string | null;
          approved_by_user_id: string | null;
          deducted_from_rent: boolean;
          paid_by: string | null;
          vendor: string | null;
          reason: string | null;
          status: ExpenseStatus;
          synced: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          description: string;
          amount: number;
          date: string;
          requested_by_user_id?: string | null;
          approved_by_user_id?: string | null;
          deducted_from_rent?: boolean;
          paid_by?: string | null;
          vendor?: string | null;
          reason?: string | null;
          status?: ExpenseStatus;
          synced?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          description?: string;
          amount?: number;
          date?: string;
          requested_by_user_id?: string | null;
          approved_by_user_id?: string | null;
          deducted_from_rent?: boolean;
          paid_by?: string | null;
          vendor?: string | null;
          reason?: string | null;
          status?: ExpenseStatus;
          synced?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      billing_periods: {
        Row: {
          id: string;
          lease_id: string;
          period_number: number;
          start_date: string;
          end_date: string;
          expected_amount: number;
          paid_amount: number;
          status: 'unpaid' | 'partial' | 'paid' | 'overdue';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lease_id: string;
          period_number: number;
          start_date: string;
          end_date: string;
          expected_amount: number;
          paid_amount?: number;
          status?: 'unpaid' | 'partial' | 'paid' | 'overdue';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lease_id?: string;
          period_number?: number;
          start_date?: string;
          end_date?: string;
          expected_amount?: number;
          paid_amount?: number;
          status?: 'unpaid' | 'partial' | 'paid' | 'overdue';
          created_at?: string;
          updated_at?: string;
        };
      };
      maintenance: {
        Row: {
          id: string;
          unit_id: string;
          description: string;
          status: MaintenanceStatus;
          date: string;
          cost: number | null;
          synced: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          description: string;
          status?: MaintenanceStatus;
          date: string;
          cost?: number | null;
          synced?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          description?: string;
          status?: MaintenanceStatus;
          date?: string;
          cost?: number | null;
          synced?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          username: string;
          password_hash: string;
          role: UserRole;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          password_hash: string;
          role: UserRole;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          password_hash?: string;
          role?: UserRole;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      v_unit_current_tenants: {
        Row: {
          unit_id: string | null;
          unit_number: string | null;
          building_id: string | null;
          tenant_id: string | null;
          tenant_name: string | null;
          tenant_phone: string | null;
          lease_id: string | null;
          rent_amount: number | null;
          start_date: string | null;
          end_date: string | null;
        };
      };
    };
    Functions: {};
    Enums: {
      unit_type_enum: UnitType;
      rent_pricing_type_enum: RentPricingType;
      unit_status_enum: UnitStatus;
      tenant_status_enum: TenantStatus;
      payment_method_enum: PaymentMethod;
      payment_type_enum: PaymentType;
      expense_status_enum: ExpenseStatus;
      maintenance_status_enum: MaintenanceStatus;
      user_role_enum: UserRole;
    };
  };
}
