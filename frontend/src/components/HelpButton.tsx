import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../hooks/useAuthStore'

interface HelpButtonProps {
    customTrigger?: React.ReactNode;
}

import { useSettings } from '../context/SettingsContext'

export default function HelpButton({ customTrigger }: HelpButtonProps) {
    const [isOpen, setIsOpen] = useState(false)
    const user = useAuthStore(s => s.user)
    const { settings } = useSettings()

    if (!user) return null

    const isAdmin = user.role === 'admin' || user.role === 'superadmin'

    const days = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
    const deadlineDayName = days[settings.deadlineDay] || 'Miercoles'

    return (
        <>
            {customTrigger ? (
                <div onClick={() => setIsOpen(true)}>{customTrigger}</div>
            ) : (
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsOpen(true)}
                    title="Ayuda y Documentacion"
                    style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        padding: 0,
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                        color: 'var(--accent)'
                    }}
                >
                    ?
                </button>
            )}

            {isOpen && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                    onClick={() => setIsOpen(false)}
                    onWheel={(e) => {
                        if (e.target === e.currentTarget) {
                            window.scrollBy({
                                top: e.deltaY,
                                behavior: 'auto'
                            })
                        }
                    }}
                >
                    <div className="card help-modal" onClick={e => e.stopPropagation()} style={{
                        maxWidth: '600px',
                        width: '90%',
                        maxHeight: '85vh',
                        overflowY: 'auto',
                        position: 'relative',
                        padding: '2rem',
                        background: 'var(--card)',
                        borderRadius: 'var(--radius)'
                    }}>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                position: 'absolute',
                                top: '1rem',
                                right: '1rem',
                                background: 'none',
                                border: 'none',
                                fontSize: '1.5rem',
                                cursor: 'pointer',
                                color: 'var(--text-light)'
                            }}
                        >
                            ×
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <h2 style={{ margin: 0, color: 'var(--accent)' }}>
                                {isAdmin ? 'Guia de Administrador' : 'Guia de Usuario'}
                            </h2>
                        </div>

                        <div className="help-body" style={{ textAlign: 'left' }}>
                            {isAdmin ? (
                                <>
                                    <section>
                                        <h3>👋 Panel de Control</h3>
                                        <p>Gestiona todo el sistema de reservas desde aqui.</p>
                                    </section>

                                    <section>
                                        <h4>📅 Reservas</h4>
                                        <ul>
                                            <li><strong>Semana Actual/Proxima:</strong> Visualiza reservas.</li>
                                            <li><strong>Historial:</strong> Consulta registros pasados.</li>
                                            <li><strong>Buscador:</strong> Encuentra reservas rapido.</li>
                                            <li><strong>Sin Reserva:</strong> Usuarios pendientes.</li>
                                        </ul>
                                    </section>

                                    <section>
                                        <h4>🍽️ Menu</h4>
                                        <ul>
                                            <li><strong>Gestion:</strong> Edita platos y postres.</li>
                                            <li><strong>Guardado:</strong> Recuerda guardar cambios.</li>
                                            <li><em>Solo Super Admins editan.</em></li>
                                        </ul>
                                    </section>

                                    <section>
                                        <h4>👥 Usuarios</h4>
                                        <ul>
                                            <li><strong>Crear:</strong> Nuevos empleados/admins.</li>
                                            <li><strong>Roles:</strong> User, Admin, Super Admin.</li>
                                        </ul>
                                    </section>

                                    <section>
                                        <h4>📊 Reportes</h4>
                                        <ul>
                                            <li><strong>Imprimir:</strong> Totales de produccion.</li>
                                            <li><strong>Detalle:</strong> Para cocina.</li>
                                        </ul>
                                    </section>
                                </>
                            ) : (
                                <>
                                    <section>
                                        <h3>👋 Sistema de Reservas</h3>
                                        <p>Reserva tus comidas rapida y sencillamente.</p>
                                    </section>

                                    <section>
                                        <h4>📝 Como Reservar</h4>
                                        <ol>
                                            <li><strong>Semana:</strong> Elige actual o proxima.</li>
                                            <li><strong>Menu:</strong> Selecciona plato y postre.</li>
                                            <li><strong>Pan:</strong> ¿Deseas pan?</li>
                                            <li><strong>Horario:</strong> Elige turno.</li>
                                            <li><strong>Confirmar:</strong> Guarda tu pedido.</li>
                                        </ol>
                                    </section>

                                    <section>
                                        <h4>⚠️ Reglas</h4>
                                        <ul>
                                            <li><strong>Cierre:</strong> {deadlineDayName} {settings.deadlineTime}.</li>
                                            <li><strong>Edicion:</strong> Libre antes del cierre.</li>
                                        </ul>
                                    </section>
                                </>
                            )}

                            {(settings.supportEmail || settings.supportPhone) && (
                                <section style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                    <h4>📞 Soporte</h4>
                                    <p>Si tienes problemas, contacta a soporte:</p>
                                    <ul>
                                        {settings.supportEmail && <li><strong>Email:</strong> {settings.supportEmail}</li>}
                                        {settings.supportPhone && <li><strong>Telefono:</strong> {settings.supportPhone}</li>}
                                    </ul>
                                </section>
                            )}
                        </div>

                        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                            <button className="btn btn-primary" onClick={() => setIsOpen(false)} style={{ minWidth: '120px' }}>
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
