import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../hooks/useAuthStore'
import apiFetch from '../api'
import ThemeToggle from '../components/ThemeToggle'
import AvatarUploader from '../components/AvatarUploader'
import { useToast } from '../context/ToastContext'
import { Turnstile } from '@marsidev/react-turnstile'

import { useSettings } from '../context/SettingsContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isValidEmail = (e: string) => EMAIL_RE.test((e || '').trim())
const passwordIssue = (p: string): string | null => {
    if (!p || p.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
    if (!/[A-Z]/.test(p)) return 'La contraseña debe incluir al menos una mayúscula.'
    if (!/[a-z]/.test(p)) return 'La contraseña debe incluir al menos una minúscula.'
    if (!/[0-9]/.test(p)) return 'La contraseña debe incluir al menos un número.'
    return null
}

export default function AuthPage() {
    const { settings } = useSettings()
    const [isLogin, setIsLogin] = useState(true)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [registrationComplete, setRegistrationComplete] = useState(false)
    const [registeredEmail, setRegisteredEmail] = useState('')
    const [registrationWarning, setRegistrationWarning] = useState(false)
    const [resendingVerification, setResendingVerification] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)
    const [formData, setFormData] = useState({
        email: '',
        confirmEmail: '',
        password: '',
        name: '',
        firstName: '',
        lastName: '',
        funcNumber: '',
        documentId: '',
        phoneNumber: '',
        identifier: '',
        confirmPassword: '',
        photoUrl: ''
    })
    const [turnstileToken, setTurnstileToken] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showForgotModal, setShowForgotModal] = useState(false)
    const [forgotEmail, setForgotEmail] = useState('')
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
            if (!isLogin && formData.email.trim().toLowerCase() !== formData.confirmEmail.trim().toLowerCase()) {
                throw new Error('Los correos electrónicos no coinciden. Revisá que estén bien escritos en ambos campos.')
            }

            if (!isLogin && formData.password !== formData.confirmPassword) {
                throw new Error('Las contraseñas no coinciden')
            }

            if (!isLogin && !formData.photoUrl) {
                throw new Error('Subí una foto de perfil para continuar.')
            }

            if (!isLogin && (!formData.firstName.trim() || !formData.lastName.trim())) {
                throw new Error('Ingresá tu nombre y tu apellido.')
            }

            if (!isLogin && !isValidEmail(formData.email)) {
                throw new Error('Ingresá un correo electrónico válido.')
            }

            if (!isLogin) {
                const pwIssue = passwordIssue(formData.password)
                if (pwIssue) throw new Error(pwIssue)
            }

            if (import.meta.env.VITE_TURNSTILE_SITE_KEY && !turnstileToken) {
                 throw new Error('Por favor, completa la verificación anti-bot de Cloudflare')
            }

            if (isLogin) {
                // LOGIN FLOW
                const res = await apiFetch<{ token: string, user: any }>('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ identifier: formData.identifier, password: formData.password, keepSession, turnstileToken })
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
                const res = await apiFetch<{ message: string; warning?: boolean }>('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
                        email: formData.email,
                        password: formData.password,
                        funcNumber: formData.funcNumber,
                        documentId: formData.documentId,
                        phoneNumber: formData.phoneNumber,
                        photoUrl: formData.photoUrl,
                        turnstileToken
                    })
                })
                // Registration succeeded — show dedicated "check your email" screen.
                // Captures backend's warning flag so a failed email send is surfaced
                // instead of silently telling the user "check your inbox".
                setError('')
                setRegisteredEmail(formData.email)
                setRegistrationWarning(res.warning === true)
                setRegistrationComplete(true)
                // Clear sensitive fields so they don't sit in memory if user comes back
                setFormData(prev => ({ ...prev, password: '', confirmPassword: '', confirmEmail: '' }))
            }
        } catch (err: any) {
            setError(err.message || 'Error de autenticación')
        } finally {
            setLoading(false)
        }
    }

    const handleResendVerification = async () => {
        if (!registeredEmail || resendingVerification || resendCooldown > 0) return
        setResendingVerification(true)
        try {
            const res = await apiFetch<{ message?: string }>('/api/auth/resend-verification', {
                method: 'POST',
                body: JSON.stringify({ email: registeredEmail })
            })
            addToast(res.message || 'Si la cuenta existe, te reenviamos el correo. Revisá bandeja y SPAM.', 'success')
            // Cooldown 60s para evitar que el usuario martille y se coma el rate limit (3/15min)
            setResendCooldown(60)
            const interval = setInterval(() => {
                setResendCooldown(prev => {
                    if (prev <= 1) { clearInterval(interval); return 0 }
                    return prev - 1
                })
            }, 1000)
        } catch (e: any) {
            addToast(e.message || 'No pudimos reenviar el correo. Probá en unos minutos.', 'error')
        } finally {
            setResendingVerification(false)
        }
    }

    const handleForgot = () => {
        setShowForgotModal(true);
        setForgotEmail(''); // Clear previous input
    }

    const submitForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotEmail) {
            addToast('Por favor, ingresa tu correo electrónico.', 'error')
            return
        }
        setLoading(true)
        try {
            const res = await apiFetch<{ message?: string }>('/api/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email: forgotEmail })
            })
            addToast(res.message || 'Si el correo existe, recibirás un enlace para restablecer tu contraseña.', 'info')
            setShowForgotModal(false)
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
                        <img src={settings.logoUrl} alt="Logo" className="premium-logo" style={{ width: '8rem', height: '8rem', padding: '12px', marginBottom: '2rem' }} />
                    ) : (
                        <img src="/assets/logo_real_sabor_clean.png" alt="Logo" className="premium-logo" style={{ width: '8rem', height: '8rem', padding: '12px', marginBottom: '2rem' }} />
                    )}
                    <h1>{settings.welcomeTitle || settings.companyName}</h1>
                    <p>{settings.welcomeMessage || 'Gestioná tus comidas semanales de forma simple. Elegí tu menú, recibí recordatorios y dejá tu opinión.'}</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem', maxWidth: '380px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '1.5rem' }}>🍽️</span>
                            <span style={{ fontSize: '0.95rem', opacity: 0.9 }}>Reservá tu menú de toda la semana en minutos</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '1.5rem' }}>📧</span>
                            <span style={{ fontSize: '0.95rem', opacity: 0.9 }}>Recibí recordatorios antes del cierre</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '1.5rem' }}>⭐</span>
                            <span style={{ fontSize: '0.95rem', opacity: 0.9 }}>Calificá los platos que disfrutaste</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="auth-form-container animate-fade-in" style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                    <ThemeToggle />
                </div>
                {registrationComplete ? (
                    <div className="flex-col" style={{ marginTop: '2.5rem', gap: '1.5rem' }}>
                        {/* Cabecera con icono grande */}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: registrationWarning ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                                color: registrationWarning ? '#a16207' : '#16a34a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2.5rem',
                                margin: '0 auto 1rem'
                            }}>
                                {registrationWarning ? '⚠️' : '📧'}
                            </div>
                            <h2 style={{ marginBottom: '0.5rem' }}>
                                {registrationWarning ? 'Cuenta creada con advertencia' : '¡Cuenta creada! Revisá tu correo'}
                            </h2>
                            <p className="muted" style={{ lineHeight: 1.6 }}>
                                {registrationWarning
                                    ? 'Tu cuenta se creó, pero el sistema no pudo enviarte el correo de verificación en este momento.'
                                    : <>Te enviamos un correo de confirmación a <strong style={{ color: 'var(--text)' }}>{registeredEmail}</strong></>}
                            </p>
                        </div>

                        {/* Pasos numerados, solo cuando NO hay warning */}
                        {!registrationWarning && (
                            <div style={{
                                background: 'var(--bg)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                padding: '1.25rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                    <span style={{
                                        flexShrink: 0,
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: 'var(--accent)',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 700,
                                        fontSize: '0.9rem'
                                    }}>1</span>
                                    <p style={{ margin: 0, lineHeight: 1.5 }}>
                                        Abrí el correo en tu <strong>bandeja de entrada</strong>.
                                    </p>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                    <span style={{
                                        flexShrink: 0,
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: '#eab308',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 700,
                                        fontSize: '0.9rem'
                                    }}>2</span>
                                    <p style={{ margin: 0, lineHeight: 1.5 }}>
                                        <strong>Si no lo ves, revisá la carpeta de SPAM</strong> o &quot;Correo no deseado&quot;.
                                        Especialmente si usás <strong>Outlook</strong> o <strong>Hotmail</strong>. Cuando lo encuentres, marcalo como &quot;No es spam&quot;.
                                    </p>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                    <span style={{
                                        flexShrink: 0,
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        background: 'var(--accent)',
                                        color: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 700,
                                        fontSize: '0.9rem'
                                    }}>3</span>
                                    <p style={{ margin: 0, lineHeight: 1.5 }}>
                                        Tocá el botón <strong>&quot;Verificar mi Correo&quot;</strong>. Después podés iniciar sesión.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Mensaje específico si el envío del email falló */}
                        {registrationWarning && (
                            <div style={{
                                padding: '1rem',
                                background: 'var(--warning-bg, #fffbeb)',
                                color: 'var(--warning-text, #92400e)',
                                border: '1px solid var(--warning-border, #fde68a)',
                                borderRadius: 'var(--radius)',
                                lineHeight: 1.5
                            }}>
                                Por favor contactá al administrador de Real Sabor para que active tu cuenta manualmente.
                                Mientras tanto, no podrás iniciar sesión.
                            </div>
                        )}

                        <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '1rem' }}
                            onClick={() => {
                                setRegistrationComplete(false)
                                setIsLogin(true)
                            }}
                        >
                            Ir al Inicio de Sesión
                        </button>

                        {!registrationWarning && (
                            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                                <p className="muted" style={{ fontSize: '0.85rem', margin: 0, marginBottom: '0.75rem', lineHeight: 1.5 }}>
                                    ¿No te llegó después de unos minutos? Revisá SPAM una vez más antes de reenviar.
                                </p>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ width: '100%', padding: '0.65rem', fontSize: '0.95rem' }}
                                    onClick={handleResendVerification}
                                    disabled={resendingVerification || resendCooldown > 0}
                                >
                                    {resendingVerification
                                        ? 'Reenviando...'
                                        : resendCooldown > 0
                                            ? `Reenviar correo (esperá ${resendCooldown}s)`
                                            : 'Reenviar correo de verificación'}
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                <div className="auth-header" style={{ marginTop: '2.5rem' }}>
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
                                inputMode="email"
                                value={formData.identifier}
                                onChange={handleChange}
                                placeholder="ej. juan@empresa.com o 12345"
                                required
                                autoComplete="email"
                                spellCheck="false"
                            />
                        </div>
                    ) : (
                        <>
                            <div style={{ border: '1px solid var(--border)', background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '1.25rem', textAlign: 'center' }}>
                                <label style={{ display: 'block', marginBottom: '0.85rem', fontWeight: 600 }}>
                                    Foto de perfil <span style={{ color: 'var(--error-text)' }}>*</span>
                                </label>
                                <AvatarUploader
                                    currentPhotoUrl={formData.photoUrl}
                                    onPhotoChange={(url) => setFormData(prev => ({ ...prev, photoUrl: url }))}
                                    nameForInitials={formData.firstName || 'U'}
                                    size="104px"
                                />
                                <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.6rem', marginBottom: 0 }}>
                                    Obligatoria. Tocá <strong>Subir foto</strong>, elegí una imagen y ajustá el recorte.
                                </p>
                            </div>
                            <div className="grid-2" style={{ gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre</label>
                                    <input
                                        className="input"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                        placeholder="Juan"
                                        required
                                        autoComplete="given-name"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Apellido</label>
                                    <input
                                        className="input"
                                        name="lastName"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                        placeholder="Pérez"
                                        required
                                        autoComplete="family-name"
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Correo Electrónico</label>
                                <input
                                    className="input"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="juan@empresa.com"
                                    required
                                    autoComplete="email"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Confirmar Correo Electrónico</label>
                                <input
                                    className="input"
                                    name="confirmEmail"
                                    type="email"
                                    value={formData.confirmEmail}
                                    onChange={handleChange}
                                    placeholder="repetí el correo"
                                    required
                                    autoComplete="off"
                                    onPaste={e => { e.preventDefault(); addToast('Por seguridad, escribí el correo de nuevo (no se puede pegar).', 'info') }}
                                    onDrop={e => e.preventDefault()}
                                />
                                <small className="muted" style={{ fontSize: '0.8rem' }}>
                                    Escribilo de nuevo para evitar errores de tipeo. Si no recibís el correo de verificación, no podrás iniciar sesión.
                                </small>
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
                                    type="tel"
                                    inputMode="tel"
                                    value={formData.phoneNumber}
                                    onChange={e => setFormData(prev => ({ ...prev, phoneNumber: e.target.value.replace(/[^\d+]/g, '') }))}
                                    placeholder="099123456"
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                            <label style={{ fontWeight: 500 }}>Contraseña</label>
                            {isLogin && (
                                <button
                                    type="button"
                                    onClick={handleForgot}
                                    className="btn"
                                    style={{ background: 'transparent', color: 'var(--accent)', fontSize: '0.85rem', padding: 0, height: 'auto' }}
                                >
                                    ¿Olvidaste tu contraseña?
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
                        {!isLogin && (
                            <small className="muted" style={{ fontSize: '0.8rem', display: 'block', marginTop: '0.35rem' }}>
                                Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número.
                            </small>
                        )}
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
                                <label htmlFor="rememberMe" style={{ cursor: 'pointer', userSelect: 'none' }}>Recordar mi usuario</label>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="keepSession"
                                    checked={keepSession}
                                    onChange={(e) => setKeepSession(e.target.checked)}
                                    style={{ accentColor: 'var(--accent)', width: '1rem', height: '1rem' }}
                                />
                                <label htmlFor="keepSession" style={{ cursor: 'pointer', userSelect: 'none' }}>Mantener sesión iniciada</label>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="badge" style={{ background: '#fee2e2', color: '#991b1b', width: '100%', justifyContent: 'center', padding: '0.75rem', marginBottom: '1rem', whiteSpace: 'normal', display: 'block', textAlign: 'center' }}>
                            {error}
                        </div>
                    )}

                    {import.meta.env.VITE_TURNSTILE_SITE_KEY && (
                         <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                             <Turnstile 
                                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} 
                                onSuccess={(t) => setTurnstileToken(t)} 
                                onError={() => setError('Error al cargar la validación anti-bot.')}
                                onExpire={() => setTurnstileToken('')}
                             />
                         </div>
                    )}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }} disabled={loading || (!!import.meta.env.VITE_TURNSTILE_SITE_KEY && !turnstileToken)}>
                        {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Crear Cuenta')}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <p className="muted" style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                        {isLogin ? '¿Necesitás registrarte?' : '¿Ya tenés cuenta?'}
                    </p>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        className="btn btn-secondary"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '2px solid var(--accent)',
                            color: 'var(--accent)',
                            background: 'transparent',
                            fontWeight: 600,
                            fontSize: '1rem'
                        }}
                    >
                        {isLogin ? 'Crear una cuenta nueva' : 'Iniciar Sesión'}
                    </button>
                </div>

                <div style={{ marginTop: 'auto', textAlign: 'center', paddingTop: '2rem' }}>
                    <p className="muted" style={{ fontSize: '0.8rem' }}>
                        &copy; {new Date().getFullYear()} Reservas App. Todos los derechos reservados.
                    </p>
                </div>
                    </>
                )}
            </div>

            {/* Forgot Password Modal */}
            {showForgotModal && (
                <div className="modal-backdrop animate-fade-in" onClick={() => !loading && setShowForgotModal(false)}>
                    <div className="modal animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Recuperar Contraseña</h2>
                            <button className="btn btn-danger" onClick={() => setShowForgotModal(false)} disabled={loading}>&times;</button>
                        </div>
                        <form onSubmit={submitForgot} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                                Ingresa el correo electrónico asociado a tu cuenta. Si el correo existe en nuestro sistema, te enviaremos un enlace para que definas una nueva contraseña.
                            </p>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Correo Electrónico</label>
                                <input
                                    className="input"
                                    type="email"
                                    value={forgotEmail}
                                    onChange={e => setForgotEmail(e.target.value)}
                                    placeholder="ej. juan@empresa.com"
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className="flex-end" style={{ marginTop: '0.5rem' }}>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
