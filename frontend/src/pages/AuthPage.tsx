import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../hooks/useAuthStore'
import apiFetch from '../api'
import ThemeToggle from '../components/ThemeToggle'
import AvatarUploader, { type AvatarUploaderHandle } from '../components/AvatarUploader'
import { useToast } from '../context/ToastContext'

import { useSettings } from '../context/SettingsContext'

export default function AuthPage() {
    const { settings } = useSettings()
    const [isLogin, setIsLogin] = useState(true)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const avatarRef = useRef<AvatarUploaderHandle>(null)
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        funcNumber: '',
        documentId: '',
        phoneNumber: '',
        identifier: '',
        confirmPassword: '',
        photoUrl: ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const setUser = useAuthStore((s) => s.setUser)
    const navigate = useNavigate()
    const { addToast } = useToast()

    const [rememberMe, setRememberMe] = useState(false)
    const [keepSession, setKeepSession] = useState(false)

    // useEffect(() => {
    //     const savedIdentifier = localStorage.getItem('rememberedIdentifier')
    //     if (savedIdentifier) {
    //         setFormData(prev => ({ ...prev, identifier: savedIdentifier }))
    //         setRememberMe(true)
    //     }
    // }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            if (!isLogin && formData.password !== formData.confirmPassword) {
                throw new Error('Las contraseñas no coinciden')
            }

            if (!isLogin && !formData.photoUrl) {
                throw new Error('Debes subir una foto de perfil obligatoriamente para registrarte')
            }

            if (isLogin) {
                // LOGIN FLOW
                const res = await apiFetch<{ token: string, user: any }>('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ identifier: formData.identifier, password: formData.password, keepSession })
                })

                localStorage.setItem('token', res.token)
                setUser(res.user)

                if (rememberMe) {
                    localStorage.setItem('rememberedIdentifier', formData.identifier)
                } else {
                    localStorage.removeItem('rememberedIdentifier')
                }

                if (res.user.role === 'admin' || res.user.role === 'superadmin') {
                    navigate('/admin')
                } else {
                    navigate('/user')
                }
            } else {
                // REGISTER FLOW
                await apiFetch<{ message: string }>('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: formData.name,
                        email: formData.email,
                        password: formData.password,
                        funcNumber: formData.funcNumber,
                        documentId: formData.documentId,
                        phoneNumber: formData.phoneNumber,
                        photoUrl: formData.photoUrl
                    })
                })
                // Registration succeeded — show success prompt to verify email
                setError('')
                addToast('✅ Cuenta creada. Revisa tu correo y verifica tu cuenta antes de ingresar.', 'success')
                setIsLogin(true)
            }
        } catch (err: any) {
            setError(err.message || 'Error de autenticacion')
        } finally {
            setLoading(false)
        }
    }

    const handleForgot = async () => {
        if (!formData.identifier) {
            addToast('Ingresa tu correo o nro de funcionario para recuperar', 'error')
            return
        }
        setLoading(true)
        try {
            await apiFetch('/api/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ identifier: formData.identifier })
            })
            addToast('Se ha recibido tu solicitud. Revisa tu bandeja de entrada o spam.', 'info')
        } catch (e: any) {
            addToast(e.message || 'Error al solicitar recuperación', 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-container">
            {/* Left Side - Hero */}
            <div className="auth-hero" style={settings.loginBackgroundImage ? { backgroundImage: `url(${settings.loginBackgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
                <div className="auth-hero-content" style={settings.loginBackgroundImage ? { background: 'rgba(0,0,0,0.6)', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4rem' } : {}}>
                    {settings.logoUrl ? (
                        <img src={settings.logoUrl} alt="Logo" style={{ width: '8rem', height: '8rem', objectFit: 'contain', marginBottom: '2rem' }} />
                    ) : (
                        <div className="logo-icon" style={{ width: '4rem', height: '4rem', fontSize: '2rem', marginBottom: '2rem', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
                            R
                        </div>
                    )}
                    <h1>{settings.welcomeTitle || settings.companyName}</h1>
                    <p>{settings.welcomeMessage || 'Gestiona tus comidas diarias de forma eficiente. Planifica tu semana y disfruta de un servicio de comedor de primera clase.'}</p>

                    <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem' }}>
                        <div>
                            <h3 style={{ color: 'white', fontSize: '2rem', marginBottom: '0' }}>+1k</h3>
                            <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Usuarios Activos</p>
                        </div>
                        <div>
                            <h3 style={{ color: 'white', fontSize: '2rem', marginBottom: '0' }}>4.8</h3>
                            <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Satisfaccion</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="auth-form-container animate-fade-in" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                    <ThemeToggle />
                </div>
                <div className="auth-header">
                    <h2>{isLogin ? 'Bienvenido de nuevo' : 'Crear Cuenta'}</h2>
                    <p className="muted">
                        {isLogin ? 'Ingresa tus credenciales para acceder a tu panel.' : 'Registrate para comenzar a gestionar tus reservas.'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex-col" autoComplete="off">
                    {isLogin ? (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Correo o Nro Funcionario</label>
                            <input
                                className="input"
                                name="identifier"
                                type="text"
                                value={formData.identifier}
                                onChange={handleChange}
                                placeholder="ej. juan@empresa.com o 12345"
                                required
                                autoComplete="username"
                                spellCheck="false"
                            />
                        </div>
                    ) : (
                        <>
                            <div style={{ paddingBottom: '1rem', textAlign: 'center' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Foto de Perfil (Obligatoria)</label>
                                <AvatarUploader 
                                    ref={avatarRef}
                                    currentPhotoUrl={formData.photoUrl}
                                    onPhotoChange={(url) => setFormData(prev => ({ ...prev, photoUrl: url }))}
                                    nameForInitials={formData.name || 'U'}
                                    size="100px"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre Completo</label>
                                <input
                                    className="input"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Juan Perez"
                                    required
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Correo Electronico</label>
                                <input
                                    className="input"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="juan@empresa.com"
                                    required
                                />
                            </div>
                            <div className="grid-2" style={{ gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nro Funcionario</label>
                                    <input
                                        className="input"
                                        name="funcNumber"
                                        inputMode="numeric"
                                        value={formData.funcNumber}
                                        onChange={e => setFormData(prev => ({ ...prev, funcNumber: e.target.value.replace(/\D/g, '') }))}
                                        placeholder="12345"
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Documento (DNI/CI) Obligatorio</label>
                                    <input
                                        className="input"
                                        name="documentId"
                                        inputMode="numeric"
                                        value={formData.documentId}
                                        onChange={e => setFormData(prev => ({ ...prev, documentId: e.target.value.replace(/\D/g, '') }))}
                                        placeholder="12345678"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Celular</label>
                                <input
                                    className="input"
                                    name="phoneNumber"
                                    value={formData.phoneNumber}
                                    onChange={handleChange}
                                    placeholder="099123456"
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                            <label style={{ fontWeight: 500 }}>Contrasena</label>
                            {isLogin && (
                                <button
                                    type="button"
                                    onClick={handleForgot}
                                    className="btn"
                                    style={{ background: 'transparent', color: 'var(--accent)', fontSize: '0.85rem', padding: 0, height: 'auto' }}
                                >
                                    ¿Olvidaste tu contrasena?
                                </button>
                            )}
                        </div>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="input"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required
                                autoComplete="new-password"
                                style={{ paddingRight: '2.5rem' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {!isLogin && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Confirmar Contraseña</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="input"
                                    name="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    required
                                    style={{ paddingRight: '2.5rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                                >
                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                    )}

                    {isLogin && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="rememberMe"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    style={{ accentColor: 'var(--accent)', width: '1rem', height: '1rem' }}
                                />
                                <label htmlFor="rememberMe" style={{ cursor: 'pointer', userSelect: 'none' }}>Recordar usuario</label>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="keepSession"
                                    checked={keepSession}
                                    onChange={(e) => setKeepSession(e.target.checked)}
                                    style={{ accentColor: 'var(--accent)', width: '1rem', height: '1rem' }}
                                />
                                <label htmlFor="keepSession" style={{ cursor: 'pointer', userSelect: 'none' }}>Mantener sesion iniciada</label>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="badge" style={{ background: '#fee2e2', color: '#991b1b', width: '100%', justifyContent: 'center', padding: '0.75rem' }}>
                            {error}
                        </div>
                    )}

                    {!isLogin && (
                        <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                            <button 
                                type="button" 
                                className="btn btn-sm btn-secondary" 
                                onClick={() => avatarRef.current?.openPicker()}
                                style={{ fontSize: '0.95rem', width: '100%', padding: '0.75rem', fontWeight: 600, border: '2px dashed var(--accent)', color: 'var(--accent)', background: 'transparent' }}
                            >
                                📸 Cargar Foto de Perfil
                            </button>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }} disabled={loading}>
                        {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesion' : 'Crear Cuenta')}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <p className="muted" style={{ fontSize: '0.9rem' }}>
                        {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                        <button
                            onClick={() => { setIsLogin(!isLogin); setError(''); }}
                            className="btn"
                            style={{ background: 'transparent', color: 'var(--accent)', padding: '0 0.5rem', height: 'auto', display: 'inline', fontWeight: 600 }}
                        >
                            {isLogin ? 'Registrate aqui' : 'Inicia Sesion'}
                        </button>
                    </p>
                </div>

                <div style={{ marginTop: 'auto', textAlign: 'center', paddingTop: '2rem' }}>
                    <p className="muted" style={{ fontSize: '0.8rem' }}>
                        &copy; {new Date().getFullYear()} Reservas App. Todos los derechos reservados.
                    </p>
                </div>
            </div>
        </div>
    )
}
