import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import apiFetch from '../api'
import { Menu, Reservation } from '../types'
import Skeleton from '../components/Skeleton'
import { useToast } from '../context/ToastContext'
import { useSettings } from '../context/SettingsContext'

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
const TIME_SLOTS = [
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
    '21:00', '21:30', '22:00'
]

export default function UserDashboard() {
    const { success, error } = useToast()
    const [menus, setMenus] = useState<{ current: Menu, next: Menu } | null>(null)
    const [dates, setDates] = useState<{ current: string, next: string } | null>(null)
    const [viewMode, setViewMode] = useState<'current' | 'next'>('next')
    const [userReservations, setUserReservations] = useState<Reservation[]>([])

    const [selections, setSelections] = useState<Record<string, { meal: string, dessert: string, bread: boolean }>>({})
    const [timeSlot, setTimeSlot] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    // Update form when viewMode or reservations change
    useEffect(() => {
        if (!dates) return
        const targetDate = viewMode === 'current' ? dates.current : dates.next
        const existing = userReservations.find(r => r.week === targetDate)

        if (existing) {
            setTimeSlot(existing.timeSlot)
            const sel: any = {}
            if (existing.selections) {
                existing.selections.forEach(s => {
                    sel[s.day] = { meal: s.meal, dessert: s.dessert, bread: s.bread }
                })
            }
            setSelections(sel)
        } else {
            // Reset form
            setSelections({})
            setTimeSlot('')
        }
    }, [viewMode, userReservations, dates])

    const loadData = async () => {
        try {
            const m = await apiFetch<{ menu: { current: Menu, next: Menu }, currentMonday: string, nextMonday: string }>('/api/menu')
            setMenus(m.menu)
            setDates({ current: m.currentMonday, next: m.nextMonday })

            // Default view mode logic:
            const today = new Date().getDay()
            if (today >= 1 && today <= 3) {
                setViewMode('next')
            } else {
                setViewMode('current')
            }

            const r = await apiFetch<{ reservations: Reservation[] }>('/api/reservations/me')
            setUserReservations(r.reservations)
        } catch (e) {
            console.error(e)
        }
    }

    const handleSelect = (day: string, type: 'meal' | 'dessert' | 'bread', value: any) => {
        setSelections(prev => ({
            ...prev,
            [day]: { ...prev[day], [type]: value }
        }))
    }

    const handleSubmit = async () => {
        if (!dates) return
        setLoading(true)
        try {
            const targetDate = viewMode === 'current' ? dates.current : dates.next
            const payload = {
                weekStart: targetDate,
                timeSlot,
                selections: DAYS.map(d => ({
                    day: d,
                    meal: selections[d]?.meal,
                    dessert: selections[d]?.dessert,
                    bread: selections[d]?.bread
                }))
            }
            await apiFetch('/api/reservations', {
                method: 'POST',
                body: JSON.stringify(payload)
            })
            success('Reserva guardada con exito')

            // Reload reservations to update state
            const r = await apiFetch<{ reservations: Reservation[] }>('/api/reservations/me')
            setUserReservations(r.reservations)
        } catch (e: any) {
            error(e.message)
        } finally {
            setLoading(false)
        }
    }

    if (!menus || !dates) {
        return (
            <Layout>
                <div style={{ marginBottom: '2rem' }}>
                    <Skeleton width="60%" height="2rem" style={{ marginBottom: '0.5rem' }} />
                    <Skeleton width="40%" height="1.5rem" />
                </div>

                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                    <div className="btn-group">
                        <Skeleton width="120px" height="40px" />
                        <Skeleton width="120px" height="40px" />
                    </div>
                    <Skeleton width="200px" height="30px" borderRadius="9999px" />
                </div>

                <div className="grid">
                    <Skeleton height="100px" />
                    <div className="card">
                        <div className="grid-3">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="day-card" style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                    <Skeleton width="50%" height="1.5rem" style={{ marginBottom: '1rem' }} />
                                    <div className="flex-col" style={{ gap: '1rem' }}>
                                        <Skeleton height="40px" />
                                        <Skeleton height="40px" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Layout>
        )
    }

    const activeMenu = viewMode === 'current' ? menus.current : menus.next
    const activeDate = viewMode === 'current' ? dates.current : dates.next
    const myRes = userReservations.find(r => r.week === activeDate)

    const { settings } = useSettings()

    // Reservation Window Logic
    const today = new Date().getDay()
    // Normalizar domingo (0) a 7 para facilitar comparaciones si la semana empieza el lunes
    const currentDay = today === 0 ? 7 : today
    const deadlineDay = settings.deadlineDay === 0 ? 7 : settings.deadlineDay

    const isNextWeek = viewMode === 'next'
    const isReservationOpen = isNextWeek && (currentDay <= deadlineDay)
    const canEdit = isNextWeek ? isReservationOpen : false

    // Status Message
    let statusMessage = ''
    let statusColor = ''
    
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const deadlineName = dayNames[settings.deadlineDay]

    if (viewMode === 'current') {
        statusMessage = 'Semana en curso (Solo lectura)'
        statusColor = 'badge-gray'
    } else {
        if (isReservationOpen) {
            statusMessage = `Reservas Abiertas (Cierra el ${deadlineName})`
            statusColor = 'badge-success'
        } else {
            statusMessage = `Reservas Cerradas (Se abren el Lunes)`
            statusColor = 'badge-danger'
        }
    }

    const formatDateRange = (startDateStr: string) => {
        if (!startDateStr) return ''
        const [y, m, d] = startDateStr.split('-').map(Number)
        const start = new Date(y, m - 1, d)
        const end = new Date(y, m - 1, d + 4) // Friday

        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

        const startDay = start.getDate().toString().padStart(2, '0')
        const endDay = end.getDate().toString().padStart(2, '0')
        const month = months[end.getMonth()]
        const year = end.getFullYear()

        return `Semana del lunes ${startDay} al viernes ${endDay} de ${month} de ${year}`
    }

    return (
        <Layout title="Reserva de Menu" subtitle={formatDateRange(activeDate)}>
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
                <div className="btn-group">
                    <button
                        className={`btn ${viewMode === 'current' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setViewMode('current')}
                    >
                        Semana Actual
                    </button>
                    <button
                        className={`btn ${viewMode === 'next' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setViewMode('next')}
                    >
                        Semana Proxima
                    </button>
                </div>
                <div className={`badge ${statusColor}`}>{statusMessage}</div>
            </div>

            <div className="grid">
                {myRes ? (
                    <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
                        <h3>Tu reserva esta confirmada</h3>
                        <p>Horario: {myRes.timeSlot}</p>
                        {canEdit ? (
                            <p className="muted" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                Puedes modificar tu reserva hasta el miercoles.
                            </p>
                        ) : (
                            <p className="muted" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                Ya no puedes modificar esta reserva (Cierre: Miercoles).
                            </p>
                        )}
                    </div>
                ) : (
                    <div className={`card ${canEdit ? 'card-warning' : 'card-disabled'}`}>
                        {canEdit ? (
                            <>
                                <h3>No has hecho la reserva</h3>
                                <p className="muted">Completa el formulario para reservar.</p>
                                <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 500 }}>
                                    Nota: Tienes tiempo hasta el miercoles para realizar o modificar tu pedido.
                                </p>
                            </>
                        ) : (
                            <>
                                <h3>Reserva no disponible</h3>
                                <p className="muted">
                                    {isNextWeek
                                        ? 'El periodo de reserva para la proxima semana ha finalizado (Cierra los Miercoles).'
                                        : 'El menu de la semana actual no se puede modificar.'}
                                </p>
                            </>
                        )}
                    </div>
                )}

                <div className="card">
                    <div className="grid-3">
                        {DAYS.map(day => (
                            <div key={day} className="day-card" style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                <h3 style={{ textTransform: 'capitalize', marginBottom: '1rem', fontSize: '1.25rem' }}>{day}</h3>
                                <div className="flex-col" style={{ gap: '1rem' }}>
                                    <div>
                                        <label className="muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Comida</label>
                                        <select
                                            className="input"
                                            value={selections[day]?.meal || ''}
                                            onChange={e => handleSelect(day, 'meal', e.target.value)}
                                            disabled={!canEdit}
                                        >
                                            <option value="">Seleccionar...</option>
                                            {activeMenu.days[day].meals.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Postre</label>
                                        <select
                                            className="input"
                                            value={selections[day]?.dessert || ''}
                                            onChange={e => handleSelect(day, 'dessert', e.target.value)}
                                            disabled={!canEdit}
                                        >
                                            <option value="">Seleccionar...</option>
                                            {activeMenu.days[day].desserts.map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                                    <input
                                        type="checkbox"
                                        id={`bread-${day}`}
                                        checked={selections[day]?.bread || false}
                                        onChange={e => handleSelect(day, 'bread', e.target.checked)}
                                        disabled={!canEdit}
                                        style={{ width: '20px', height: '20px', cursor: canEdit ? 'pointer' : 'default', accentColor: 'var(--accent)' }}
                                    />
                                    <label htmlFor={`bread-${day}`} style={{ cursor: canEdit ? 'pointer' : 'default', userSelect: 'none' }}>Pan</label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {canEdit && (
                    <div className="card" id="confirm-section">
                        <h3 style={{ marginBottom: '1rem' }}>Confirmar Reserva</h3>
                        <div className="flex-col">
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Horario de retiro</label>
                                <select className="input" value={timeSlot} onChange={e => setTimeSlot(e.target.value)}>
                                    <option value="">Seleccionar horario...</option>
                                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !timeSlot}>
                                {loading ? 'Guardando...' : (myRes ? 'Modificar Reserva' : 'Confirmar Reserva')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}
