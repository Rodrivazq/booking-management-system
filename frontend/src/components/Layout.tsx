import { ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuthStore'
import HelpButton from './HelpButton'
import ThemeToggle from './ThemeToggle'
import Icon from './Icon'
import { useSettings } from '../context/SettingsContext'
import AnnouncementBanner from './AnnouncementBanner'
import apiFetch from '../api'

interface LayoutProps {
    children: ReactNode
    title?: string
    subtitle?: string
    showLogout?: boolean
}

export default function Layout({ children, title, subtitle, showLogout = true }: LayoutProps) {
    const logout = useAuthStore((state) => state.logout)
    const user = useAuthStore((state) => state.user)
    const navigate = useNavigate()
    const location = useLocation()
    const { settings } = useSettings()

    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
    const inAdminArea = location.pathname.startsWith('/admin')
    const switchPanel = () => navigate(inAdminArea ? '/' : '/admin')

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [qrModalOpen, setQrModalOpen] = useState(false)
    const [qrCode, setQrCode] = useState('')
    const [qrError, setQrError] = useState('')

    const appUrl = window.location.origin
    const shareText = `Acceso al Sistema de Reservas Real Sabor: ${appUrl}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`

    const goHome = () => {
        if (user?.role === 'admin' || user?.role === 'superadmin') {
            navigate('/admin')
        } else {
            navigate('/')
        }
    }

    const handleLogout = () => {
        logout()
        navigate('/')
    }

    const handleOpenQR = async () => {
        setQrModalOpen(true)
        setMobileMenuOpen(false)
        if (!qrCode) {
            setQrError('')
            try {
                const res = await apiFetch<{ dataUrl: string }>('/api/qr')
                setQrCode(res.dataUrl)
            } catch (error) {
                console.error(error)
                const message = error instanceof Error ? error.message : 'No se pudo generar el QR'
                setQrError(message)
            }
        }
    }

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: settings.companyName,
                    text: 'Acceso al sistema de reservas',
                    url: appUrl
                })
                return
            } catch {
                // If the user cancels native share, keep the modal open.
            }
        }
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    }

    useEffect(() => {
        if (!qrModalOpen) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setQrModalOpen(false)
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [qrModalOpen])

    return (
        <div className="page animate-fade-in">
            <AnnouncementBanner />

            <header className="app-shell-header">
                <button className="app-brand" onClick={goHome} title="Volver al inicio">
                    <img
                        src={settings.logoUrl || '/assets/logo_real_sabor_clean.png'}
                        alt="Logo"
                        className="app-brand-logo premium-logo"
                    />
                    <span className="app-brand-copy">
                        <span className="app-brand-title">{settings.companyName}</span>
                        {user && (
                            <span className="app-brand-subtitle hide-mobile">
                                Hola, <span>{user.name}</span>
                            </span>
                        )}
                    </span>
                </button>

                <div className="hide-mobile app-header-actions">
                    <div className="app-header-tools">
                        {user && isAdmin && (
                            <button
                                className="app-header-icon-btn"
                                onClick={switchPanel}
                                title={inAdminArea ? 'Ir a mi panel de usuario' : 'Ir al panel de administración'}
                                style={{ width: 'auto', padding: '0 0.85rem', gap: '0.45rem', display: 'inline-flex', alignItems: 'center' }}
                            >
                                <Icon name={inAdminArea ? 'home' : 'settings'} size={17} />
                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{inAdminArea ? 'Mi panel' : 'Panel admin'}</span>
                            </button>
                        )}
                        <ThemeToggle />
                        <button className="app-header-icon-btn" onClick={handleOpenQR} title="Compartir acceso" aria-label="Compartir acceso">
                            <Icon name="share" size={18} />
                        </button>
                        <HelpButton />
                    </div>

                    {user && (
                        <div className="app-user-actions">
                            <button
                                onClick={() => navigate('/profile')}
                                className="app-avatar-button"
                                title="Ir a mi perfil"
                            >
                                {user.photoUrl ? (
                                    <img src={user.photoUrl} alt="" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                    </svg>
                                )}
                            </button>
                            {showLogout && (
                                <button onClick={handleLogout} className="app-logout-button" title="Cerrar sesión" aria-label="Cerrar sesión">
                                    <Icon name="logout" size={18} />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="show-mobile">
                    <ThemeToggle />
                </div>

                <div className="show-mobile">
                    <button
                        className="btn btn-secondary"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        style={{ padding: '0.5rem', fontSize: '1.5rem', border: 'none', height: '2.5rem', width: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        aria-label="Abrir menu"
                    >
                        ☰
                    </button>
                </div>

                {mobileMenuOpen && (
                    <div className="show-mobile app-mobile-menu">
                        <HelpButton customTrigger={
                            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem', border: 'none' }}>
                                Ayuda y documentacion
                            </button>
                        } />
                        <button
                            onClick={handleOpenQR}
                            className="btn btn-secondary"
                            style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem', border: 'none' }}
                        >
                            Compartir app
                        </button>

                        {user && isAdmin && (
                            <button
                                onClick={() => { switchPanel(); setMobileMenuOpen(false) }}
                                className="btn btn-secondary"
                                style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem', border: 'none' }}
                            >
                                {inAdminArea ? 'Ir a mi panel de usuario' : 'Ir al panel de administración'}
                            </button>
                        )}
                        {user && (
                            <button
                                onClick={() => { navigate('/profile'); setMobileMenuOpen(false) }}
                                className="btn btn-secondary"
                                style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem', border: 'none' }}
                            >
                                Mi perfil
                            </button>
                        )}
                        {showLogout && (
                            <button
                                onClick={() => { handleLogout(); setMobileMenuOpen(false) }}
                                className="btn btn-secondary"
                                style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--error)', border: 'none' }}
                            >
                                Cerrar sesion
                            </button>
                        )}
                    </div>
                )}
            </header>

            {title && (
                <div className="page-title-block">
                    <h2>{title}</h2>
                    {subtitle && <p>{subtitle}</p>}
                </div>
            )}

            <main>
                {children}
            </main>

            {qrModalOpen && createPortal(
                <div className="share-backdrop" onClick={() => setQrModalOpen(false)} role="presentation">
                    <div
                        className="share-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="share-modal-title"
                        onClick={e => e.stopPropagation()}
                    >
                        <button className="share-modal-close" onClick={() => setQrModalOpen(false)} aria-label="Cerrar">x</button>

                        <div className="share-modal-header">
                            <span className="share-modal-kicker">Acceso rapido</span>
                            <h3 id="share-modal-title">Compartir la app</h3>
                            <p>Envia el acceso por WhatsApp o usa el QR para abrirlo desde otro dispositivo.</p>
                        </div>

                        <div className="share-action-grid">
                            <button className="share-primary-action" onClick={handleNativeShare}>
                                Compartir por WhatsApp
                            </button>
                            <button
                                className="share-secondary-action"
                                onClick={() => navigator.clipboard?.writeText(appUrl)}
                            >
                                Copiar enlace
                            </button>
                        </div>

                        <div className="share-qr-frame">
                            {qrCode ? (
                                <img src={qrCode} alt="QR de acceso a la app" />
                            ) : qrError ? (
                                <div className="share-qr-loading" style={{ color: 'var(--error-text, #991b1b)' }}>
                                    No se pudo cargar el QR.<br />
                                    <small>{qrError}</small>
                                </div>
                            ) : (
                                <div className="share-qr-loading">Cargando QR...</div>
                            )}
                        </div>

                        <div className="share-link-box">
                            <span>{appUrl}</span>
                            <span className="share-link-note">URL publica</span>
                        </div>

                        <button className="share-done-button" onClick={() => setQrModalOpen(false)}>Listo</button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
