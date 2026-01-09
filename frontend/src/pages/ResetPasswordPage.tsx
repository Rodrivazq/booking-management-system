import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import apiFetch from '../api'
import { useToast } from '../context/ToastContext'
import Layout from '../components/Layout'

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')
    const navigate = useNavigate()
    const { addToast } = useToast()

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            addToast('Las contraseñas no coinciden', 'error')
            return
        }
        if (!token) {
            addToast('Token inválido o faltante', 'error')
            return
        }

        setLoading(true)
        try {
            await apiFetch('/api/auth/reset', {
                method: 'POST',
                body: JSON.stringify({ token, password })
            })
            addToast('Contraseña restablecida con éxito', 'success')
            navigate('/login')
        } catch (error: any) {
            addToast(error.message || 'Error al restablecer contraseña', 'error')
        } finally {
            setLoading(false)
        }
    }

    if (!token) {
        return (
            <Layout showLogout={false}>
                <div className="card" style={{ maxWidth: '400px', margin: '2rem auto', textAlign: 'center' }}>
                    <h2 style={{ color: 'var(--error)' }}>Enlace Inválido</h2>
                    <p>El enlace de recuperación no es válido o ha expirado.</p>
                    <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                        Volver al Inicio
                    </button>
                </div>
            </Layout>
        )
    }

    return (
        <Layout showLogout={false}>
            <div style={{ maxWidth: '400px', margin: '2rem auto' }}>
                <div className="card animate-fade-in">
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <h2 style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>Restablecer Contraseña</h2>
                        <p className="muted">Ingresa tu nueva contraseña</p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-col">
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nueva Contraseña</label>
                            <input
                                className="input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Confirmar Contraseña</label>
                            <input
                                className="input"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '1rem', padding: '1rem' }}
                            disabled={loading}
                        >
                            {loading ? 'Procesando...' : 'Cambiar Contraseña'}
                        </button>
                    </form>
                </div>
            </div>
        </Layout>
    )
}
