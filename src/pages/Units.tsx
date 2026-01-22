import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Home, Trash2 } from 'lucide-react';
import { isLeaseActive } from '../lib/leaseUtils';

export default function Units() {
    const { t } = useTranslation();
    const units = useLiveQuery(() => db.units.toArray());
    const buildings = useLiveQuery(() => db.buildings.toArray());
    const leases = useLiveQuery(() => db.leases.toArray());

    const [showAddForm, setShowAddForm] = useState(false);
    const [newUnit, setNewUnit] = useState({
        buildingId: '',
        unitNumber: '',
        floor: '',
        unitType: 'apartment',
        sizeSqm: '',
        rentPricingType: 'fixed',
        rentAmount: ''
    });

    // Derive unit status from leases
    const unitStatusMap = useMemo(() => {
        const map = new Map<string, 'occupied' | 'vacant'>();
        units?.forEach(u => {
            // Check if there is ANY active lease for this unit
            const activeLease = leases?.find(l => l.unitId === u.id && isLeaseActive(l));
            map.set(u.id, activeLease ? 'occupied' : 'vacant');
        });
        return map;
    }, [units, leases]);

    const handleAddUnit = async (e: React.FormEvent) => {
        e.preventDefault();
        // floor and sizeSqm are now required
        if (!newUnit.buildingId || !newUnit.unitNumber || !newUnit.floor || !newUnit.sizeSqm) return;

        try {
            await db.units.add({
                id: uuidv4(),
                buildingId: newUnit.buildingId,
                unitNumber: newUnit.unitNumber,
                floor: newUnit.floor,
                unitType: newUnit.unitType as any,
                sizeSqm: parseFloat(newUnit.sizeSqm),
                rentPricingType: newUnit.rentPricingType as any,
                // Rent amount is optional, default to 0
                rentAmount: newUnit.rentAmount ? parseFloat(newUnit.rentAmount) : 0,
                status: 'vacant' // Initial default, but UI will override based on leases
            });
            setNewUnit({ buildingId: '', unitNumber: '', floor: '', unitType: 'apartment', sizeSqm: '', rentPricingType: 'fixed', rentAmount: '' });
            setShowAddForm(false);
        } catch (error) {
            console.error('Failed to add unit:', error);
        }
    };

    const getBuildingName = (id: string) => {
        return buildings?.find(b => b.id === id)?.name || 'Unknown Building';
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this unit?')) {
            await db.units.delete(id);
        }
    };

    return (
        <div className="container main-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h1>{t('units')}</h1>
                <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                    <Plus size={20} />
                    Add Unit
                </button>
            </div>

            {showAddForm && (
                <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                    <form onSubmit={handleAddUnit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-build" style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('buildings')}</label>
                                <select
                                    id="u-build"
                                    value={newUnit.buildingId}
                                    onChange={(e) => setNewUnit({ ...newUnit, buildingId: e.target.value })}
                                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem', background: 'var(--color-surface)' }}
                                    required
                                >
                                    <option value="">Select Building</option>
                                    {buildings?.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-type" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Type</label>
                                <select
                                    id="u-type"
                                    value={newUnit.unitType}
                                    onChange={(e) => setNewUnit({ ...newUnit, unitType: e.target.value })}
                                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem', background: 'var(--color-surface)' }}
                                >
                                    <option value="apartment">Apartment</option>
                                    <option value="shop">Shop</option>
                                    <option value="office">Office</option>
                                    <option value="store">Store</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-num" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Unit No.</label>
                                <input id="u-num" type="text" value={newUnit.unitNumber} onChange={(e) => setNewUnit({ ...newUnit, unitNumber: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem' }} required />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-floor" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Floor</label>
                                <input id="u-floor" type="text" value={newUnit.floor} onChange={(e) => setNewUnit({ ...newUnit, floor: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem' }} placeholder="G, 1, 2..." required />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-size" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Size (m²)</label>
                                <input id="u-size" type="number" value={newUnit.sizeSqm} onChange={(e) => setNewUnit({ ...newUnit, sizeSqm: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem' }} placeholder="80" required />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-ptype" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Pricing Type</label>
                                <select id="u-ptype" value={newUnit.rentPricingType} onChange={(e) => setNewUnit({ ...newUnit, rentPricingType: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem', background: 'var(--color-surface)' }}>
                                    <option value="fixed">Fixed Price</option>
                                    <option value="per_sqm">Price per m²</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label htmlFor="u-rent" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Default Rent (Optional)</label>
                                <input id="u-rent" type="number" value={newUnit.rentAmount} onChange={(e) => setNewUnit({ ...newUnit, rentAmount: e.target.value })} style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem' }} placeholder="0.00" />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{t('save')}</button>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)} style={{ flex: 1 }}>{t('cancel')}</button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {units?.map((unit) => {
                    const status = unitStatusMap.get(unit.id) || 'vacant';
                    return (
                        <div key={unit.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                                <div style={{ background: 'var(--color-bg)', padding: '10px', borderRadius: '50%' }}>
                                    <Home size={24} color={status === 'occupied' ? 'var(--color-success)' : 'var(--color-text-muted)'} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', marginBottom: '2px' }}>
                                        {(unit.unitType || 'unit').charAt(0).toUpperCase() + (unit.unitType || 'unit').slice(1)} {unit.unitNumber}
                                        <span style={{ fontSize: '0.8rem', opacity: 0.6, marginLeft: '8px', padding: '2px 6px', background: 'var(--color-bg)', borderRadius: '4px' }}>{unit.floor || 'G'} Floor</span>
                                    </h3>
                                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                        {getBuildingName(unit.buildingId)} • <span style={{ fontWeight: 600 }}>{unit.rentAmount} ETB</span> • {unit.sizeSqm || 0} m²
                                    </div>
                                    <div style={{ fontSize: '0.8rem', marginTop: '4px', color: status === 'occupied' ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                        {status === 'occupied' ? 'Occupied (Leased)' : 'Vacant'}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(unit.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', padding: '8px' }}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    );
                })}
                {units?.length === 0 && !showAddForm && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                        <p>No units added yet.</p>
                    </div>
                )}
            </div>
        </div>
    );


}
