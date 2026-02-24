export default function LoadingScreen() {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg)',
            zIndex: 9999
        }}>
            <div className="spinner" style={{
                width: '50px',
                height: '50px',
                border: '4px solid var(--border)',
                borderTop: '4px solid var(--primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '1rem'
            }}></div>
            <h2 style={{ color: 'var(--text)', fontWeight: 600, letterSpacing: '0.5px' }}>
                Preparando el sistema...
            </h2>
            <p className="muted" style={{ marginTop: '0.5rem' }}>Cargando preferencias y recursos</p>
            <style>
                {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}
            </style>
        </div>
    );
}
