import { useSettings } from '../context/SettingsContext';

import { useNavigate } from 'react-router-dom';

export default function MaintenancePage() {
    const { settings } = useSettings();
    const navigate = useNavigate();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            textAlign: 'center',
            padding: '2rem',
            background: 'var(--bg)',
            color: 'var(--text)'
        }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛠️</div>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Estamos en Mantenimiento</h1>
            <p style={{ fontSize: '1.2rem', maxWidth: '600px', opacity: 0.8 }}>
                {settings.companyName} está realizando mejoras en el sistema.
                Por favor, vuelve a intentarlo más tarde.
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button
                    onClick={() => window.location.reload()}
                    className="btn btn-primary"
                >
                    Recargar Página
                </button>
                <button
                    onClick={() => navigate('/login')}
                    className="btn"
                    style={{ background: 'transparent', border: '1px solid var(--text)', color: 'var(--text)' }}
                >
                    Soy Administrador
                </button>
            </div>
        </div>
    );
}
