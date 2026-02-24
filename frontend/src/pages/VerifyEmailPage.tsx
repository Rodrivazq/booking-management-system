import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import apiFetch from '../api';

export default function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
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

    return (
        <div className="auth-container">
            <div className="card glass-effect" style={{ maxWidth: '450px', width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
                <div style={{ marginBottom: '2rem' }}>
                    {status === 'loading' && (
                        <div style={{ width: '60px', height: '60px', border: '5px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                    )}
                    
                    {status === 'success' && (
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', margin: '0 auto' }}>
                            ✓
                        </div>
                    )}

                    {status === 'error' && (
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', margin: '0 auto' }}>
                            ✕
                        </div>
                    )}
                </div>

                <h2 style={{ marginBottom: '1rem' }}>
                    {status === 'loading' ? 'Verificando...' : status === 'success' ? '¡Correo Verificado!' : 'Error de Verificación'}
                </h2>
                
                <p className="muted" style={{ marginBottom: '2rem', lineHeight: '1.6' }}>
                    {message}
                </p>

                {(status === 'success' || status === 'error') && (
                    <Link to="/auth" className="btn btn-primary" style={{ display: 'inline-block', width: '100%' }}>
                        Ir al Inicio de Sesión
                    </Link>
                )}
            </div>
        </div>
    );
}
