// import React from 'react';
import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    title: string;
    description: string;
    icon: LucideIcon;
    actionLabel?: string;
    onAction?: () => void;
}

export default function EmptyState({ title, description, icon: Icon, actionLabel, onAction }: EmptyStateProps) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-8)',
            textAlign: 'center',
            background: 'var(--color-surface-glass)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border)',
            minHeight: '300px'
        }}>
            <div style={{
                background: 'hsla(35, 60%, 50%, 0.1)',
                padding: '20px',
                borderRadius: '50%',
                marginBottom: 'var(--space-4)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
                <Icon size={48} color="var(--color-primary)" strokeWidth={1.5} />
            </div>

            <h3 style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '1.5rem',
                marginBottom: 'var(--space-2)',
                color: 'var(--color-text-main)'
            }}>
                {title}
            </h3>

            <p style={{
                color: 'var(--color-text-muted)',
                maxWidth: '400px',
                marginBottom: 'var(--space-6)',
                lineHeight: 1.6
            }}>
                {description}
            </p>

            {actionLabel && onAction && (
                <button className="btn btn-primary" onClick={onAction}>
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
