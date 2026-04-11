import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { insertMaintenance, updateMaintenance } from '../lib/supabaseHelpers';
import type { Database } from '../lib/database.types';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Wrench } from 'lucide-react';
import EmptyState from '../components/EmptyState';

type Maintenance = Database['public']['Tables']['maintenance']['Row'];
type Unit = Database['public']['Tables']['units']['Row'];

export default function Maintenance() {
    const { t } = useTranslation();
    const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newIssue, setNewIssue] = useState({ unitId: '', description: '' });

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        setError(null);

        const [maintenanceResult, unitsResult] = await Promise.all([
            supabase.from('maintenance').select('*').order('date', { ascending: false }),
            supabase.from('units').select('*').order('unit_number')
        ]);

        if (maintenanceResult.error) {
            setError(maintenanceResult.error.message);
        } else if (unitsResult.error) {
            setError(unitsResult.error.message);
        } else {
            setMaintenance(maintenanceResult.data || []);
            setUnits(unitsResult.data || []);
        }

        setLoading(false);
    }

    const handleAddIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newIssue.unitId || !newIssue.description) return;

        try {
            const { error: insertError } = await insertMaintenance({
                id: uuidv4(),
                unit_id: newIssue.unitId,
                description: newIssue.description,
                status: 'open',
                date: new Date().toISOString(),
                synced: false
            });

            if (insertError) {
                console.error('Failed to add issue:', insertError);
                setError(insertError.message);
            } else {
                setNewIssue({ unitId: '', description: '' });
                setShowAddForm(false);
                fetchData();
            }
        } catch (error) {
            console.error('Failed to add issue:', error);
        }
    };

    const updateStatus = async (id: string, status: 'open' | 'in_progress' | 'resolved') => {
        const { error: updateError } = await updateMaintenance(id, { status });

        if (updateError) {
            console.error('Failed to update status:', updateError);
            setError(updateError.message);
        } else {
            fetchData();
        }
    };

    const getUnitName = (id: string) => {
        const unit = units.find(u => u.id === id);
        return unit ? `Unit ${unit.unit_number}` : 'Unknown Unit';
    };

    if (loading) {
        return (
            <div className="container main-content">
                <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--color-text-muted)' }}>
                    Loading maintenance issues...
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
                <h1>{t('maintenance')}</h1>
                <button className="btn btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
                    <Plus size={20} />
                    Report Issue
                </button>
            </div>

            {showAddForm && (
                <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                    <form onSubmit={handleAddIssue} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        <select
                            value={newIssue.unitId}
                            onChange={(e) => setNewIssue({ ...newIssue, unitId: e.target.value })}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem', background: 'var(--color-surface)' }}
                            required
                        >
                            <option value="">Select Unit</option>
                            {units.map(u => <option key={u.id} value={u.id}>Unit {u.unit_number}</option>)}
                        </select>

                        <textarea
                            value={newIssue.description}
                            onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                            placeholder="Describe the issue..."
                            rows={3}
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '1rem', fontFamily: 'inherit' }}
                            required
                        />

                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Submit</button>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                {maintenance.length === 0 ? (
                    <EmptyState
                        title="No Maintenance Issues"
                        description="Everything is running smoothly! Log an issue if something needs attention."
                        icon={Wrench}
                        actionLabel="Report Issue"
                        onAction={() => setShowAddForm(true)}
                    />
                ) : (
                    maintenance.map((issue) => (
                        <div key={issue.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                                    <div style={{
                                        background: issue.status === 'resolved' ? 'hsla(145, 65%, 40%, 0.1)' :
                                            issue.status === 'in_progress' ? 'hsla(40, 90%, 50%, 0.1)' :
                                                'hsla(0, 80%, 55%, 0.1)',
                                        padding: '10px',
                                        borderRadius: '50%',
                                        height: 'fit-content'
                                    }}>
                                        <Wrench size={20} color={
                                            issue.status === 'resolved' ? 'var(--color-success)' :
                                                issue.status === 'in_progress' ? 'var(--color-warning)' :
                                                    'var(--color-danger)'
                                        } />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.1rem', marginBottom: '2px' }}>{getUnitName(issue.unit_id)}</h3>
                                        <p style={{ fontSize: '0.95rem', color: 'var(--color-text-main)' }}>{issue.description}</p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                                    {new Date(issue.date).toLocaleDateString()}
                                </span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {(['open', 'in_progress', 'resolved'] as const).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => updateStatus(issue.id, s)}
                                            style={{
                                                border: '1px solid var(--color-border)',
                                                background: issue.status === s ? 'var(--color-bg)' : 'transparent',
                                                opacity: issue.status === s ? 1 : 0.5,
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {s.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
