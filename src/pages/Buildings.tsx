import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { insertBuilding } from '../lib/supabaseHelpers';
import type { Database } from '../lib/database.types';
import { v4 as uuidv4 } from 'uuid';
import { Plus, MapPin, Building2, Trash2 } from 'lucide-react';

type Building = Database['public']['Tables']['buildings']['Row'];

export default function Buildings() {
    const { t } = useTranslation();
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newBuilding, setNewBuilding] = useState({ 
        name: '', 
        location: '', 
        numberOfFloors: 1, 
        floorUnits: [1] // Array: one entry per floor
    });

    useEffect(() => {
        fetchBuildings();
    }, []);

    async function fetchBuildings() {
        setLoading(true);
        setError(null);
        const { data, error: fetchError } = await supabase
            .from('buildings')
            .select('*')
            .order('name');

        if (fetchError) {
            setError(fetchError.message);
        } else {
            setBuildings(data || []);
        }
        setLoading(false);
    }

    const handleAddBuilding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBuilding.name) return;

        try {
            const buildingId = uuidv4();
            const { error: insertError } = await insertBuilding({
                id: buildingId,
                name: newBuilding.name,
                location: newBuilding.location
            });

            if (insertError) {
                console.error('Failed to add building:', insertError);
                setError(insertError.message);
                return;
            }

            // Generate units
            const units = [];
            for (let floor = 0; floor < newBuilding.numberOfFloors; floor++) {
                const floorLabel = floor === 0 ? 'G' : floor.toString();
                const unitsOnThisFloor = newBuilding.floorUnits[floor] || 1;
                
                for (let unit = 1; unit <= unitsOnThisFloor; unit++) {
                    const unitNumber = `${floorLabel}${unit.toString().padStart(2, '0')}`;
                    
                    units.push({
                        id: uuidv4(),
                        building_id: buildingId,
                        unit_number: unitNumber,
                        floor: floorLabel,
                        unit_type: 'apartment',
                        size_sqm: 1, // FIX: Changed from 0 to 1 to satisfy CHECK constraint
                        rent_pricing_type: 'fixed',
                        rent_amount: null,
                        status: 'vacant'
                    });
                }
            }

            // Debug logging
            console.log('=== UNIT GENERATION DEBUG ===');
            console.log('Building ID:', buildingId);
            console.log('Units to insert:', units.length);
            console.log('Sample unit:', units[0]);

            // Bulk insert units with verification
            const { data: insertedUnits, error: unitsError } = await supabase
                .from('units')
                .insert(units as any)
                .select();
            
            console.log('Insert result:', { data: insertedUnits, error: unitsError });
            console.log('=== END DEBUG ===');

            if (unitsError) {
                console.error('Failed to create units:', unitsError);
                
                // Rollback: Delete the building
                await supabase.from('buildings').delete().eq('id', buildingId);
                
                setError(`Failed to create building: ${unitsError.message}`);
                return; // STOP execution
            }

            // Verify actual insert
            if (!insertedUnits || insertedUnits.length === 0) {
                // Rollback: Delete the building
                await supabase.from('buildings').delete().eq('id', buildingId);
                
                setError('Failed to create units. Please try again.');
                return; // STOP execution
            }

            // Success - show actual count
            alert(`Building created with ${insertedUnits.length} units successfully!`);
            
            setNewBuilding({ name: '', location: '', numberOfFloors: 1, floorUnits: [1] });
            setShowAddForm(false);
            fetchBuildings();
        } catch (error) {
            console.error('Failed to add building:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this building?')) {
            const { error: deleteError } = await supabase
                .from('buildings')
                .delete()
                .eq('id', id);

            if (deleteError) {
                console.error('Failed to delete building:', deleteError);
                setError(deleteError.message);
            } else {
                fetchBuildings();
            }
        }
    };

    if (loading) {
        return (
            <div className="container main-content">
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    Loading buildings...
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

    return (
        <div className="container main-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h1>{t('buildings')}</h1>
                <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                    <Plus size={20} />
                    {t('add_building')}
                </button>
            </div>

            {showAddForm && (
                <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                    <form onSubmit={handleAddBuilding} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label htmlFor="b-name" style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('name')}</label>
                            <input
                                id="b-name"
                                type="text"
                                value={newBuilding.name}
                                onChange={(e) => setNewBuilding({ ...newBuilding, name: e.target.value })}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem' }}
                                placeholder="Apartment Name"
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label htmlFor="b-loc" style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t('location')}</label>
                            <input
                                id="b-loc"
                                type="text"
                                value={newBuilding.location}
                                onChange={(e) => setNewBuilding({ ...newBuilding, location: e.target.value })}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem' }}
                                placeholder="City, District"
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label htmlFor="b-floors" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Number of Floors</label>
                            <input
                                id="b-floors"
                                type="number"
                                min="1"
                                value={newBuilding.numberOfFloors}
                                onChange={(e) => {
                                    const floors = parseInt(e.target.value) || 1;
                                    const newFloorUnits = Array(floors).fill(1);
                                    setNewBuilding({ ...newBuilding, numberOfFloors: floors, floorUnits: newFloorUnits });
                                }}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Floor Configuration</label>
                            {Array.from({ length: newBuilding.numberOfFloors }).map((_, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ minWidth: '100px', fontSize: '0.9rem' }}>
                                        {index === 0 ? 'Ground (G):' : `Floor ${index}:`}
                                    </span>
                                    <input
                                        type="number"
                                        min="1"
                                        value={newBuilding.floorUnits[index]}
                                        onChange={(e) => {
                                            const updated = [...newBuilding.floorUnits];
                                            updated[index] = parseInt(e.target.value) || 1;
                                            setNewBuilding({ ...newBuilding, floorUnits: updated });
                                        }}
                                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '0.9rem', width: '80px' }}
                                    />
                                    <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>units</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ padding: '8px', background: 'var(--color-bg)', borderRadius: '4px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                            Total: {newBuilding.floorUnits.reduce((sum, n) => sum + n, 0)} units
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{t('save')}</button>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)} style={{ flex: 1 }}>{t('cancel')}</button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {buildings.map((building) => (
                    <div key={building.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                            <div style={{ background: 'var(--color-bg)', padding: '10px', borderRadius: '50%' }}>
                                <Building2 size={24} color="var(--color-primary)" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', marginBottom: '2px' }}>{building.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                                    <MapPin size={14} />
                                    <span>{building.location || 'No location'}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => handleDelete(building.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', padding: '8px' }}
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}

                {buildings.length === 0 && !showAddForm && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                        <p>No buildings yet. Add one to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
