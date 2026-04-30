import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '../context/SettingsContext'

interface HelpModalProps {
    role: 'user' | 'admin' | 'superadmin'
    isOpen: boolean
    onClose: () => void
}

export default function HelpModal({ role, isOpen, onClose }: HelpModalProps) {
    const { settings } = useSettings()
    const [activeSection, setActiveSection] = useState<string>('')

    // Define sections based on role
    const userSections = [
        { id: 'reservar', label: 'Reservar menú' },
        { id: 'modificar', label: 'Modificar reserva' },
        { id: 'fechas', label: 'Fechas y cierre' },
        { id: 'problemas', label: 'Problemas frecuentes' },
    ]

    const adminSections = [
        { id: 'reservas', label: 'Reservas' },
        { id: 'menu', label: 'Menú semanal' },
        { id: 'usuarios', label: 'Usuarios' },
        { id: 'reportes', label: 'Reportes' },
        ...(role === 'superadmin' ? [
            { id: 'configuracion', label: 'Configuración' },
            { id: 'roles', label: 'Roles y permisos' }
        ] : []),
        { id: 'problemas-admin', label: 'Problemas frecuentes' },
    ]

    const sections = role === 'user' ? userSections : adminSections

    // Set default active section
    useEffect(() => {
        if (isOpen && !activeSection && sections.length > 0) {
            setActiveSection(sections[0].id)
        }
    }, [isOpen, sections, activeSection])

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const deadlineDayName = days[settings?.deadlineDay ?? 4]

    const renderContent = () => {
        switch (activeSection) {
            // --- USER SECTIONS ---
            case 'reservar':
                return (
                    <div className="help-section">
                        <h3>Reservar menú</h3>
                        <p>Sigue estos pasos para realizar tu pedido semanal de forma rápida:</p>
                        <ol className="help-step-list">
                            <li>Elige la pestaña <strong>Semana Actual</strong> o <strong>Próxima Semana</strong> en la parte superior.</li>
                            <li>Selecciona tu plato principal y postre para cada día habilitado.</li>
                            <li>Marca la casilla <strong>Pan</strong> si deseas acompañamiento (cuando esté disponible).</li>
                            <li>Selecciona un <strong>horario de retiro</strong> al final del formulario.</li>
                            <li>Haz clic en el botón verde <strong>Confirmar Reserva</strong>.</li>
                        </ol>
                        <div className="help-callout">
                            <strong>Consejo:</strong> Siempre verifica que aparezca tu "Resumen de Reserva" y no quede ningún selector en "Seleccionar...".
                        </div>
                    </div>
                )
            case 'modificar':
                return (
                    <div className="help-section">
                        <h3>Modificar reserva</h3>
                        <p>Si te equivocaste o cambiaste de opinión, puedes modificar tu pedido.</p>
                        <ul className="help-step-list">
                            <li>Mientras la ventana de reservas esté abierta, puedes cambiar tus selecciones en cualquier momento.</li>
                            <li>Al hacer clic en <strong>Modificar Reserva</strong>, tu pedido anterior se actualizará automáticamente.</li>
                            <li>El sistema reemplaza tus datos, <strong>no genera reservas duplicadas</strong>.</li>
                        </ul>
                    </div>
                )
            case 'fechas':
                return (
                    <div className="help-section">
                        <h3>Fechas y cierre</h3>
                        <div className="help-callout warning">
                            <strong>Atención:</strong> Las reservas para la próxima semana cierran automáticamente los días <strong>{deadlineDayName} a las {settings?.deadlineTime || '23:59'}</strong>.
                        </div>
                        <ul className="help-step-list">
                            <li>La aplicación siempre te avisará visualmente si la ventana está abierta o cerrada.</li>
                            <li>Una vez pasado el cierre, ya no podrás modificar ni agregar reservas para esa semana.</li>
                        </ul>
                    </div>
                )
            case 'problemas':
                return (
                    <div className="help-section">
                        <h3>Problemas frecuentes</h3>
                        <div className="help-card">
                            <strong>"El menú aparece como No disponible"</strong>
                            <p className="muted">El administrador aún no ha cargado los platos para esa semana. Vuelve a revisar más tarde.</p>
                        </div>
                        <div className="help-card">
                            <strong>"No puedo guardar mi reserva"</strong>
                            <p className="muted">Revisa que hayas seleccionado Comida y Postre para todos los días hábiles, y no olvides elegir un Horario de retiro.</p>
                        </div>
                        <div className="help-card">
                            <strong>"No puedo modificar mi reserva"</strong>
                            <p className="muted">Es probable que la ventana de tiempo ya haya cerrado. Contacta al administrador si necesitas un cambio urgente.</p>
                        </div>
                        <div className="help-card">
                            <strong>"Mis datos o contraseña están mal"</strong>
                            <p className="muted">Debes contactar al administrador del sistema para que restablezca o actualice tus datos desde el panel.</p>
                        </div>
                    </div>
                )

            // --- ADMIN SECTIONS ---
            case 'reservas':
                return (
                    <div className="help-section">
                        <h3>Gestión de Reservas</h3>
                        <p>Desde el panel principal puedes monitorear todos los pedidos de los funcionarios.</p>
                        <ul className="help-step-list">
                            <li><strong>Pestañas temporales:</strong> Alterna entre Semana Actual, Próxima Semana o el Historial completo.</li>
                            <li><strong>Buscador:</strong> Usa el campo de búsqueda rápida para filtrar por nombre o número de funcionario.</li>
                            <li><strong>Detalle:</strong> Haz clic en cualquier reserva para expandir y ver exactamente qué pidió cada día.</li>
                            <li><strong>Sin reserva:</strong> Revisa qué usuarios aún no han hecho su pedido para enviarles un recordatorio.</li>
                        </ul>
                    </div>
                )
            case 'menu':
                return (
                    <div className="help-section">
                        <h3>Menú semanal</h3>
                        <p>Configurar el menú es indispensable para que los usuarios puedan reservar.</p>
                        <ol className="help-step-list">
                            <li>Ve a la pestaña <strong>Menú Semanal</strong>.</li>
                            <li>Para cada día, escribe los platos principales separados por comas.</li>
                            <li>Haz lo mismo para los postres.</li>
                            <li>Activa o desactiva la opción de "Pan disponible" para esa semana.</li>
                            <li>¡Importante! Haz clic en <strong>Guardar Menú</strong> al terminar.</li>
                        </ol>
                        <div className="help-callout error">
                            <strong>Error común:</strong> Si el menú se deja en blanco, a los usuarios les aparecerá "Menú no disponible" y no podrán operar.
                        </div>
                    </div>
                )
            case 'usuarios':
                return (
                    <div className="help-section">
                        <h3>Gestión de Usuarios</h3>
                        <ul className="help-step-list">
                            <li><strong>Alta de usuario:</strong> Usa el formulario superior para crear nuevos funcionarios.</li>
                            <li><strong>Edición:</strong> Haz clic en el botón de editar (lápiz) para modificar nombres, correos o números de funcionario.</li>
                            <li><strong>QR:</strong> Puedes ver y descargar el QR de acceso de cada usuario.</li>
                            <li><strong>Blanqueo de clave:</strong> Puedes generar un enlace de recuperación si un usuario olvida su contraseña.</li>
                        </ul>
                    </div>
                )
            case 'reportes':
                return (
                    <div className="help-section">
                        <h3>Reportes y Producción</h3>
                        <p>Los reportes consolidan la información para la cocina.</p>
                        <ul className="help-step-list">
                            <li><strong>Resumen Semanal:</strong> Muestra totales agrupados por plato y día.</li>
                            <li><strong>Producción por Día:</strong> Vista detallada enfocada en un día específico.</li>
                            <li><strong>Impresión:</strong> Usa el botón de imprimir para obtener una copia física limpia (sin elementos de interfaz) especial para el personal de cocina.</li>
                        </ul>
                    </div>
                )
            case 'configuracion':
                return (
                    <div className="help-section">
                        <h3>Configuración General <span className="help-badge superadmin">Superadmin</span></h3>
                        <p>Opciones críticas del sistema que afectan a todos los usuarios.</p>
                        <ul className="help-step-list">
                            <li><strong>Identidad visual:</strong> Nombre de la empresa, logo y colores institucionales.</li>
                            <li><strong>Cierre de reservas:</strong> Configura exactamente qué día y a qué hora el sistema bloqueará automáticamente los pedidos para la próxima semana.</li>
                            <li><strong>Soporte:</strong> Correo y teléfono que aparecerán en la ayuda de los usuarios.</li>
                        </ul>
                        <div className="help-callout warning">
                            <strong>Precaución:</strong> Cambiar el día de cierre en medio de una semana puede causar confusión. Se recomienda anunciarlo previamente.
                        </div>
                    </div>
                )
            case 'roles':
                return (
                    <div className="help-section">
                        <h3>Roles y Permisos <span className="help-badge superadmin">Superadmin</span></h3>
                        <p>Niveles de acceso dentro de la aplicación:</p>
                        <div className="help-card">
                            <strong>Usuario Normal</strong> <span className="help-badge user">User</span>
                            <p className="muted">Solo puede ver el menú y gestionar sus propias reservas.</p>
                        </div>
                        <div className="help-card">
                            <strong>Administrador</strong> <span className="help-badge admin">Admin</span>
                            <p className="muted">Gestiona reservas de todos, edita el menú semanal, administra usuarios y accede a los reportes de cocina.</p>
                        </div>
                        <div className="help-card">
                            <strong>Súper Administrador</strong> <span className="help-badge superadmin">Superadmin</span>
                            <p className="muted">Tiene los mismos permisos que el Admin, además de acceso exclusivo a la Configuración del sistema y asignación de roles.</p>
                        </div>
                    </div>
                )
            case 'problemas-admin':
                return (
                    <div className="help-section">
                        <h3>Problemas frecuentes (Admin)</h3>
                        <div className="help-card">
                            <strong>"Un usuario dice que no puede reservar"</strong>
                            <p className="muted">Verifica que el menú de esa semana esté cargado y que no haya pasado la fecha límite de cierre ({deadlineDayName} a las {settings?.deadlineTime || '23:59'}).</p>
                        </div>
                        <div className="help-card">
                            <strong>"Me equivoqué en el menú pero ya hay reservas"</strong>
                            <p className="muted">Si editas el menú después de que los usuarios hayan reservado, las reservas existentes conservarán los nombres de los platos originales. Deberás contactarlos para que modifiquen su pedido.</p>
                        </div>
                    </div>
                )
            default:
                return null
        }
    }

    const titleMap = {
        user: 'Guía rápida para reservar tu menú',
        admin: 'Guía operativa del panel de administración',
        superadmin: 'Guía de administración avanzada'
    }

    return createPortal(
        <div
            className="help-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-modal-title"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={onClose}
        >
            <div
                className="modal animate-slide-up"
                style={{ maxWidth: '850px', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="modal-header" style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
                    <div>
                        <h2 id="help-modal-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent)' }}>Centro de ayuda</h2>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-light)' }}>{titleMap[role]}</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar ayuda"
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            color: 'var(--text-light)',
                            padding: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        ×
                    </button>
                </div>

                {/* Body with Sidebar */}
                <div className="help-modal-container">
                    <div className="help-sidebar">
                        {sections.map(sec => (
                            <button
                                key={sec.id}
                                className={`help-nav-item ${activeSection === sec.id ? 'active' : ''}`}
                                onClick={() => setActiveSection(sec.id)}
                            >
                                {sec.label}
                            </button>
                        ))}
                    </div>
                    <div className="help-content">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
