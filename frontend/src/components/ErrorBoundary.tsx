import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100vh',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text)',
                    textAlign: 'center',
                    padding: '2rem'
                }}>
                    <div className="card" style={{ maxWidth: '500px', padding: '3rem' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>😕</div>
                        <h1 style={{ marginBottom: '1rem' }}>Ups, algo salió mal</h1>
                        <p className="muted" style={{ marginBottom: '2rem' }}>
                            Ha ocurrido un error inesperado. Por favor, intenta recargar la página.
                        </p>
                        {import.meta.env.DEV && this.state.error && (
                            <pre style={{
                                textAlign: 'left',
                                background: 'var(--input-bg)',
                                padding: '1rem',
                                borderRadius: 'var(--radius)',
                                overflow: 'auto',
                                marginBottom: '2rem',
                                fontSize: '0.8rem',
                                color: 'var(--error-text)'
                            }}>
                                {this.state.error.toString()}
                            </pre>
                        )}
                        <button
                            className="btn btn-primary"
                            onClick={() => window.location.reload()}
                            style={{ width: '100%' }}
                        >
                            Recargar Página
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
