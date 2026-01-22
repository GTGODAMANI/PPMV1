import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Wrench } from 'lucide-react';
import EmptyState from '../components/EmptyState';

export default function Maintenance() {
    const { t } = useTranslation();
    const maintenance = useLiveQuery(() => db.maintenance.toArray());
    const units = useLiveQuery(() => db.units.toArray());

    const [showAddForm, setShowAddForm] = useState(false);
    const [newIssue, setNewIssue] = useState({ unitId: '', description: '' });

    const handleAddIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newIssue.unitId || !newIssue.description) return;

        try {
            await db.maintenance.add({
                id: uuidv4(),
                unitId: newIssue.unitId,
                description: newIssue.description,
                status: 'open',
                date: new Date(),
                synced: false
            });
            setNewIssue({ unitId: '', description: '' });
            setShowAddForm(false);
        } catch (error) {
            console.error('Failed to add issue:', error);
        }
    };

    const updateStatus = async (id: string, status: 'open' | 'in_progress' | 'resolved') => {
        await db.maintenance.update(id, { status });
    };

    const getUnitName = (id: string) => {
        const unit = units?.find(u => u.id === id);
        return unit ? `Unit ${unit.unitNumber}` : 'Unknown Unit';
    };

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
                            {units?.map(u => <option key={u.id} value={u.id}>Unit {u.unitNumber}</option>)}
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
                {!maintenance ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
                ) : maintenance.length === 0 ? (
                    <EmptyState
                        title="No Maintenance Issues"
                        description="Everything is running smoothly! Log an issue if something needs attention."
                        icon={Wrench}
                        actionLabel="Report Issue"
                        onAction={() => setShowAddForm(true)}
                    />
                ) : (
                    maintenance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((issue) => (
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
                                        <h3 style={{ fontSize: '1.1rem', marginBottom: '2px' }}>{getUnitName(issue.unitId)}</h3>
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
