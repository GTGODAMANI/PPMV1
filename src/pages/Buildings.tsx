import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Plus, MapPin, Building2, Trash2 } from 'lucide-react';

export default function Buildings() {
    const { t } = useTranslation();
    const buildings = useLiveQuery(() => db.buildings.toArray());
    const [showAddForm, setShowAddForm] = useState(false);
    const [newBuilding, setNewBuilding] = useState({ name: '', location: '' });

    const handleAddBuilding = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBuilding.name) return;

        try {
            await db.buildings.add({
                id: uuidv4(),
                name: newBuilding.name,
                location: newBuilding.location
            });
            setNewBuilding({ name: '', location: '' });
            setShowAddForm(false);
        } catch (error) {
            console.error('Failed to add building:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this building?')) {
            await db.buildings.delete(id);
        }
    };

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

                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{t('save')}</button>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)} style={{ flex: 1 }}>{t('cancel')}</button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {buildings?.map((building) => (
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

                {buildings?.length === 0 && !showAddForm && (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                        <p>No buildings yet. Add one to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
