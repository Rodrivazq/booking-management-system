import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Layout from '../components/Layout'
import apiFetch from '../api'
import { Menu, Reservation } from '../types'
import Skeleton from '../components/Skeleton'
import { useToast } from '../context/ToastContext'

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
const TIME_SLOTS = [
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
    '21:00', '21:30', '22:00'
]

// Shape returned by GET /api/reservations/window
interface ReservationWindow {
    currentMonday: string
    nextMonday: string
    deadlineDay: number
    deadlineTime: string
    isReservationOpen: boolean
    activeWeek: string
    reason: string
}

export default function UserDashboard() {
    const { success, error } = useToast()
    const [menus, setMenus] = useState<{ current: Menu, next: Menu } | null>(null)
    const [dates, setDates] = useState<{ current: string, next: string } | null>(null)
    const [viewMode, setViewMode] = useState<'current' | 'next'>('next')
    const [userReservations, setUserReservations] = useState<Reservation[]>([])
    const [window_, setWindow_] = useState<ReservationWindow | null>(null)

    const [selections, setSelections] = useState<Record<string, { meal: string, dessert: string, bread: boolean }>>({})
    const [timeSlot, setTimeSlot] = useState('')
    const [loading, setLoading] = useState(false)
    // Track last saved week so the confirmation card shows correctly
    const [lastSavedWeek, setLastSavedWeek] = useState<string | null>(null)
    const [showRatingReminder, setShowRatingReminder] = useState(false)
    // Ratings
    const [ratings, setRatings] = useState<Record<string, string>>({})

    useEffect(() => {
        loadData()
    }, [])

    // Populate form when viewMode or reservations change
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
            setSelections({})
            setTimeSlot('')
        }
        setLastSavedWeek(null)
    }, [viewMode, userReservations, dates])

    const loadData = async () => {
        try {
            const [m, r, w] = await Promise.all([
                apiFetch<{ menu: { current: Menu, next: Menu }, currentMonday: string, nextMonday: string }>('/api/menu'),
                apiFetch<{ reservations: Reservation[] }>('/api/reservations/me'),
                apiFetch<ReservationWindow>('/api/reservations/window'),
            ])
            setMenus(m.menu)
            setDates({ current: m.currentMonday, next: m.nextMonday })
            setUserReservations(r.reservations)
            setWindow_(w)

            // Load ratings for current week
            try {
                const ratingData = await apiFetch<Array<{ day: string; itemType: string; itemName: string; rating: string }>>(`/api/ratings/my?week=${m.currentMonday}`)
                const rMap: Record<string, string> = {}
                ratingData.forEach(r => {
                    rMap[`${r.day}::${r.itemType}::${r.itemName}`] = r.rating
                })
                setRatings(rMap)
            } catch {
                // ratings are non-critical, fail silently
            }

            // Default view: Mon-Wed → next, Thu-Sun → next too (always start on 'next')
            setViewMode('next')
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

    // Client-side validation before hitting the API
    const validateForm = (): string | null => {
        if (!timeSlot) return 'Debes seleccionar un horario de retiro.'
        for (const day of DAYS) {
            if (!selections[day]?.meal) return `Falta seleccionar la comida del ${day}.`
            if (!selections[day]?.dessert) return `Falta seleccionar el postre del ${day}.`
        }
        return null
    }

    const handleSubmit = async () => {
        if (!dates || !window_) return

        // Validate first — don't hit the API with incomplete data
        const validationError = validateForm()
        if (validationError) {
            error(validationError)
            return
        }

        setLoading(true)
        try {
            const targetDate = window_.activeWeek
            const payload = {
                weekStart: targetDate,
                timeSlot,
                selections: DAYS.map(d => ({
                    day: d,
                    meal: selections[d]?.meal,
                    dessert: selections[d]?.dessert,
                    bread: selections[d]?.bread ?? false
                }))
            }
            await apiFetch('/api/reservations', {
                method: 'POST',
                body: JSON.stringify(payload)
            })

            setLastSavedWeek(targetDate)
            success('¡Reserva guardada con éxito!')
            setShowRatingReminder(true)

            // Reload to keep state consistent
            const r = await apiFetch<{ reservations: Reservation[] }>('/api/reservations/me')
            setUserReservations(r.reservations)
        } catch (e: any) {
            error(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleRate = async (day: string, itemType: string, itemName: string, rating: string) => {
        const key = `${day}::${itemType}::${itemName}`
        const previousRating = ratings[key]
        
        // Optimistic update (se pinta de inmediato)
        setRatings(prev => ({ ...prev, [key]: rating }))

        try {
            await apiFetch('/api/ratings', {
                method: 'PUT',
                body: JSON.stringify({ weekStart: dates?.current, day, itemType, itemName, rating }),
            })
            // No mostramos toast de éxito para evitar molestias
        } catch (e: any) {
            // Revertir estado si falla
            setRatings(prev => ({ ...prev, [key]: previousRating }))
            error(e.message || 'Error al guardar calificación')
        }
    }

    if (!menus || !dates || !window_) {
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

    // Derive display state from the backend window (authoritative)
    const { isReservationOpen, deadlineTime, deadlineDay, reason } = window_
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    const deadlineName = dayNames[deadlineDay]

    // User can edit only the next week while reservations are open AND if the menu exists
    const canEdit = viewMode === 'next' && isReservationOpen && !!activeMenu

    // Status badge
    let statusMessage = ''
    let statusColor = ''
    if (viewMode === 'current') {
        statusMessage = 'Semana en curso (Solo lectura)'
        statusColor = 'badge-gray'
    } else if (!activeMenu) {
        statusMessage = 'Menú no configurado'
        statusColor = 'badge-warning'
    } else if (isReservationOpen) {
        statusMessage = `Reservas Abiertas — cierra el ${deadlineName} ${deadlineTime}`
        statusColor = 'badge-success'
    } else {
        statusMessage = 'Reservas Cerradas'
        statusColor = 'badge-danger'
    }

    const formatDateRange = (startDateStr: string) => {
        if (!startDateStr) return ''
        const [y, m, d] = startDateStr.split('-').map(Number)
        const start = new Date(y, m - 1, d)
        const end = new Date(y, m - 1, d + 4)
        const pad = (n: number) => n.toString().padStart(2, '0')
        return `Semana del lunes ${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${start.getFullYear()} al viernes ${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`
    }

    return (
        <Layout title="Reserva de Menú" subtitle={formatDateRange(activeDate)}>
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
                        Semana Próxima
                    </button>
                </div>
                <div className={`badge ${statusColor}`}>{statusMessage}</div>
            </div>

            <div className="grid">
                {/* ── Status / Confirmation card ── */}
                {!activeMenu ? (
                    <div className="card card-warning" style={{ borderLeft: '4px solid #f59e0b' }}>
                        <div className="flex-between" style={{ marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Menú no configurado</h3>
                            <span className="badge badge-warning" style={{ backgroundColor: '#f59e0b', color: 'white' }}>Sin menú</span>
                        </div>
                        <p className="muted">El administrador todavía no cargó los platos para esta semana. Volvé a revisar más tarde.</p>
                    </div>
                ) : myRes ? (
                    <div className="card" style={{ borderLeft: '4px solid var(--accent)', backgroundColor: 'rgba(22, 163, 74, 0.05)' }}>
                        <div className="flex-between" style={{ marginBottom: '1rem' }}>
                            <h3 style={{ color: 'var(--accent)', margin: 0 }}>{lastSavedWeek === activeDate ? '✓ Reserva guardada' : 'Tu reserva está confirmada'}</h3>
                            <span className="badge badge-success">Reservada</span>
                        </div>
                        <p style={{ marginBottom: '0.5rem' }}><strong>Semana:</strong> {formatDateRange(activeDate)}</p>
                        <p style={{ marginBottom: '1rem' }}><strong>Horario de retiro:</strong> {myRes.timeSlot}</p>
                        
                        {canEdit ? (
                            <p className="muted" style={{ fontSize: '0.9rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                                ✏️ Podés modificar tu reserva hasta el {deadlineName} a las {deadlineTime}.
                            </p>
                        ) : (
                            <p className="muted" style={{ fontSize: '0.9rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                                🔒 Ventana de modificaciones cerrada (venció el {deadlineName} a las {deadlineTime}).
                            </p>
                        )}
                    </div>
                ) : (
                    <div className={`card ${canEdit ? 'card-warning' : 'card-disabled'}`} style={{ borderLeft: `4px solid ${canEdit ? '#f59e0b' : 'var(--text-light)'}` }}>
                        {canEdit ? (
                            <>
                                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                                    <h3 style={{ margin: 0 }}>Pendiente de reserva</h3>
                                    <span className="badge badge-warning" style={{ backgroundColor: '#f59e0b', color: 'white' }}>Pendiente</span>
                                </div>
                                <p className="muted">Aún no realizaste tu pedido para esta semana.</p>
                                <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', fontWeight: 600, color: 'var(--text)' }}>
                                    ⏳ Tenés tiempo hasta las {deadlineTime} del {deadlineName}.
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="flex-between" style={{ marginBottom: '1rem' }}>
                                    <h3 style={{ margin: 0 }}>Reservas Cerradas</h3>
                                    <span className="badge badge-gray">Cerrada</span>
                                </div>
                                <p className="muted">
                                    {viewMode === 'next' ? reason : 'El menú de la semana actual ya no se puede modificar.'}
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* ── Day selection grid ── */}
                {activeMenu && (
                    <div className="card">
                        <div className="grid-3">
                            {DAYS.map(day => (
                                <div key={day} className="day-card" style={{ padding: '1.25rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                    <h3 style={{ textTransform: 'capitalize', marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--accent)' }}>{day}</h3>
                                    
                                    {!canEdit && myRes ? (
                                        // Read-Only View
                                        <div className="flex-col" style={{ gap: '0.75rem' }}>
                                            <div>
                                                <span className="muted" style={{ fontSize: '0.8rem', display: 'block' }}>Comida</span>
                                                <span style={{ fontWeight: 500 }}>{selections[day]?.meal || '—'}</span>
                                            </div>
                                            <div>
                                                <span className="muted" style={{ fontSize: '0.8rem', display: 'block' }}>Postre</span>
                                                <span style={{ fontWeight: 500 }}>{selections[day]?.dessert || '—'}</span>
                                            </div>
                                            {selections[day]?.bread && (
                                                <div style={{ marginTop: '0.25rem' }}>
                                                    <span className="badge badge-gray" style={{ padding: '0.2rem 0.5rem' }}>🍞 Con pan</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : !canEdit && !myRes ? (
                                        // Empty Read-Only View
                                        <div style={{ padding: '1rem 0', textAlign: 'center', color: 'var(--text-light)' }}>
                                            <p style={{ fontSize: '0.9rem' }}>Sin selección</p>
                                        </div>
                                    ) : (
                                        // Editable Form View
                                        <div className="flex-col" style={{ gap: '1rem' }}>
                                            <div>
                                                <label className="muted" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Comida</label>
                                                <select
                                                    className="input"
                                                    value={selections[day]?.meal || ''}
                                                    onChange={e => handleSelect(day, 'meal', e.target.value)}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {activeMenu.days[day]?.meals?.map(m => (
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
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {activeMenu.days[day]?.desserts?.map(d => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                <input
                                                    type="checkbox"
                                                    id={`bread-${day}`}
                                                    checked={selections[day]?.bread || false}
                                                    onChange={e => handleSelect(day, 'bread', e.target.checked)}
                                                    style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                                                />
                                                <label htmlFor={`bread-${day}`} style={{ cursor: 'pointer', userSelect: 'none' }}>Pan</label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Submit section ── */}
                {canEdit && (
                    <div className="card" id="confirm-section" style={{ background: 'var(--glass-bg)', border: '1px solid var(--accent)' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>Confirmar Reserva</h3>
                        
                        <div className="grid-2" style={{ gap: '2rem', alignItems: 'start' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Horario de retiro *</label>
                                <select className="input" value={timeSlot} onChange={e => setTimeSlot(e.target.value)} style={{ border: !timeSlot ? '1px solid #f59e0b' : '' }}>
                                    <option value="">Seleccionar horario...</option>
                                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            
                            <div style={{ background: 'var(--bg)', padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text)' }}>Resumen de selección</h4>
                                {(() => {
                                    let completeDays = 0;
                                    let breadDays = 0;
                                    let missingDays: string[] = [];
                                    
                                    DAYS.forEach(d => {
                                        if (selections[d]?.meal && selections[d]?.dessert) {
                                            completeDays++;
                                            if (selections[d]?.bread) breadDays++;
                                        } else {
                                            missingDays.push(d);
                                        }
                                    });

                                    const isComplete = completeDays === 5 && timeSlot;

                                    return (
                                        <div className="flex-col" style={{ gap: '0.6rem', fontSize: '0.9rem' }}>
                                            <div className="flex-between">
                                                <span className="muted">Días completos:</span>
                                                <span style={{ fontWeight: 600, color: completeDays === 5 ? 'var(--accent)' : 'inherit' }}>{completeDays} / 5</span>
                                            </div>
                                            <div className="flex-between">
                                                <span className="muted">Días con pan:</span>
                                                <span style={{ fontWeight: 600 }}>{breadDays}</span>
                                            </div>
                                            <div className="flex-between">
                                                <span className="muted">Horario:</span>
                                                <span style={{ fontWeight: 600, color: !timeSlot ? '#f59e0b' : 'inherit' }}>{timeSlot || 'Falta seleccionar'}</span>
                                            </div>
                                            
                                            {!isComplete && (
                                                <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', borderRadius: '4px', fontSize: '0.85rem' }}>
                                                    <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Faltan completar datos:</strong>
                                                    <ul style={{ paddingLeft: '1rem', margin: 0 }}>
                                                        {!timeSlot && <li>Horario de retiro</li>}
                                                        {missingDays.length > 0 && <li>Platos en: {missingDays.join(', ')}</li>}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                            <button 
                                className="btn btn-primary" 
                                onClick={handleSubmit} 
                                disabled={loading}
                                style={{ width: '100%', minHeight: '3rem', fontSize: '1.1rem' }}
                            >
                                {loading ? 'Guardando...' : (myRes ? 'Guardar Cambios' : 'Confirmar Reserva')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

                {/* Ratings section (current week only) */}
                {(() => {
                    if (viewMode !== 'current') return null
                    const currentRes = userReservations.find(r => r.week === dates.current)
                    if (!currentRes?.selections?.length) return null
                    return (
                        <section className="meal-feedback-panel">
                            <div className="meal-feedback-header">
                                <div>
                                    <span className="meal-feedback-kicker">Calidad del menu</span>
                                    <h3>¿Cómo estuvo esta semana?</h3>
                                    <p>Ayudá a mejorar las próximas propuestas calificando solo lo que ya probaste.</p>
                                </div>
                                <div className="meal-feedback-summary">
                                    <strong>{currentRes.selections.length}</strong>
                                    <span>dias reservados</span>
                                </div>
                            </div>
                            <RatingSection
                                reservation={{ week: currentRes.week, selections: currentRes.selections }}
                                currentWeek={dates.current}
                                ratings={ratings}
                                onRate={handleRate}
                            />
                        </section>
                    )
                })()}

            {showRatingReminder && createPortal(
                <div className="rating-reminder-backdrop" onClick={() => setShowRatingReminder(false)} role="presentation">
                    <div
                        className="rating-reminder-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="rating-reminder-title"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            className="rating-reminder-close"
                            onClick={() => setShowRatingReminder(false)}
                            aria-label="Cerrar recordatorio"
                        >
                            x
                        </button>
                        <span className="rating-reminder-kicker">Reserva guardada</span>
                        <h3 id="rating-reminder-title">No olvides calificar tus comidas</h3>
                        <p>
                            Al finalizar cada dia reservado, entra en Semana Actual y marca si la comida
                            y el postre te gustaron. Esa información ayuda a mejorar el menú de todos.
                        </p>
                        <div className="rating-reminder-actions">
                            <button
                                className="rating-reminder-primary"
                                onClick={() => {
                                    setViewMode('current')
                                    setShowRatingReminder(false)
                                }}
                            >
                                Ir a Semana Actual
                            </button>
                            <button
                                className="rating-reminder-secondary"
                                onClick={() => setShowRatingReminder(false)}
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </Layout>
    )
}

const RATING_OPTIONS: Array<{ value: string; label: string; tone: string }> = [
    { value: 'liked', label: 'Me gustó', tone: 'positive' },
    { value: 'neutral', label: 'Regular', tone: 'neutral' },
    { value: 'disliked', label: 'No me gustó', tone: 'negative' },
]

function RatingSection({
    reservation,
    currentWeek,
    ratings,
    onRate,
}: {
    reservation: { week: string; selections: Array<{ day: string; meal: string; dessert: string }> }
    currentWeek: string
    ratings: Record<string, string>
    onRate: (day: string, itemType: string, itemName: string, rating: string) => Promise<void>
}) {
    // Only show days that have already passed (including today)
    const today = new Date()
    const DAYS_ES = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
    const [wY, wM, wD] = currentWeek.split('-').map(Number)

    const rateableDays = reservation.selections.filter(s => {
        const idx = DAYS_ES.indexOf(s.day)
        if (idx === -1) return false
        const mealDate = new Date(wY, wM - 1, wD + idx)
        mealDate.setHours(23, 59, 59, 999)
        return today >= mealDate
    })

    if (rateableDays.length === 0) {
        return (
            <div className="meal-feedback-empty">
                <strong>Aún no hay platos para calificar</strong>
                <p>La calificación se habilita al finalizar cada día reservado.</p>
            </div>
        )
    }

    return (
        <div className="meal-feedback-list">
            {rateableDays.map(sel => {
                const items: Array<{ type: 'meal' | 'dessert'; name: string; label: string }> = [
                    { type: 'meal', name: sel.meal, label: 'Comida' },
                    { type: 'dessert', name: sel.dessert, label: 'Postre' },
                ]
                return (
                    <article key={sel.day} className="meal-feedback-day">
                        <div className="meal-feedback-day-title">
                            <span>{sel.day}</span>
                        </div>
                        <div className="meal-feedback-items">
                            {items.map(item => {
                                if (!item.name) return null
                                const key = `${sel.day}::${item.type}::${item.name}`
                                const current = ratings[key]
                                return (
                                    <div key={key} className="meal-feedback-item">
                                        <div className="meal-feedback-item-copy">
                                            <span>{item.label}</span>
                                            <strong>{item.name}</strong>
                                        </div>
                                        <div className="meal-rating-control" aria-label={`Calificar ${item.label.toLowerCase()} ${item.name}`}>
                                            {RATING_OPTIONS.map(opt => {
                                                const isActive = current === opt.value
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        className={`meal-rating-button meal-rating-${opt.tone}${isActive ? ' active' : ''}`}
                                                        onClick={() => onRate(sel.day, item.type, item.name, opt.value)}
                                                        aria-pressed={isActive}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </article>
                )
            })}
        </div>
    )
}
