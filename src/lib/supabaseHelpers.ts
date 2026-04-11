import { supabase } from './supabase';
import type { Database } from './database.types';

// Type-safe insert helpers to work around Supabase type inference issues

export async function insertBuilding(data: Database['public']['Tables']['buildings']['Insert']) {
    return await supabase.from('buildings').insert(data as any);
}

export async function insertUnit(data: Database['public']['Tables']['units']['Insert']) {
    return await supabase.from('units').insert(data as any);
}

export async function insertTenant(data: Database['public']['Tables']['tenants']['Insert']) {
    return await supabase.from('tenants').insert(data as any);
}

export async function insertLease(data: Database['public']['Tables']['leases']['Insert']) {
    return await supabase.from('leases').insert(data as any);
}

export async function insertPayment(data: Database['public']['Tables']['payments']['Insert']) {
    return await supabase.from('payments').insert(data as any);
}

export async function insertExpense(data: Database['public']['Tables']['expenses']['Insert']) {
    return await supabase.from('expenses').insert(data as any);
}

export async function insertMaintenance(data: Database['public']['Tables']['maintenance']['Insert']) {
    return await supabase.from('maintenance').insert(data as any);
}

export async function insertUser(data: Database['public']['Tables']['users']['Insert']) {
    return await supabase.from('users').insert(data as any);
}

export async function updateLease(id: string, data: Database['public']['Tables']['leases']['Update']) {
    return await (supabase.from('leases').update as any)(data, { count: 'exact' }).eq('id', id);
}

export async function updateMaintenance(id: string, data: Database['public']['Tables']['maintenance']['Update']) {
    return await (supabase.from('maintenance').update as any)(data, { count: 'exact' }).eq('id', id);
}
