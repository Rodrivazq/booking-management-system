import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import apiFetch from '../api';
import Icon from '../components/Icon';
import { useSettings } from '../context/SettingsContext';

export default function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const { settings } = useSettings();

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verificando tu correo electrónico...');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Enlace de verificación inválido o inexistente.');
            return;
        }
        const verify = async () => {
            try {
                const res = await apiFetch<{ message: string }>(`/api/auth/verify-email?token=${token}`);
                setStatus('success');
                setMessage(res.message);
            } catch (error: any) {
                setStatus('error');
                setMessage(error.message || 'Error al verificar el correo electrónico.');
            }
        };
        verify();
    }, [token]);

    const accent = status === 'success' ? 'var(--rating-liked)' : status === 'error' ? 'var(--warning-text)' : 'var(--accent)';
    const accentBg = status === 'success' ? 'var(--success-bg)' : status === 'error' ? 'var(--warning-bg)' : 'var(--accent-light)';

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: 'var(--bg)' }}>
            <div className="card animate-fade-in" style={{ maxWidth: '460px', width: '100%', textAlign: 'center', padding: '2.5rem 2rem' }}>
                <img
                    src={settings.logoUrl || '/assets/logo_real_sabor_clean.png'}
                    alt={settings.companyName}
                    style={{ width: '64px', height: '64px', objectFit: 'contain', margin: '0 auto 1.5rem', display: 'block' }}
                />

                <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: accentBg, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                    {status === 'loading' ? (
                        <div style={{ width: '40px', height: '40px', border: '4px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    ) : status === 'success' ? (
                        <Icon name="check" size={42} />
                    ) : (
                        <Icon name="alert" size={40} />
                    )}
                </div>

                <h2 style={{ marginBottom: '0.75rem', fontSize: '1.5rem' }}>
                    {status === 'loading' ? 'Verificando…' : status === 'success' ? '¡Correo verificado!' : 'Enlace ya usado o expirado'}
                </h2>

                <p className="muted" style={{ marginBottom: '2rem', lineHeight: 1.6 }}>
                    {message}
                </p>

                {(status === 'success' || status === 'error') && (
                    <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0.9rem' }}>
                        Ir al inicio de sesión
                    </Link>
                )}
            </div>
        </div>
    );
}
