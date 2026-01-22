import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck, User } from 'lucide-react';
// import { useTranslation } from 'react-i18next';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    // const { t } = useTranslation();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const success = await login(username, password);
            if (success) {
                navigate('/');
            } else {
                setError('Invalid credentials');
            }
        } catch (err) {
            setError('Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Decorative Background Elements */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                right: '-10%',
                width: '500px',
                height: '500px',
                background: 'radial-gradient(circle, rgba(var(--primary-hue), 50%, 50%, 0.1) 0%, transparent 70%)',
                borderRadius: '50%',
                zIndex: -1
            }} />
            <div style={{
                position: 'absolute',
                bottom: '-10%',
                left: '-10%',
                width: '400px',
                height: '400px',
                background: 'radial-gradient(circle, rgba(var(--secondary-hue), 30%, 30%, 0.1) 0%, transparent 70%)',
                borderRadius: '50%',
                zIndex: -1
            }} />

            <div className="card" style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-8)' }}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                    <div style={{
                        background: 'var(--color-primary)',
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto var(--space-4)',
                        boxShadow: 'var(--shadow-gold)'
                    }}>
                        <ShieldCheck size={32} color="white" />
                    </div>
                    <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>Welcome</h1>
                    <p style={{ color: 'var(--color-text-muted)' }}>Property Management Suite</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: '0.9rem', fontWeight: 500 }}>Username</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                style={{ paddingLeft: '40px' }}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: '0.9rem', fontWeight: 500 }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <KeyRound size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                style={{ paddingLeft: '40px' }}
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            color: 'var(--color-danger)',
                            fontSize: '0.9rem',
                            textAlign: 'center',
                            padding: '8px',
                            background: 'hsla(350, 60%, 45%, 0.1)',
                            borderRadius: 'var(--radius-sm)'
                        }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: 'var(--space-2)' }}>
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        Default Admin: <strong>admin</strong> / <strong>admin123</strong>
                    </p>
                </div>
            </div>
        </div>
    );
}
