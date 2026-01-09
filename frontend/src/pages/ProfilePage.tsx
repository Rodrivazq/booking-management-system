import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import { useAuthStore } from '../hooks/useAuthStore'
import apiFetch from '../api'
import { useToast } from '../context/ToastContext'
import ThemeToggle from '../components/ThemeToggle'

export default function ProfilePage() {
    const { user, setUser } = useAuthStore()
    const { addToast } = useToast()
    const [activeTab, setActiveTab] = useState<'info' | 'security'>('info')
    const [loading, setLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [formData, setFormData] = useState({
        name: '',
        phoneNumber: '',
        photoUrl: '',
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
    })

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.name || '',
                phoneNumber: user.phoneNumber || '',
                photoUrl: user.photoUrl || ''
            }))
        }
    }, [user])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            if (file.size > 500000) { // 500KB limit
                addToast('La imagen es muy pesada (max 500KB)', 'error')
                return
            }
            const reader = new FileReader()
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, photoUrl: reader.result as string }))
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const payload: any = {
                name: formData.name,
                phoneNumber: formData.phoneNumber,
                photoUrl: formData.photoUrl
            }

            if (activeTab === 'security') {
                if (formData.newPassword) {
                    if (formData.newPassword !== formData.confirmNewPassword) {
                        throw new Error('Las nuevas contraseñas no coinciden')
                    }
                    if (!formData.currentPassword) {
                        throw new Error('Debes ingresar tu contraseña actual')
                    }
                    payload.currentPassword = formData.currentPassword
                    payload.newPassword = formData.newPassword
                }
            }

            const res = await apiFetch<{ user: any, message: string }>('/api/auth/profile', {
                method: 'PUT',
                body: JSON.stringify(payload)
            })

            setUser(res.user)
            addToast(res.message, 'success')

            // Clear password fields on success
            setFormData(prev => ({
                ...prev,
                currentPassword: '',
                newPassword: '',
                confirmNewPassword: ''
            }))
        } catch (error: any) {
            addToast(error.message || 'Error al actualizar perfil', 'error')
        } finally {
            setLoading(false)
        }
    }

    if (!user) return null

    return (
        <Layout title="Mi Perfil" subtitle="Gestiona tu información personal y preferencias">
            <button
                onClick={() => window.history.back()}
                className="btn btn-secondary"
                style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
                <span>←</span> Volver
            </button>

            <div className="grid-2" style={{ alignItems: 'start', gap: '2rem' }}>
                {/* Sidebar / User Card */}
                <div className="card" style={{ textAlign: 'center' }}>
                    <div
                        style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            margin: '0 auto 1.5rem',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '3rem',
                            color: 'white',
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: 'pointer',
                            border: '4px solid var(--bg)'
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        className="profile-avatar"
                    >
                        {formData.photoUrl ? (
                            <img src={formData.photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            user.name.charAt(0).toUpperCase()
                        )}
                        <div className="avatar-overlay" style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            fontSize: '0.7rem',
                            padding: '0.25rem',
                            textAlign: 'center'
                        }}>
                            Cambiar
                        </div>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    <h3>{user.name}</h3>
                    <p className="muted">{user.email}</p>
                    <div className="badge badge-success" style={{ marginTop: '0.5rem' }}>
                        {user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Administrador' : 'Usuario'}
                    </div>

                    <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', textAlign: 'left' }}>
                        <h4 style={{ marginBottom: '1rem' }}>Preferencias</h4>
                        <div className="flex-between">
                            <span>Tema</span>
                            <ThemeToggle />
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="card">
                    <div className="btn-group" style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                        <button
                            className={`btn ${activeTab === 'info' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveTab('info')}
                        >
                            Información Personal
                        </button>
                        <button
                            className={`btn ${activeTab === 'security' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveTab('security')}
                        >
                            Seguridad
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex-col">
                        {activeTab === 'info' ? (
                            <>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Nombre Completo</label>
                                    <input
                                        className="input"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Teléfono</label>
                                    <input
                                        className="input"
                                        name="phoneNumber"
                                        value={formData.phoneNumber}
                                        onChange={handleChange}
                                        placeholder="+598 99 123 456"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>URL de Foto de Perfil</label>
                                    <input
                                        className="input"
                                        name="photoUrl"
                                        value={formData.photoUrl}
                                        onChange={handleChange}
                                        placeholder="https://example.com/photo.jpg"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Número de Funcionario</label>
                                    <input
                                        className="input"
                                        value={user.funcNumber}
                                        disabled
                                        style={{ opacity: 0.7, cursor: 'not-allowed' }}
                                    />
                                    <small className="muted">Contacta a RRHH para cambiar esto.</small>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="badge badge-gray" style={{ marginBottom: '1rem' }}>
                                    Deja los campos vacíos si no deseas cambiar tu contraseña.
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Contraseña Actual</label>
                                    <input
                                        className="input"
                                        type="password"
                                        name="currentPassword"
                                        value={formData.currentPassword}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Nueva Contraseña</label>
                                    <input
                                        className="input"
                                        type="password"
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Confirmar Nueva Contraseña</label>
                                    <input
                                        className="input"
                                        type="password"
                                        name="confirmNewPassword"
                                        value={formData.confirmNewPassword}
                                        onChange={handleChange}
                                        placeholder="••••••••"
                                    />
                                </div>
                            </>
                        )}

                        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    )
}
