import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { insertUnit } from '../lib/supabaseHelpers';
import type { Database } from '../lib/database.types';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Home, Trash2, Search, Building2, Layers, CheckSquare, Square, X } from 'lucide-react';
import { isLeaseActive } from '../lib/leaseUtils';

type Unit = Database['public']['Tables']['units']['Row'];
type Building = Database['public']['Tables']['buildings']['Row'];
type Lease = Database['public']['Tables']['leases']['Row'];

const UNIT_TYPE_LABELS: Record<string, string> = {
    apartment: 'Apartment',
    shop: 'Shop',
    office: 'Office',
    store: 'Store',
};

const STATUS_COLORS = {
    occupied: { bg: 'hsl(150,60%,94%)', text: 'hsl(150,60%,28%)', dot: 'hsl(150,60%,35%)' },
    vacant:   { bg: 'hsl(220,15%,94%)', text: 'hsl(220,10%,45%)', dot: 'hsl(220,10%,60%)' },
};

export default function Units() {
    const { t } = useTranslation();
    const [units, setUnits] = useState<Unit[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [leases, setLeases] = useState<Lease[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
    const [showBulkEdit, setShowBulkEdit] = useState(false);
    const [search, setSearch] = useState('');
    const [filterBuilding, setFilterBuilding] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [bulkEditData, setBulkEditData] = useState({
        unitType: '',
        sizeSqm: '',
        rentAmount: '',
        rentPricingType: ''
    });
    const [newUnit, setNewUnit] = useState({
        buildingId: '',
        floor: '',
        unitNumber: '',
        unitType: 'apartment',
        sizeSqm: '',
        rentPricingType: 'fixed',
        rentAmount: '',
        customFloor: false,
        customUnitNumber: false
    });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        setError(null);

        const [unitsResult, buildingsResult, leasesResult] = await Promise.all([
            supabase.from('units').select('*').order('unit_number'),
            supabase.from('buildings').select('*').order('name'),
            supabase.from('leases').select('*')
        ]);

        if (unitsResult.error) {
            setError(unitsResult.error.message);
        } else if (buildingsResult.error) {
            setError(buildingsResult.error.message);
        } else {
            setUnits(unitsResult.data || []);
            setBuildings(buildingsResult.data || []);
            // Leases are non-critical — show units even if leases fail
            if (!leasesResult.error) {
                setLeases(leasesResult.data || []);
            }
        }

        setLoading(false);
    }

    // Derive unit status from leases
    const unitStatusMap = useMemo(() => {
        const map = new Map<string, 'occupied' | 'vacant'>();
        units.forEach(u => {
            const activeLease = leases.find(l => l.unit_id === u.id && isLeaseActive(l));
            map.set(u.id, activeLease ? 'occupied' : 'vacant');
        });
        return map;
    }, [units, leases]);

    // Derive available floors from existing units in selected building
    const availableFloors = useMemo(() => {
        if (!newUnit.buildingId) return [];
        
        const floorsSet = new Set(
            units
                .filter(u => u.building_id === newUnit.buildingId)
                .map(u => u.floor)
        );
        
        return Array.from(floorsSet).sort((a, b) => {
            if (a === 'G') return -1;
            if (b === 'G') return 1;
            return parseInt(a) - parseInt(b);
        });
    }, [units, newUnit.buildingId]);

    // Derive available unit numbers from existing units on selected floor
    const availableUnitNumbers = useMemo(() => {
        if (!newUnit.buildingId || !newUnit.floor || newUnit.customFloor) return [];
        
        return units
            .filter(u => 
                u.building_id === newUnit.buildingId && 
                u.floor === newUnit.floor
            )
            .map(u => u.unit_number)
            .sort();
    }, [units, newUnit.buildingId, newUnit.floor, newUnit.customFloor]);

    // Stats
    const stats = useMemo(() => {
        const total = units.length;
        const occupied = units.filter(u => unitStatusMap.get(u.id) === 'occupied').length;
        return { total, occupied, vacant: total - occupied };
    }, [units, unitStatusMap]);

    // Filtered units
    const filteredUnits = useMemo(() => {
        return units.filter(u => {
            const status = unitStatusMap.get(u.id) || 'vacant';
            const buildingName = buildings.find(b => b.id === u.building_id)?.name || '';
            const q = search.toLowerCase();
            const matchesSearch = !q ||
                u.unit_number.toLowerCase().includes(q) ||
                (u.unit_type || '').toLowerCase().includes(q) ||
                buildingName.toLowerCase().includes(q) ||
                (u.floor || '').toLowerCase().includes(q);
            const matchesBuilding = !filterBuilding || u.building_id === filterBuilding;
            const matchesStatus = !filterStatus || status === filterStatus;
            return matchesSearch && matchesBuilding && matchesStatus;
        });
    }, [units, unitStatusMap, buildings, search, filterBuilding, filterStatus]);

    const handleAddUnit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUnit.buildingId || !newUnit.unitNumber || !newUnit.floor || !newUnit.sizeSqm) return;

        // Check for duplicate unit number
        const duplicate = units.find(u => 
            u.building_id === newUnit.buildingId &&
            u.unit_number === newUnit.unitNumber
        );
        
        if (duplicate) {
            setError('Unit number already exists in this building');
            return;
        }

        try {
            const { error: insertError } = await insertUnit({
                id: uuidv4(),
                building_id: newUnit.buildingId,
                unit_number: newUnit.unitNumber,
                floor: newUnit.floor,
                unit_type: newUnit.unitType as any,
                size_sqm: parseFloat(newUnit.sizeSqm),
                rent_pricing_type: newUnit.rentPricingType as any,
                rent_amount: newUnit.rentAmount ? parseFloat(newUnit.rentAmount) : null,
                status: 'vacant'
            });

            if (insertError) {
                console.error('Failed to add unit:', insertError);
                setError(insertError.message);
            } else {
                setNewUnit({ 
                    buildingId: '', 
                    unitNumber: '', 
                    floor: '', 
                    unitType: 'apartment', 
                    sizeSqm: '', 
                    rentPricingType: 'fixed', 
                    rentAmount: '',
                    customFloor: false,
                    customUnitNumber: false
                });
                setShowAddForm(false);
                fetchData();
            }
        } catch (error) {
            console.error('Failed to add unit:', error);
        }
    };

    const getBuildingName = (id: string) => {
        return buildings.find(b => b.id === id)?.name || 'Unknown Building';
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this unit?')) {
            const { error: deleteError } = await supabase
                .from('units')
                .delete()
                .eq('id', id);

            if (deleteError) {
                console.error('Failed to delete unit:', deleteError);
                setError(deleteError.message);
            } else {
                fetchData();
            }
        }
    };

    const toggleUnitSelection = (unitId: string) => {
        const newSelection = new Set(selectedUnits);
        if (newSelection.has(unitId)) {
            newSelection.delete(unitId);
        } else {
            newSelection.add(unitId);
        }
        setSelectedUnits(newSelection);
    };

    const handleBulkUpdate = async () => {
        if (selectedUnits.size === 0) return;

        const updates: any = {};
        
        if (bulkEditData.unitType) updates.unit_type = bulkEditData.unitType;
        if (bulkEditData.sizeSqm) updates.size_sqm = parseFloat(bulkEditData.sizeSqm);
        if (bulkEditData.rentAmount) updates.rent_amount = parseFloat(bulkEditData.rentAmount);
        if (bulkEditData.rentPricingType) updates.rent_pricing_type = bulkEditData.rentPricingType;

        if (Object.keys(updates).length === 0) {
            setError('No fields to update');
            return;
        }

        try {
            const { error: updateError } = await (supabase as any)
                .from('units')
                .update(updates)
                .in('id', Array.from(selectedUnits));

            if (updateError) {
                console.error('Failed to bulk update:', updateError);
                setError(updateError.message);
            } else {
                setSelectedUnits(new Set());
                setShowBulkEdit(false);
                setBulkEditData({ unitType: '', sizeSqm: '', rentAmount: '', rentPricingType: '' });
                fetchData();
            }
        } catch (error) {
            console.error('Failed to bulk update:', error);
        }
    };

    if (loading) {
        return (
            <div className="container main-content">
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-secondary)' }}>
                    Loading units...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container main-content">
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-danger)' }}>
                    Error: {error}
                </div>
            </div>
        );
    }

    const allFilteredSelected = filteredUnits.length > 0 && filteredUnits.every(u => selectedUnits.has(u.id));

    const toggleSelectAllFiltered = () => {
        const newSel = new Set(selectedUnits);
        if (allFilteredSelected) {
            filteredUnits.forEach(u => newSel.delete(u.id));
        } else {
            filteredUnits.forEach(u => newSel.add(u.id));
        }
        setSelectedUnits(newSel);
    };

    return (
        <div className="container main-content">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
                <div>
                    <h1 style={{ marginBottom: '2px' }}>{t('units')}</h1>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                        {stats.total} total &middot; {stats.occupied} occupied &middot; {stats.vacant} vacant
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {selectedUnits.size > 0 && (
                        <>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedUnits(new Set())}>
                                <X size={14} /> Clear ({selectedUnits.size})
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowBulkEdit(!showBulkEdit)}>
                                Edit {selectedUnits.size} Selected
                            </button>
                        </>
                    )}
                    <button className="btn btn-primary" onClick={() => { setShowAddForm(!showAddForm); setShowBulkEdit(false); }}>
                        <Plus size={18} />
                        Add Unit
                    </button>
                </div>
            </div>

            {/* Stats bar */}
            {units.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                    {[
                        { label: 'Total Units', value: stats.total, icon: <Layers size={18} />, color: 'var(--color-primary)' },
                        { label: 'Occupied', value: stats.occupied, icon: <Home size={18} />, color: 'var(--color-success)' },
                        { label: 'Vacant', value: stats.vacant, icon: <Home size={18} />, color: 'var(--color-text-secondary)' },
                    ].map(s => (
                        <div key={s.label} className="card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <div style={{ background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', padding: '8px', color: s.color, flexShrink: 0 }}>
                                {s.icon}
                            </div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Bulk Edit Panel */}
            {showBulkEdit && selectedUnits.size > 0 && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', borderColor: 'var(--color-primary)', borderWidth: '1.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                        <h3 style={{ margin: 0 }}>Bulk Edit — {selectedUnits.size} Units</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setShowBulkEdit(false); setBulkEditData({ unitType: '', sizeSqm: '', rentAmount: '', rentPricingType: '' }); }}>
                            <X size={16} />
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Unit Type</label>
                            <select value={bulkEditData.unitType} onChange={(e) => setBulkEditData({ ...bulkEditData, unitType: e.target.value })}>
                                <option value="">— No Change —</option>
                                <option value="apartment">Apartment</option>
                                <option value="shop">Shop</option>
                                <option value="office">Office</option>
                                <option value="store">Store</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Size (m²)</label>
                            <input type="number" value={bulkEditData.sizeSqm} onChange={(e) => setBulkEditData({ ...bulkEditData, sizeSqm: e.target.value })} placeholder="Leave empty for no change" />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Pricing Type</label>
                            <select value={bulkEditData.rentPricingType} onChange={(e) => setBulkEditData({ ...bulkEditData, rentPricingType: e.target.value })}>
                                <option value="">— No Change —</option>
                                <option value="fixed">Fixed Price</option>
                                <option value="per_sqm">Price per m²</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Rent Amount</label>
                            <input type="number" value={bulkEditData.rentAmount} onChange={(e) => setBulkEditData({ ...bulkEditData, rentAmount: e.target.value })} placeholder="Leave empty for no change" />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button onClick={handleBulkUpdate} className="btn btn-primary" style={{ flex: 1 }}>Apply to {selectedUnits.size} Units</button>
                        <button onClick={() => { setShowBulkEdit(false); setBulkEditData({ unitType: '', sizeSqm: '', rentAmount: '', rentPricingType: '' }); }} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Add Unit Form */}
            {showAddForm && (
                <div className="card" style={{ marginBottom: 'var(--space-4)', borderColor: 'var(--color-primary)', borderWidth: '1.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                        <h3 style={{ margin: 0 }}>Add New Unit</h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}><X size={16} /></button>
                    </div>
                    <form onSubmit={handleAddUnit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-build" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('buildings')}</label>
                                <select id="u-build" value={newUnit.buildingId} onChange={(e) => setNewUnit({ ...newUnit, buildingId: e.target.value })} required>
                                    <option value="">Select Building</option>
                                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-type" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Type</label>
                                <select id="u-type" value={newUnit.unitType} onChange={(e) => setNewUnit({ ...newUnit, unitType: e.target.value })}>
                                    <option value="apartment">Apartment</option>
                                    <option value="shop">Shop</option>
                                    <option value="office">Office</option>
                                    <option value="store">Store</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-floor" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Floor</label>
                                <select
                                    id="u-floor"
                                    value={newUnit.customFloor ? 'Custom' : newUnit.floor}
                                    onChange={(e) => {
                                        if (e.target.value === 'Custom') {
                                            setNewUnit({ ...newUnit, floor: '', customFloor: true, unitNumber: '', customUnitNumber: false });
                                        } else {
                                            setNewUnit({ ...newUnit, floor: e.target.value, customFloor: false, unitNumber: '', customUnitNumber: false });
                                        }
                                    }}
                                    required
                                    disabled={!newUnit.buildingId}
                                >
                                    <option value="">Select Floor</option>
                                    {availableFloors.map(f => <option key={f} value={f}>Floor {f}</option>)}
                                    <option value="Custom">+ Custom Floor</option>
                                </select>
                                {newUnit.customFloor && (
                                    <input type="text" value={newUnit.floor} onChange={(e) => setNewUnit({ ...newUnit, floor: e.target.value })} placeholder="e.g., G, 1, B1" required style={{ marginTop: '4px' }} />
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-num" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Unit No.</label>
                                <select
                                    id="u-num"
                                    value={newUnit.customUnitNumber ? 'Custom' : newUnit.unitNumber}
                                    onChange={(e) => {
                                        if (e.target.value === 'Custom') {
                                            setNewUnit({ ...newUnit, unitNumber: '', customUnitNumber: true });
                                        } else {
                                            setNewUnit({ ...newUnit, unitNumber: e.target.value, customUnitNumber: false });
                                        }
                                    }}
                                    required
                                    disabled={!newUnit.floor || newUnit.customFloor}
                                >
                                    <option value="">Select Unit</option>
                                    {availableUnitNumbers.map(num => <option key={num} value={num}>{num}</option>)}
                                    <option value="Custom">+ Custom Unit</option>
                                </select>
                                {(newUnit.customUnitNumber || newUnit.customFloor) && (
                                    <input type="text" value={newUnit.unitNumber} onChange={(e) => setNewUnit({ ...newUnit, unitNumber: e.target.value })} placeholder="e.g., G01, 101, A1" required style={{ marginTop: '4px' }} />
                                )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-size" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Size (m²)</label>
                                <input id="u-size" type="number" value={newUnit.sizeSqm} onChange={(e) => setNewUnit({ ...newUnit, sizeSqm: e.target.value })} placeholder="80" required />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-ptype" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Pricing Type</label>
                                <select id="u-ptype" value={newUnit.rentPricingType} onChange={(e) => setNewUnit({ ...newUnit, rentPricingType: e.target.value })}>
                                    <option value="fixed">Fixed Price</option>
                                    <option value="per_sqm">Price per m²</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-rent" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Default Rent <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span></label>
                                <input id="u-rent" type="number" value={newUnit.rentAmount} onChange={(e) => setNewUnit({ ...newUnit, rentAmount: e.target.value })} placeholder="0.00" />
                            </div>
                        </div>

                        {error && (
                            <div style={{ padding: 'var(--space-3)', background: 'hsl(0,75%,97%)', border: '1px solid hsl(0,75%,85%)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <X size={14} /> {error}
                                <button type="button" onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer' }}><X size={14} /></button>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{t('save')}</button>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)} style={{ flex: 1 }}>{t('cancel')}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Search & Filter Bar */}
            {units.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1 1 200px' }}>
                        <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', pointerEvents: 'none' }} />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search units..."
                            style={{ paddingLeft: '32px' }}
                        />
                    </div>
                    <div style={{ position: 'relative', flex: '0 1 160px' }}>
                        <Building2 size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', pointerEvents: 'none' }} />
                        <select value={filterBuilding} onChange={e => setFilterBuilding(e.target.value)} style={{ paddingLeft: '32px' }}>
                            <option value="">All Buildings</option>
                            {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ flex: '0 1 130px' }}>
                        <option value="">All Status</option>
                        <option value="occupied">Occupied</option>
                        <option value="vacant">Vacant</option>
                    </select>
                    {(search || filterBuilding || filterStatus) && (
                        <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterBuilding(''); setFilterStatus(''); }}>
                            <X size={14} /> Clear
                        </button>
                    )}
                </div>
            )}

            {/* Select all row */}
            {filteredUnits.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', padding: '0 var(--space-1)' }}>
                    <button
                        onClick={toggleSelectAllFiltered}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: allFilteredSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}
                    >
                        {allFilteredSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        <span style={{ fontSize: '0.875rem' }}>
                            {allFilteredSelected ? 'Deselect all' : `Select all ${filteredUnits.length}`}
                            {selectedUnits.size > 0 && ` (${selectedUnits.size} selected)`}
                        </span>
                    </button>
                </div>
            )}

            {/* Unit Cards */}
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {filteredUnits.map((unit) => {
                    const status = unitStatusMap.get(unit.id) || 'vacant';
                    const isSelected = selectedUnits.has(unit.id);
                    const sc = STATUS_COLORS[status];
                    const typeLabel = UNIT_TYPE_LABELS[unit.unit_type || ''] || (unit.unit_type || 'Unit');
                    return (
                        <div
                            key={unit.id}
                            className="card"
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: 'var(--space-4)',
                                border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                                transition: 'border-color var(--transition-fast), background var(--transition-fast)',
                                cursor: 'default',
                            }}
                        >
                            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', minWidth: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleUnitSelection(unit.id)}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0, accentColor: 'var(--color-primary)' }}
                                />
                                <div style={{ background: isSelected ? 'var(--color-primary-subtle)' : 'var(--color-bg)', padding: '10px', borderRadius: 'var(--radius-md)', flexShrink: 0 }}>
                                    <Home size={20} color={status === 'occupied' ? 'var(--color-success)' : 'var(--color-text-secondary)'} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: '3px' }}>
                                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{typeLabel} {unit.unit_number}</span>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-bg)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}>
                                            Floor {unit.floor || 'G'}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: sc.bg, color: sc.text, fontWeight: 500 }}>
                                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: sc.dot, marginRight: '4px', verticalAlign: 'middle' }} />
                                            {status === 'occupied' ? 'Occupied' : 'Vacant'}
                                        </span>
                                    </div>
                                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Building2 size={13} />
                                            {getBuildingName(unit.building_id)}
                                        </span>
                                        <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>{unit.rent_amount || 0} ETB</span>
                                        <span>{unit.size_sqm || 0} m²</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(unit.id)}
                                className="btn btn-ghost btn-sm"
                                style={{ flexShrink: 0, color: 'var(--color-text-secondary)' }}
                                title="Delete unit"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    );
                })}

                {filteredUnits.length === 0 && units.length > 0 && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-secondary)' }}>
                        No units match your filters.{' '}
                        <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterBuilding(''); setFilterStatus(''); }}>Clear filters</button>
                    </div>
                )}

                {units.length === 0 && !showAddForm && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--color-text-secondary)' }}>
                        <div style={{ background: 'var(--color-bg)', borderRadius: '50%', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
                            <Home size={28} color="var(--color-text-secondary)" />
                        </div>
                        <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--color-text-main)' }}>No units yet</p>
                        <p style={{ fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>Add your first unit to get started.</p>
                        <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
                            <Plus size={16} /> Add Unit
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
