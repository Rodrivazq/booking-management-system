import { ReactNode, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuthStore'
import HelpButton from './HelpButton'
import ThemeToggle from './ThemeToggle'
import { useSettings } from '../context/SettingsContext'
import AnnouncementBanner from './AnnouncementBanner'

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
    const { settings } = useSettings()

    const handleLogout = () => {
        logout()
        navigate('/')
    }

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <div className="page animate-fade-in">
            <AnnouncementBanner />
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem', position: 'relative' }}>
                <div
                    className="logo-container"
                    style={{ margin: 0, cursor: 'pointer' }}
                    onClick={() => {
                        if (user?.role === 'admin' || user?.role === 'superadmin') {
                            navigate('/admin')
                        } else {
                            navigate('/')
                        }
                    }}
                    title="Volver al Inicio"
                >
                    {settings.logoUrl ? (
                        <img src={settings.logoUrl} alt="Logo" className="logo-icon" style={{ objectFit: 'contain', background: 'transparent', boxShadow: 'none' }} />
                    ) : (
                        <div className="logo-icon">R</div>
                    )}
                    <div>
                        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>{settings.companyName}</h1>
                        {user && (
                            <p className="muted hide-mobile" style={{ fontSize: '0.9rem', margin: 0 }}>
                                Hola, <span onClick={(e) => { e.stopPropagation(); navigate('/profile'); }} style={{ cursor: 'pointer', textDecoration: 'underline' }}>{user.name}</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Desktop Navigation */}
                <div className="hide-mobile" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', borderRight: '1px solid var(--border)', paddingRight: '1rem' }}>
                        <ThemeToggle />
                        <HelpButton />
                    </div>

                    {user && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                                onClick={() => navigate('/profile')}
                                className="btn btn-secondary btn-sm"
                                style={{
                                    padding: 0,
                                    border: 'none',
                                    width: '2.5rem',
                                    height: '2.5rem',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'var(--accent)',
                                    color: 'white'
                                }}
                                title="Ir a Mi Perfil"
                            >
                                {user.photoUrl ? (
                                    <img src={user.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                    </svg>
                                )}
                            </button>
                            {showLogout && (
                                <button onClick={handleLogout} className="btn btn-secondary btn-sm" title="Cerrar Sesión">
                                    ⏻
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Mobile Theme Toggle (Left) */}
                <div className="show-mobile">
                    <ThemeToggle />
                </div>

                {/* Mobile Hamburger (Right) */}
                <div className="show-mobile">
                    <button
                        className="btn btn-secondary"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        style={{ padding: '0.5rem', fontSize: '1.5rem', border: 'none', height: '2.5rem', width: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        ☰
                    </button>
                </div>

                {/* Mobile Menu Dropdown */}
                {mobileMenuOpen && (
                    <div className="show-mobile" style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: '0.5rem',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 50,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        marginTop: '0.5rem'
                    }}>
                        <HelpButton customTrigger={
                            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem', border: 'none' }}>
                                ❓ Ayuda y Documentación
                            </button>
                        } />

                        {user && (
                            <button
                                onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }}
                                className="btn btn-secondary"
                                style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem', border: 'none' }}
                            >
                                👤 Mi Perfil
                            </button>
                        )}
                        {showLogout && (
                            <button
                                onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                                className="btn btn-secondary"
                                style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--error)', border: 'none' }}
                            >
                                ⏻ Cerrar Sesion
                            </button>
                        )}
                    </div>
                )}
            </header>

            {title && (
                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ marginBottom: '0.5rem' }}>{title}</h2>
                    {subtitle && <p>{subtitle}</p>}
                </div>
            )}

            <main>
                {children}
            </main>
        </div>
    )
}
