import { useEffect, useState, useRef, Fragment } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import WeekPicker from '../components/WeekPicker'
import apiFetch from '../api'
import { Menu, Reservation, User } from '../types'
import { useAuthStore } from '../hooks/useAuthStore'
import Skeleton from '../components/Skeleton'
import { useToast } from '../context/ToastContext'
import AvatarUploader, { type AvatarUploaderHandle } from '../components/AvatarUploader'
import CsvPreviewPanel from '../components/CsvPreviewPanel'

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
type UserRole = User['role']
const USER_ROLES: UserRole[] = ['user', 'admin', 'superadmin']

export default function AdminDashboard() {
    const navigate = useNavigate()
    const { success, error } = useToast()
    const currentUser = useAuthStore(s => s.user)
    const [searchParams, setSearchParams] = useSearchParams()
    const urlTab = searchParams.get('tab') as 'reservations' | 'menu' | 'users' | 'reports' | null
    const [activeTab, setActiveTabState] = useState<'reservations' | 'menu' | 'users' | 'reports'>(urlTab || 'reservations')

    const setActiveTab = (tab: 'reservations' | 'menu' | 'users' | 'reports') => {
        setActiveTabState(tab)
        setSearchParams({ tab })
    }
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [usersWithoutReservation, setUsersWithoutReservation] = useState<User[]>([])

    // Pagination states
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const limit = 20
    const [menuData, setMenuData] = useState<{ current: Menu, next: Menu } | null>(null)
    const [menuType, setMenuType] = useState<'current' | 'next'>('next')
    const [qr, setQr] = useState('')
    const [stats, setStats] = useState<any>(null)
    const [dishRatings, setDishRatings] = useState<Array<{
        itemName: string; itemType: string; day: string
        liked: number; neutral: number; disliked: number
        total: number; positivePercent: number
    }>>([])
    const [weeks, setWeeks] = useState<string[]>([])

    const [selectedWeek, setSelectedWeek] = useState('')
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [expandedResId, setExpandedResId] = useState<string | null>(null)
    const [selectedUserForModal, setSelectedUserForModal] = useState<User | null>(null)

    // Create User State
    const [showCreateUser, setShowCreateUser] = useState(false)
    const avatarRef = useRef<AvatarUploaderHandle>(null)
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        password: '',
        funcNumber: '',
        documentId: '',
        phoneNumber: '',
        role: 'user' as 'user' | 'admin' | 'superadmin',
        photoUrl: ''
    })

    const handleCreateUser = async () => {
        if (!newUser.name || !newUser.email || !newUser.password || !newUser.funcNumber || !newUser.documentId) {
            error('Por favor completa todos los campos obligatorios, incluyendo el documento')
            return
        }
        try {
            await apiFetch('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify(newUser)
            })
            success('Usuario creado exitosamente')
            setShowCreateUser(false)
            setNewUser({ name: '', email: '', password: '', funcNumber: '', documentId: '', phoneNumber: '', role: 'user', photoUrl: '' })
            loadData()
        } catch (e: any) {
            error(e.message)
        }
    }

    // Reset page to 1 when changing tabs or searching
    useEffect(() => {
        setPage(1)
    }, [activeTab, searchTerm, selectedWeek])

    useEffect(() => {
        // Debounce search slightly to avoid spamming requests
        const timeoutId = setTimeout(() => {
            loadData()
        }, 300)
        return () => clearTimeout(timeoutId)
    }, [activeTab, page, searchTerm, selectedWeek])

    // Fetch stats when selectedWeek changes
    useEffect(() => {
        if (selectedWeek && activeTab === 'reports') {
            loadStats(selectedWeek)
        }
    }, [selectedWeek, activeTab])

    const loadData = async () => {
        try {
            // Build query params — always pass week for reservations so pagination is server-side correct
            let query = `?page=${page}&limit=${limit}`
            if (activeTab === 'users') {
                query += `&type=users`
            }
            if (searchTerm) {
                query += `&search=${encodeURIComponent(searchTerm)}`
            }
            if (selectedWeek && activeTab === 'reservations') {
                query += `&week=${encodeURIComponent(selectedWeek)}`
            }

            const r = await apiFetch<{ reservations?: Reservation[], users?: User[], totalPages: number, total: number }>(`/api/reservations/admin${query}`)

            if (activeTab === 'users' && r.users) {
                setUsers(r.users)
                setTotalPages(r.totalPages || 1)
                setTotalItems(r.total || 0)
            } else if (r.reservations) {
                setReservations(r.reservations)
                setTotalPages(r.totalPages || 1)
                setTotalItems(r.total || 0)
            }

            const m = await apiFetch<{ menu: { current: Menu, next: Menu } }>('/api/menu')
            setMenuData(m.menu)

            const q = await apiFetch<{ dataUrl: string }>('/api/qr')
            setQr(q.dataUrl)

            const w = await apiFetch<{ weeks: string[] }>('/api/stats/weeks')
            setWeeks(w.weeks)
            setSelectedWeek(prev => prev || (w.weeks.length > 0 ? w.weeks[0] : ''))
        } catch (e) {
            console.error(e)
        }
    }

    // Fetch users without reservation from dedicated endpoint whenever selectedWeek changes
    useEffect(() => {
        if (!selectedWeek) return
        apiFetch<{ users: User[] }>(`/api/reservations/admin/without-reservation?week=${encodeURIComponent(selectedWeek)}`)
            .then(data => setUsersWithoutReservation(data.users))
            .catch(e => console.error('Users without reservation error:', e))
    }, [selectedWeek])

    const loadStats = async (week: string) => {
        setLoading(true)
        try {
            const s = await apiFetch<{ stats: any }>('/api/stats?week=' + week)
            setStats(s.stats)
            try {
                const rData = await apiFetch<Array<any>>(`/api/ratings/admin?week=${week}`)
                setDishRatings(rData)
            } catch {
                setDishRatings([])
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }


    const handleUpdateMenu = async (initializeEmpty = false) => {
        if (!menuData) return
        setLoading(true)
        try {
            await apiFetch('/api/menu', {
                method: 'PUT',
                body: JSON.stringify({ days: initializeEmpty ? {} : menuData[menuType]?.days, type: menuType })
            })
            success('Menu actualizado')
            loadData() // Reload to get the new structure
        } catch (e: any) {
            error(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleMenuChange = (day: string, type: 'meals' | 'desserts', index: number, value: string) => {
        if (!menuData) return
        const newMenu = { ...menuData }
        const newDays = { ...newMenu[menuType].days }
        newDays[day][type][index] = value
        newMenu[menuType] = { ...newMenu[menuType], days: newDays }
        setMenuData(newMenu)
    }

    const handleUpdateUser = async (userId: string, data: { funcNumber?: string, email?: string, phoneNumber?: string }) => {
        try {
            await apiFetch(`/api/admin/users/${userId}/details`, {
                method: 'PUT',
                body: JSON.stringify(data)
            })
            success('Usuario actualizado')
            loadData()
        } catch (e: any) {
            error(e.message)
        }
    }

    const handleRoleChange = async (userId: string, newRole: UserRole, userName: string, currentRole: UserRole) => {
        // Build a clear confirmation message depending on direction of change
        const promotingToAdmin = newRole === 'admin' && currentRole === 'user'
        const promotingToSuperAdmin = newRole === 'superadmin'
        const demoting = (currentRole === 'admin' || currentRole === 'superadmin') && newRole === 'user'

        let confirmMsg = `¿Cambiar el rol de "${userName}" de ${currentRole.toUpperCase()} a ${newRole.toUpperCase()}?`
        if (promotingToSuperAdmin) {
            confirmMsg = `⚠️ Estás por otorgar privilegios de SUPER ADMIN a "${userName}". Este rol tiene acceso total al sistema. ¿Confirmás?`
        } else if (promotingToAdmin) {
            confirmMsg = `Estás por promover a "${userName}" a ADMINISTRADOR. Tendrá acceso al panel de administración. ¿Confirmás?`
        } else if (demoting) {
            confirmMsg = `Estás por degradar a "${userName}" de ${currentRole.toUpperCase()} a USUARIO. Perderá acceso admin. ¿Confirmás?`
        }

        if (!window.confirm(confirmMsg)) return

        try {
            await apiFetch(`/api/admin/users/${userId}/role`, {
                method: 'PUT',
                body: JSON.stringify({ role: newRole })
            })
            success(`Rol de ${userName} actualizado a ${newRole}`)
            loadData()
        } catch (e: any) {
            error(e.message || 'Error al cambiar el rol')
        }
    }

    const getDailyTotals = (dayStats: any) => {
        const totals = { meals: {} as Record<string, number>, desserts: {} as Record<string, number>, bread: 0 }
        Object.values(dayStats).forEach((slot: any) => {
            Object.entries(slot.meals).forEach(([name, count]: [string, any]) => {
                totals.meals[name] = (totals.meals[name] || 0) + count
            })
            Object.entries(slot.desserts).forEach(([name, count]: [string, any]) => {
                totals.desserts[name] = (totals.desserts[name] || 0) + count
            })
            totals.bread += slot.bread || 0
        })
        return totals
    }

    return (
        <Layout title="Panel de Administración">
        <div className="admin-layout">
            {/* ── Top Nav ── */}
            <nav className="admin-topnav" role="navigation" aria-label="Secciones del panel">
                <button
                    className={`admin-nav-item ${activeTab === 'reservations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reservations')}
                    aria-current={activeTab === 'reservations' ? 'page' : undefined}
                >
                    <span className="admin-nav-icon">📋</span> Reservas
                </button>
                <button
                    className={`admin-nav-item ${activeTab === 'menu' ? 'active' : ''}`}
                    onClick={() => setActiveTab('menu')}
                    aria-current={activeTab === 'menu' ? 'page' : undefined}
                >
                    <span className="admin-nav-icon">🍽️</span> Menú
                </button>
                <button
                    className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                    aria-current={activeTab === 'users' ? 'page' : undefined}
                >
                    <span className="admin-nav-icon">👥</span> Usuarios
                </button>
                <button
                    className={`admin-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reports')}
                    aria-current={activeTab === 'reports' ? 'page' : undefined}
                >
                    <span className="admin-nav-icon">📊</span> Reportes
                </button>
                {currentUser?.role === 'superadmin' && (
                    <button className="admin-nav-item" onClick={() => navigate('/admin/settings')}>
                        <span className="admin-nav-icon">⚙️</span> Configuración
                    </button>
                )}
            </nav>

            {activeTab === 'reservations' && (
                <div className="admin-content">
                    {/* Week selector */}
                    <div className="admin-section-header">
                        <div>
                            <p className="admin-section-title">Reservas</p>
                            <p className="admin-section-subtitle">Semana: {selectedWeek || '—'}</p>
                        </div>
                        <div className="week-pills">
                            <button
                                className={`week-pill ${selectedWeek === (menuData?.current?.weekStart || weeks[0]) ? 'active' : ''}`}
                                onClick={() => setSelectedWeek(menuData?.current?.weekStart || weeks[0])}
                            >
                                Semana Actual
                            </button>
                            <button
                                className={`week-pill ${selectedWeek === menuData?.next?.weekStart ? 'active' : ''}`}
                                onClick={() => setSelectedWeek(menuData?.next?.weekStart || '')}
                            >
                                Próxima Semana
                            </button>
                            <button
                                className={`week-pill ${![menuData?.current?.weekStart, menuData?.next?.weekStart].includes(selectedWeek) ? 'active' : ''}`}
                                onClick={() => {
                                    const historyWeek = weeks.find(w => w !== menuData?.current?.weekStart && w !== menuData?.next?.weekStart)
                                    if (historyWeek) {
                                        setSelectedWeek(historyWeek)
                                    } else if (menuData?.current?.weekStart) {
                                        const [y, m, d] = menuData.current.weekStart.split('-').map(Number)
                                        const prev = new Date(y, m - 1, d - 7)
                                        setSelectedWeek(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`)
                                    }
                                }}
                            >
                                Historial
                            </button>
                        </div>
                    </div>

                    {/* Week picker for history */}
                    {![menuData?.current?.weekStart, menuData?.next?.weekStart].includes(selectedWeek) && (
                        <div className="admin-panel">
                            <div className="admin-panel-header">
                                <span className="admin-panel-title">🗓 Seleccionar semana del historial</span>
                            </div>
                            <div className="admin-panel-body">
                                <WeekPicker
                                    selectedDate={(() => {
                                        if (!selectedWeek) return new Date()
                                        const [y, m, d] = selectedWeek.split('-').map(Number)
                                        return new Date(y, m - 1, d)
                                    })()}
                                    onChange={(date) => {
                                        setSelectedWeek(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`)
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Reservations panel */}
                    <div className="admin-panel">
                        <div className="admin-panel-header">
                            <span className="admin-panel-title">
                                Lista de Reservas
                                {totalItems > 0 && (
                                    <span className="badge badge-gray" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>{totalItems}</span>
                                )}
                            </span>
                            <div className="filter-bar">
                                <label htmlFor="res-search" className="muted" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Buscar:</label>
                                <input
                                    id="res-search"
                                    className="input"
                                    placeholder="Nombre, email, nro..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{ maxWidth: '220px', fontSize: '0.85rem', padding: '0.45rem 0.75rem' }}
                                />
                            </div>
                        </div>

                        <div className="admin-table-wrap">
                            <table className="res-table">
                                <thead>
                                    <tr>
                                        <th>Funcionario</th>
                                        <th>Contacto</th>
                                        <th>Horario</th>
                                        <th style={{ width: '80px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reservations.map(r => {
                                        const user = users.find(u => u.id === r.userId)
                                        return (
                                            <Fragment key={r.id}>
                                                <tr>
                                                    <td>
                                                        <div className="user-name">{r.name}</div>
                                                        <div className="user-meta">Func: {r.funcNumber || '—'}</div>
                                                    </td>
                                                    <td>
                                                        <div className="user-meta">{r.email}</div>
                                                        {user?.phoneNumber && <div className="user-meta">{user.phoneNumber}</div>}
                                                    </td>
                                                    <td>
                                                        <span className="badge badge-success">{r.timeSlot}</span>
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="btn btn-sm btn-secondary"
                                                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                                                            onClick={() => setExpandedResId(expandedResId === r.id ? null : r.id)}
                                                            aria-expanded={expandedResId === r.id}
                                                            aria-label={expandedResId === r.id ? 'Ocultar detalle' : 'Ver detalle'}
                                                        >
                                                            {expandedResId === r.id ? '▲' : '▼'}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {expandedResId === r.id && r.selections && (
                                                    <tr className="res-expand-row">
                                                        <td colSpan={4}>
                                                            <div className="res-expand-inner">
                                                                {r.selections.map((s, idx) => (
                                                                    <div key={idx} className="res-expand-day">
                                                                        <strong>{s.day}</strong>
                                                                        <div>{s.meal}</div>
                                                                        <div style={{ color: 'var(--text-light)' }}>{s.dessert}</div>
                                                                        {s.bread && <span className="badge badge-gray" style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>🥖 Pan</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {reservations.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon">📋</div>
                                <p className="empty-state-title">Sin reservas</p>
                                <p className="empty-state-subtitle">No hay reservas registradas para la semana seleccionada.</p>
                            </div>
                        )}

                        {totalPages > 1 && (
                            <div className="pagination-bar">
                                <span>Página {page} de {totalPages} &mdash; {totalItems} reservas</span>
                                <div className="action-strip">
                                    <button className="btn btn-sm btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Anterior</button>
                                    <button className="btn btn-sm btn-secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Siguiente →</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sin reserva panel */}
                    <div className="admin-panel">
                        <div className="admin-panel-header">
                            <span className="admin-panel-title">⚠️ Sin reserva esta semana</span>
                            <span className="badge badge-warning">{usersWithoutReservation.length} funcionario{usersWithoutReservation.length !== 1 ? 's' : ''}</span>
                        </div>
                        {usersWithoutReservation.length === 0 ? (
                            <div className="empty-state" style={{ padding: '1.5rem' }}>
                                <div className="empty-state-icon">✅</div>
                                <p className="empty-state-title">Todos reservaron</p>
                                <p className="empty-state-subtitle">Todos los funcionarios tienen reserva para esta semana.</p>
                            </div>
                        ) : (
                            <div>
                                {usersWithoutReservation.map(u => (
                                    <div key={u.id} className="user-row">
                                        {u.photoUrl ? (
                                            <img src={u.photoUrl} alt={u.name} className="user-avatar" onClick={() => setSelectedUserForModal(u)} />
                                        ) : (
                                            <div className="user-avatar-placeholder" onClick={() => setSelectedUserForModal(u)}>
                                                {u.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <div className="user-name">{u.name}</div>
                                            <div className="user-meta">{u.email}</div>
                                            {u.funcNumber && <div className="user-meta">Func: {u.funcNumber}</div>}
                                        </div>
                                        <div>
                                            {u.phoneNumber && <span className="badge badge-gray">{u.phoneNumber}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}




            {activeTab === 'menu' && menuData && (
                <div className="admin-content">
                    <div className="admin-panel admin-menu-toolbar">
                        <div className="admin-panel-header">
                            <div>
                                <p className="admin-panel-title">Gestión del Menú</p>
                                <p className="admin-section-subtitle">
                                    Editando: {menuType === 'current' ? 'Menú de esta semana' : 'Menú de la próxima semana'}
                                </p>
                            </div>
                            <div className="admin-section-actions">
                                <div className="week-pills">
                                    <button
                                        className={`week-pill ${menuType === 'current' ? 'active' : ''}`}
                                        onClick={() => setMenuType('current')}
                                    >
                                        Semana Actual
                                    </button>
                                    <button
                                        className={`week-pill ${menuType === 'next' ? 'active' : ''}`}
                                        onClick={() => setMenuType('next')}
                                    >
                                        Próxima Semana
                                    </button>
                                </div>
                                {currentUser?.role === 'superadmin' ? (
                                    <button
                                    className="btn btn-primary btn-sm admin-toolbar-action"
                                        onClick={() => handleUpdateMenu(false)}
                                        disabled={loading || !menuData[menuType]}
                                        aria-label="Guardar cambios del menú"
                                    >
                                        {loading ? 'Guardando...' : '✓ Guardar Cambios'}
                                    </button>
                                ) : (
                                    <span className="badge badge-gray">Solo lectura</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {menuData[menuType] ? (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {DAYS.map(day => (
                                <div key={day} className="menu-day-panel">
                                    <div className="menu-day-header">
                                        <span>📅</span>
                                        <span>{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                                    </div>
                                    <div className="menu-day-body">
                                        <div className="menu-day-col">
                                            <div className="menu-col-label">
                                                <span>🍽️</span> Comidas
                                            </div>
                                            <div className="menu-input-list">
                                                {menuData[menuType]?.days[day]?.meals?.map((m: string, i: number) => (
                                                    <input
                                                        key={i}
                                                        className="input"
                                                        value={m}
                                                        onChange={e => handleMenuChange(day, 'meals', i, e.target.value)}
                                                        disabled={currentUser?.role !== 'superadmin'}
                                                        placeholder={`Opción ${i + 1}`}
                                                        aria-label={`Comida ${i + 1} del ${day}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="menu-day-col">
                                            <div className="menu-col-label">
                                                <span>🍰</span> Postres
                                            </div>
                                            <div className="menu-input-list">
                                                {menuData[menuType]?.days[day]?.desserts?.map((d: string, i: number) => (
                                                    <input
                                                        key={i}
                                                        className="input"
                                                        value={d}
                                                        onChange={e => handleMenuChange(day, 'desserts', i, e.target.value)}
                                                        disabled={currentUser?.role !== 'superadmin'}
                                                        placeholder={`Opción ${i + 1}`}
                                                        aria-label={`Postre ${i + 1} del ${day}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="menu-missing-alert">
                            <span style={{ fontSize: '2.5rem' }}>⚠️</span>
                            <p style={{ fontWeight: 700, color: 'var(--warning-text)', margin: 0 }}>Menú no configurado</p>
                            <p style={{ color: 'var(--warning-text)', opacity: 0.8, margin: 0, fontSize: '0.9rem' }}>
                                No hay un menú para la {menuType === 'current' ? 'semana actual' : 'próxima semana'}.
                                Los usuarios no podrán reservar hasta que se configure.
                            </p>
                            {currentUser?.role === 'superadmin' && (
                                <button className="btn btn-primary" onClick={() => handleUpdateMenu(true)} disabled={loading}>
                                    {loading ? 'Generando...' : '+ Generar Menú Base'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {
                activeTab === 'users' && (
                    <div className="admin-content">
                        <div className="admin-section-header">
                            <div>
                                <p className="admin-section-title">Usuarios y Funcionarios</p>
                                <p className="admin-section-subtitle">{totalItems} usuarios registrados</p>
                            </div>
                                <div className="filter-bar">
                                    <input
                                        className="input"
                                        placeholder="Buscar por nombre, email o nro..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                    />
                                    <button className="btn btn-primary" onClick={() => setShowCreateUser(true)}>
                                        Crear Usuario
                                    </button>
                                </div>
                            </div>

                            {currentUser?.role === 'superadmin' && (
                                <CsvPreviewPanel />
                            )}

                            {showCreateUser && (
                                <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                    <h4 style={{ marginBottom: '1rem' }}>Nuevo Usuario</h4>
                                    <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Foto de Perfil</label>
                                        <AvatarUploader
                                            ref={avatarRef}
                                            currentPhotoUrl={newUser.photoUrl}
                                            onPhotoChange={(url) => setNewUser(prev => ({ ...prev, photoUrl: url }))}
                                            nameForInitials={newUser.name || 'U'}
                                            size="100px"
                                        />
                                        <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                            La cuenta usará las iniciales del nombre como avatar.
                                        </p>
                                    </div>
                                    <div className="grid-2" style={{ gap: '1rem' }}>
                                        <input className="input" placeholder="Nombre Completo" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                                        <input className="input" placeholder="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                                        <input className="input" placeholder="Contrasena" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                        <input className="input" inputMode="numeric" placeholder="Nro Funcionario" value={newUser.funcNumber} onChange={e => setNewUser({ ...newUser, funcNumber: e.target.value.replace(/\D/g, '') })} />
                                        <input className="input" inputMode="numeric" placeholder="Documento (DNI)" value={newUser.documentId} onChange={e => setNewUser({ ...newUser, documentId: e.target.value.replace(/\D/g, '') })} />
                                        <input className="input" placeholder="Telefono (Opcional)" value={newUser.phoneNumber} onChange={e => setNewUser({ ...newUser, phoneNumber: e.target.value })} />
                                        <select className="input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}>
                                            <option value="user">Usuario</option>
                                            {(currentUser?.role === 'superadmin' || currentUser?.role === 'admin') && <option value="admin">Administrador</option>}
                                            {currentUser?.role === 'superadmin' && <option value="superadmin">Admin General (Super Admin)</option>}
                                        </select>
                                    </div>

                                    <div className="flex-between" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-secondary" onClick={() => setShowCreateUser(false)} style={{ marginRight: '0.5rem' }}>Cancelar</button>
                                        <button className="btn btn-primary" onClick={handleCreateUser}>Crear</button>
                                    </div>
                                </div>
                            )}

                            <div className="admin-user-grid">
                                {users.filter(u => {
                                    const term = searchTerm.toLowerCase()
                                    return u.name.toLowerCase().includes(term) ||
                                        u.email.toLowerCase().includes(term) ||
                                        (u.funcNumber && u.funcNumber.includes(term))
                                }).map(u => (
                                    <UserRow key={u.id} user={u} onUpdate={handleUpdateUser} onPhotoClick={setSelectedUserForModal} currentUserRole={currentUser?.role} currentUserId={currentUser?.id} onRoleChange={handleRoleChange} />
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex-between" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                    <div className="muted" style={{ fontSize: '0.9rem' }}>
                                        Mostrando página {page} de {totalPages} ({totalItems} usuarios en total)
                                    </div>
                                    <div className="btn-group">
                                        <button 
                                            className="btn btn-sm btn-secondary" 
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                        >
                                            Anterior
                                        </button>
                                        <button 
                                            className="btn btn-sm btn-secondary" 
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages}
                                        >
                                            Siguiente
                                        </button>
                                    </div>
                                </div>
                            )}
                        <div className="admin-panel admin-qr-panel">
                            <div>
                                <h3>Codigo QR de Acceso</h3>
                                <p className="muted">Escanea este codigo para acceder a la aplicacion desde el movil.</p>
                            </div>
                            <div className="admin-qr-box">
                                {qr ? <img src={qr} alt="QR Code" /> : <Skeleton width="200px" height="200px" />}
                            </div>
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'reports' && (
                    <div className="admin-content">
                        <div className="admin-section-header">
                            <div>
                                <p className="admin-section-title">Reportes</p>
                                <p className="admin-section-subtitle">Resumen operativo de la semana {selectedWeek || 'seleccionada'}</p>
                            </div>
                            <div className="week-pills">
                                <button
                                    className={`week-pill ${selectedWeek === (menuData?.current?.weekStart || weeks[0]) ? 'active' : ''}`}
                                    onClick={() => setSelectedWeek(menuData?.current?.weekStart || weeks[0])}
                                >
                                    Semana Actual
                                </button>
                                <button
                                    className={`week-pill ${selectedWeek === menuData?.next?.weekStart ? 'active' : ''}`}
                                    onClick={() => setSelectedWeek(menuData?.next?.weekStart || '')}
                                >
                                    Próxima Semana
                                </button>
                                <button
                                    className={`week-pill ${![menuData?.current?.weekStart, menuData?.next?.weekStart].includes(selectedWeek) ? 'active' : ''}`}
                                    onClick={() => {
                                        // Default to the first week in history that isn't current or next
                                        const historyWeek = weeks.find(w => w !== menuData?.current?.weekStart && w !== menuData?.next?.weekStart)
                                        if (historyWeek) {
                                            setSelectedWeek(historyWeek)
                                        } else {
                                            // If no history, default to previous week of current
                                            if (menuData?.current?.weekStart) {
                                                const [y, m, d] = menuData.current.weekStart.split('-').map(Number)
                                                const prev = new Date(y, m - 1, d - 7)
                                                const year = prev.getFullYear()
                                                const month = String(prev.getMonth() + 1).padStart(2, '0')
                                                const day = String(prev.getDate()).padStart(2, '0')
                                                setSelectedWeek(`${year}-${month}-${day}`)
                                            }
                                        }
                                    }}
                                >
                                    Historial
                                </button>
                            </div>
                        </div>

                        {![menuData?.current?.weekStart, menuData?.next?.weekStart].includes(selectedWeek) && (
                            <div className="admin-panel">
                                <div className="flex-between" style={{ alignItems: 'flex-start', gap: '1rem' }}>
                                    <div>
                                        <h3>Seleccionar Semana</h3>
                                        <p className="muted">Elige una fecha para ver el historial.</p>
                                    </div>
                                    <WeekPicker
                                        selectedDate={(() => {
                                            if (!selectedWeek) return new Date()
                                            const [y, m, d] = selectedWeek.split('-').map(Number)
                                            return new Date(y, m - 1, d)
                                        })()}
                                        onChange={(date) => {
                                            const year = date.getFullYear()
                                            const month = String(date.getMonth() + 1).padStart(2, '0')
                                            const day = String(date.getDate()).padStart(2, '0')
                                            setSelectedWeek(`${year}-${month}-${day}`)
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {selectedWeek === menuData?.current?.weekStart && (
                            <div className="admin-panel admin-report-hero">
                                <div className="flex-between">
                                    <div>
                                        <h3>Reporte de la Semana Actual</h3>
                                        <p className="muted">Mostrando datos para la semana del {selectedWeek} (En curso)</p>
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => window.open(`/print?type=full_week&week=${selectedWeek}`, '_blank')}
                                    >
                                        Imprimir Reporte Completo
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        style={{ marginLeft: '1rem', backgroundColor: '#8884d8' }}
                                        onClick={() => navigate('/admin/reports')}
                                    >
                                        📈 Ver Gráficos y Exportar
                                    </button>
                                </div>
                            </div>
                        )}

                        {selectedWeek === menuData?.next?.weekStart && (
                            <div className="admin-panel admin-report-hero">
                                <div className="flex-between">
                                    <div>
                                        <h3>Reporte de la Semana Proxima</h3>
                                        <p className="muted">Mostrando proyeccion para la semana del {selectedWeek}</p>
                                    </div>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => window.open(`/print?type=full_week&week=${selectedWeek}`, '_blank')}
                                    >
                                        Imprimir Reporte Completo
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        style={{ marginLeft: '1rem', backgroundColor: '#8884d8' }}
                                        onClick={() => window.location.href = '/admin/reports'}
                                    >
                                        📈 Ver Gráficos y Exportar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {
                loading && (
                    <div className="card">
                        <div className="flex-between" style={{ marginBottom: '1rem' }}>
                            <Skeleton width="200px" height="1.5rem" />
                            <Skeleton width="300px" height="2rem" />
                        </div>
                        <div className="table-container">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {[1, 2, 3].map(i => (
                                    <Skeleton key={i} height="3rem" width="100%" />
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'reports' && !loading && stats && (
                    <>
                        <div className="admin-panel admin-report-summary">
                            <div className="admin-panel-header">
                                <span className="admin-panel-title">Resumen Semanal (Total)</span>
                                <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => window.open(`/print?type=weekly&week=${selectedWeek}`, '_blank')}
                                >
                                    Imprimir Semanal
                                </button>
                            </div>
                            <div className="admin-report-metrics">
                                <div className="admin-report-metric">
                                    <h4 className="muted" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.2rem' }}>🍽️</span> Total Comidas
                                    </h4>
                                    <ul style={{ paddingLeft: '0', listStyle: 'none', fontSize: '0.9rem', color: 'var(--text)' }}>
                                        {(() => {
                                            const weeklyMeals: Record<string, number> = {}
                                            DAYS.forEach(day => {
                                                const dayStats = stats[day] || {}
                                                if (Object.keys(dayStats).length > 0) {
                                                    const totals = getDailyTotals(dayStats)
                                                    Object.entries(totals.meals).forEach(([name, count]) => {
                                                        weeklyMeals[name] = (weeklyMeals[name] || 0) + count
                                                    })
                                                }
                                            })
                                            const totalMeals = Object.values(weeklyMeals).reduce((a, b) => a + b, 0)
                                            return (
                                                <>
                                                    {Object.entries(weeklyMeals).map(([name, count]) => (
                                                        <li key={name}>{name}: <strong>{count}</strong></li>
                                                    ))}
                                                    <li style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.25rem' }}>
                                                        Total: <strong>{totalMeals}</strong>
                                                    </li>
                                                </>
                                            )
                                        })()}
                                    </ul>
                                </div>
                                <div className="admin-report-metric">
                                    <h4 className="muted" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.2rem' }}>🍰</span> Total Postres
                                    </h4>
                                    <ul style={{ paddingLeft: '0', listStyle: 'none', fontSize: '0.9rem', color: 'var(--text)' }}>
                                        {(() => {
                                            const weeklyDesserts: Record<string, number> = {}
                                            DAYS.forEach(day => {
                                                const dayStats = stats[day] || {}
                                                if (Object.keys(dayStats).length > 0) {
                                                    const totals = getDailyTotals(dayStats)
                                                    Object.entries(totals.desserts).forEach(([name, count]) => {
                                                        weeklyDesserts[name] = (weeklyDesserts[name] || 0) + count
                                                    })
                                                }
                                            })
                                            return Object.entries(weeklyDesserts).map(([name, count]) => (
                                                <li key={name}>{name}: <strong>{count}</strong></li>
                                            ))
                                        })()}
                                    </ul>
                                </div>
                                <div className="admin-report-metric admin-report-metric-center">
                                    <h4 className="muted" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.2rem' }}>🥖</span> Total Extras
                                    </h4>
                                    <div style={{ fontSize: '1.5rem', color: 'var(--text)', textAlign: 'center' }}>
                                        Panes: <strong style={{ color: 'var(--accent)' }}>
                                            {(() => {
                                                let totalBread = 0
                                                DAYS.forEach(day => {
                                                    const dayStats = stats[day] || {}
                                                    if (Object.keys(dayStats).length > 0) {
                                                        const totals = getDailyTotals(dayStats)
                                                        totalBread += totals.bread
                                                    }
                                                })
                                                return totalBread
                                            })()}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {dishRatings && dishRatings.length > 0 && (
                            <div className="admin-panel admin-report-ratings" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                                <div className="admin-panel-header">
                                    <span className="admin-panel-title">⭐ Satisfacción de Platos</span>
                                </div>
                                <div className="admin-panel-body" style={{ padding: '1rem 0' }}>
                                    <div className="grid-2" style={{ gap: '1.5rem' }}>
                                        <div className="card">
                                            <h4 style={{ color: '#16a34a', marginBottom: '1rem' }}>🏆 Ranking: Mejores Platos</h4>
                                            <div className="table-container">
                                                <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ background: 'var(--bg)' }}>
                                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Plato</th>
                                                            <th style={{ padding: '0.5rem', textAlign: 'center' }}>% Positivo</th>
                                                            <th style={{ padding: '0.5rem', textAlign: 'center' }}>Votos</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[...dishRatings].sort((a, b) => b.positivePercent - a.positivePercent).slice(0, 5).map((r, i) => (
                                                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                <td style={{ padding: '0.5rem' }}>
                                                                    <div style={{ fontWeight: 500 }}>{r.itemName}</div>
                                                                    <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{r.day} • {r.itemType === 'meal' ? 'Comida' : 'Postre'}</div>
                                                                </td>
                                                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                                    <span className={`badge ${r.positivePercent >= 80 ? 'badge-success' : r.positivePercent >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                                                                        {r.positivePercent}%
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                                    <span style={{ color: '#16a34a' }}>👍 {r.liked}</span>
                                                                    <span style={{ color: '#d97706', margin: '0 0.4rem' }}>😐 {r.neutral}</span>
                                                                    <span style={{ color: '#dc2626' }}>👎 {r.disliked}</span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div className="card">
                                            <h4 style={{ color: '#dc2626', marginBottom: '1rem' }}>📉 Platos con Más Votos Negativos</h4>
                                            <div className="table-container">
                                                <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ background: 'var(--bg)' }}>
                                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>Plato</th>
                                                            <th style={{ padding: '0.5rem', textAlign: 'center' }}>% Negativo</th>
                                                            <th style={{ padding: '0.5rem', textAlign: 'center' }}>Votos</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[...dishRatings]
                                                            .filter(r => r.disliked > 0)
                                                            .sort((a, b) => {
                                                                const aNegPercent = a.total > 0 ? (a.disliked / a.total) * 100 : 0;
                                                                const bNegPercent = b.total > 0 ? (b.disliked / b.total) * 100 : 0;
                                                                return bNegPercent - aNegPercent;
                                                            })
                                                            .slice(0, 5).map((r, i) => {
                                                                const negPercent = r.total > 0 ? Math.round((r.disliked / r.total) * 100) : 0;
                                                                return (
                                                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                    <td style={{ padding: '0.5rem' }}>
                                                                        <div style={{ fontWeight: 500 }}>{r.itemName}</div>
                                                                        <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{r.day} • {r.itemType === 'meal' ? 'Comida' : 'Postre'}</div>
                                                                    </td>
                                                                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                                        <span className="badge badge-danger">
                                                                            {negPercent}%
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                                        <span style={{ color: '#16a34a' }}>👍 {r.liked}</span>
                                                                        <span style={{ color: '#d97706', margin: '0 0.4rem' }}>😐 {r.neutral}</span>
                                                                        <span style={{ color: '#dc2626' }}>👎 {r.disliked}</span>
                                                                    </td>
                                                                </tr>
                                                            )})}
                                                            {[...dishRatings].filter(r => r.disliked > 0).length === 0 && (
                                                                <tr>
                                                                    <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-light)' }}>
                                                                        No hay votos negativos esta semana 🎉
                                                                    </td>
                                                                </tr>
                                                            )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div style={{ marginTop: '2rem' }}>
                                        <h4 style={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>Detalle General (Comidas y Postres)</h4>
                                        <div className="grid-2" style={{ gap: '1.5rem' }}>
                                            <div className="card">
                                                <h5 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>🍽️ Comidas</h5>
                                                <div className="table-container">
                                                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                                        <tbody>
                                                            {[...dishRatings].filter(r => r.itemType === 'meal').map((r, i) => (
                                                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                    <td style={{ padding: '0.5rem' }}>
                                                                        <div style={{ fontWeight: 500 }}>{r.itemName}</div>
                                                                        <div className="muted" style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>{r.day}</div>
                                                                    </td>
                                                                    <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                                        <span style={{ color: '#16a34a' }}>👍 {r.liked}</span>
                                                                        <span style={{ color: '#d97706', margin: '0 0.4rem' }}>😐 {r.neutral}</span>
                                                                        <span style={{ color: '#dc2626' }}>👎 {r.disliked}</span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {[...dishRatings].filter(r => r.itemType === 'meal').length === 0 && (
                                                                <tr><td colSpan={2} style={{ padding: '0.5rem' }}>Sin datos</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                            <div className="card">
                                                <h5 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>🍰 Postres</h5>
                                                <div className="table-container">
                                                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                                        <tbody>
                                                            {[...dishRatings].filter(r => r.itemType === 'dessert').map((r, i) => (
                                                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                    <td style={{ padding: '0.5rem' }}>
                                                                        <div style={{ fontWeight: 500 }}>{r.itemName}</div>
                                                                        <div className="muted" style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}>{r.day}</div>
                                                                    </td>
                                                                    <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                                        <span style={{ color: '#16a34a' }}>👍 {r.liked}</span>
                                                                        <span style={{ color: '#d97706', margin: '0 0.4rem' }}>😐 {r.neutral}</span>
                                                                        <span style={{ color: '#dc2626' }}>👎 {r.disliked}</span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {[...dishRatings].filter(r => r.itemType === 'dessert').length === 0 && (
                                                                <tr><td colSpan={2} style={{ padding: '0.5rem' }}>Sin datos</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="admin-report-days">
                            {DAYS.map(day => {
                                const dayStats = stats[day] || {}
                                const hasData = Object.keys(dayStats).length > 0
                                const totals = hasData ? getDailyTotals(dayStats) : null

                                return (
                                    <div key={day} className="admin-panel admin-day-report">
                                        <h3 style={{ textTransform: 'capitalize', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>{day}</h3>

                                        {!hasData ? (
                                            <p className="muted">No hay datos para este dia.</p>
                                        ) : (
                                            <>
                                                <div className="card-glass" style={{ padding: '1.5rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
                                                    <div className="flex-between" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                                        <h4 style={{ color: 'var(--accent)' }}>Resumen de Produccion (Total Dia)</h4>
                                                        <button
                                                            className="btn btn-sm btn-secondary"
                                                            onClick={() => {
                                                                // Calculate date from week + day index
                                                                const dayIndex = DAYS.indexOf(day);
                                                                const [y, m, d] = selectedWeek.split('-').map(Number);
                                                                const date = new Date(y, m - 1, d + dayIndex);
                                                                const dateStr = date.toISOString().split('T')[0];
                                                                window.open(`/print?type=daily&date=${dateStr}`, '_blank');
                                                            }}
                                                        >
                                                            Imprimir Dia
                                                        </button>
                                                    </div>
                                                    <div className="grid-3" style={{ gap: '1rem' }}>
                                                        <div className="card" style={{ padding: '1rem', borderRadius: '8px' }}>
                                                            <h5 className="muted" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <span style={{ fontSize: '1.2rem' }}>🍽️</span> Comidas:
                                                            </h5>
                                                            <ul style={{ paddingLeft: '0', listStyle: 'none', fontSize: '0.9rem' }}>
                                                            {Object.entries(totals!.meals).map(([name, count]) => (
                                                                    <li key={name}>{name}: <strong>{count}</strong></li>
                                                                ))}
                                                                <li style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.25rem' }}>
                                                                    Total: <strong>{Object.values(totals!.meals).reduce((a, b) => a + b, 0)}</strong>
                                                                </li>
                                                            </ul>
                                                        </div>
                                                        <div className="card" style={{ padding: '1rem', borderRadius: '8px' }}>
                                                            <h5 className="muted" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <span style={{ fontSize: '1.2rem' }}>🍰</span> Postres:
                                                            </h5>
                                                            <ul style={{ paddingLeft: '0', listStyle: 'none', fontSize: '0.9rem' }}>
                                                                {Object.entries(totals!.desserts).map(([name, count]) => (
                                                                    <li key={name}>{name}: <strong>{count}</strong></li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                        <div className="card" style={{ padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                            <h5 className="muted" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <span style={{ fontSize: '1.2rem' }}>🥖</span> Extras:
                                                            </h5>
                                                            <div style={{ fontSize: '1.5rem', textAlign: 'center' }}>
                                                                Panes: <strong style={{ color: 'var(--accent)' }}>{totals!.bread}</strong>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <h4 style={{ marginBottom: '1rem' }}>Detalle por Horario</h4>
                                                <div className="table-container">
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                        <thead>
                                                            <tr style={{ background: 'var(--card)', textAlign: 'left' }}>
                                                                <th style={{ padding: '0.75rem', borderBottom: '2px solid var(--border)' }}>Horario</th>
                                                                <th style={{ padding: '0.75rem', borderBottom: '2px solid var(--border)' }}>Comidas</th>
                                                                <th style={{ padding: '0.75rem', borderBottom: '2px solid var(--border)' }}>Postres</th>
                                                                <th style={{ padding: '0.75rem', borderBottom: '2px solid var(--border)' }}>Pan</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {Object.entries(dayStats).sort().map(([slot, data]: [string, any]) => (
                                                                <tr key={slot} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                    <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                                                                        <div className="flex-between" style={{ gap: '0.5rem' }}>
                                                                            {slot}
                                                                            <button
                                                                                className="btn btn-sm btn-secondary"
                                                                                style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                                                                                onClick={() => {
                                                                                    const dayIndex = DAYS.indexOf(day);
                                                                                    const [y, m, d] = selectedWeek.split('-').map(Number);
                                                                                    const date = new Date(y, m - 1, d + dayIndex);
                                                                                    const dateStr = date.toISOString().split('T')[0];
                                                                                    window.open(`/print?type=slot&date=${dateStr}&slot=${slot}`, '_blank');
                                                                                }}
                                                                            >
                                                                                Imprimir
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ padding: '0.75rem' }}>
                                                                        {Object.entries(data.meals).map(([name, count]: [string, any]) => (
                                                                            <div key={name}>{name}: <strong>{count}</strong></div>
                                                                        ))}
                                                                    </td>
                                                                    <td style={{ padding: '0.75rem' }}>
                                                                        {Object.entries(data.desserts).map(([name, count]: [string, any]) => (
                                                                            <div key={name}>{name}: <strong>{count}</strong></div>
                                                                        ))}
                                                                    </td>
                                                                    <td style={{ padding: '0.75rem' }}><strong>{data.bread}</strong></td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )
            }

            {selectedUserForModal && (
                <div className="modal-backdrop animate-fade-in" onClick={() => setSelectedUserForModal(null)}>
                    <div className="modal animate-slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedUserForModal.name}</h2>
                            <button
                                style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-light)', lineHeight: 1 }}
                                onClick={() => setSelectedUserForModal(null)}
                                aria-label="Cerrar"
                            >×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            {selectedUserForModal.photoUrl ? (
                                <img
                                    src={selectedUserForModal.photoUrl}
                                    alt={selectedUserForModal.name}
                                    style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent)' }}
                                />
                            ) : (
                                <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '2.5rem' }}>
                                    {selectedUserForModal.name ? selectedUserForModal.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <span className="badge badge-gray">Func: {selectedUserForModal.funcNumber || 'S/N'}</span>
                                <span className={`badge ${selectedUserForModal.role === 'superadmin' ? 'badge-error' : selectedUserForModal.role === 'admin' ? 'badge-success' : 'badge-gray'}`}>
                                    {selectedUserForModal.role.toUpperCase()}
                                </span>
                            </div>
                            <div style={{ width: '100%', background: 'var(--bg)', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid var(--border)' }}>
                                {[
                                    { label: 'Documento', value: selectedUserForModal.documentId || 'No registrado' },
                                    { label: 'Email', value: selectedUserForModal.email },
                                    { label: 'Teléfono', value: selectedUserForModal.phoneNumber || 'No registrado' },
                                ].map(({ label, value }) => (
                                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)' }}>
                                        <span className="muted" style={{ fontSize: '0.85rem' }}>{label}</span>
                                        <strong style={{ fontSize: '0.85rem' }}>{value}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>{/* end admin-layout */}
        </Layout>
    )
}


function UserRow({
    user,
    onUpdate,
    onPhotoClick,
    currentUserRole,
    currentUserId,
    onRoleChange
}: {
    user: User
    onUpdate: (id: string, data: { funcNumber?: string, email?: string, phoneNumber?: string, documentId?: string }) => void
    onPhotoClick: (user: User) => void
    currentUserRole?: string
    currentUserId?: string
    onRoleChange?: (userId: string, newRole: UserRole, userName: string, currentRole: UserRole) => Promise<void>
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState({
        funcNumber: user.funcNumber || '',
        documentId: user.documentId || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || ''
    })
    const [roleChanging, setRoleChanging] = useState(false)
    const [pendingRole, setPendingRole] = useState<UserRole>((user.role as UserRole) || 'user')

    useEffect(() => {
        setFormData({
            funcNumber: user.funcNumber || '',
            documentId: user.documentId || '',
            email: user.email || '',
            phoneNumber: user.phoneNumber || ''
        })
        setPendingRole((user.role as UserRole) || 'user')
    }, [user])

    const handleSave = () => {
        onUpdate(user.id, formData)
        setIsEditing(false)
    }

    const handleRoleSelect = async (newRole: UserRole) => {
        if (!onRoleChange || newRole === user.role) return
        setRoleChanging(true)
        try {
            await onRoleChange(user.id, newRole, user.name, user.role)
        } finally {
            setRoleChanging(false)
        }
    }

    const isSelf = currentUserId === user.id

    return (
        <div className="card admin-user-card">
            <div className="admin-user-card-header">
                <div className="admin-user-main">
                    {user.photoUrl ? (
                        <img
                            src={user.photoUrl}
                            alt={user.name}
                            className="admin-user-photo"
                            onClick={() => onPhotoClick(user)}
                        />
                    ) : (
                        <div
                            className="admin-user-photo admin-user-photo-placeholder"
                            onClick={() => onPhotoClick(user)}
                        >
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                    )}
                    <div>
                        <strong>{user.name}</strong>
                        <div className="muted" style={{ fontSize: '0.9rem' }}>{user.email}</div>
                        {user.phoneNumber && <div className="muted" style={{ fontSize: '0.8rem' }}>Tel: {user.phoneNumber}</div>}
                        {user.lastReservation ? (
                            <div style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.25rem' }}>Última reserva: {user.lastReservation}</div>
                        ) : (
                            user.role === 'user' && <div style={{ fontSize: '0.8rem', color: 'var(--error)', marginTop: '0.25rem' }}>Nunca ha reservado</div>
                        )}
                    </div>
                </div>
                <div className="admin-user-badges">
                    <span className="badge badge-gray">{user.funcNumber || 'S/N'}</span>
                    <span className={`badge ${user.role === 'superadmin' ? 'badge-error' : user.role === 'admin' ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: '0.7rem' }}>
                        {user.role}
                    </span>
                </div>
            </div>

            {/* Role change — only visible to superadmin, hidden on own card */}
            {currentUserRole === 'superadmin' && (
                <div className="admin-role-control">
                    <div className="admin-role-control-row">
                        <span className="muted" style={{ fontSize: '0.85rem', fontWeight: 500 }}>Rol:</span>
                        {isSelf ? (
                            <span className="badge badge-gray" style={{ fontSize: '0.8rem' }}>No puedes cambiar tu propio rol</span>
                        ) : (
                            <div className="admin-role-actions">
                                <select
                                    className="input"
                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem', width: 'auto' }}
                                    value={pendingRole || 'user'}
                                    disabled={roleChanging}
                                    onChange={e => {
                                        const nextRole = e.target.value as UserRole;
                                        if (USER_ROLES.includes(nextRole)) setPendingRole(nextRole as UserRole);
                                    }}
                                >
                                    <option value="user">Usuario</option>
                                    <option value="admin">Administrador</option>
                                    <option value="superadmin">Super Admin</option>
                                </select>
                                <button
                                    className="btn btn-sm btn-primary"
                                    disabled={roleChanging || pendingRole === user.role}
                                    onClick={() => handleRoleSelect(pendingRole)}
                                    style={{ minWidth: '80px' }}
                                >
                                    {roleChanging ? '...' : 'Aplicar'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div style={{ marginTop: 'auto' }}>
                {!isEditing ? (
                    <button className="btn btn-sm btn-secondary" style={{ width: '100%' }} onClick={() => setIsEditing(true)}>Editar Datos</button>
                ) : (
                    <div className="flex-col" style={{ gap: '0.5rem' }}>
                        <input
                            className="input"
                            value={formData.funcNumber}
                            onChange={e => setFormData({ ...formData, funcNumber: e.target.value })}
                            placeholder="Nro Funcionario"
                        />
                        <input
                            className="input"
                            value={formData.documentId}
                            onChange={e => setFormData({ ...formData, documentId: e.target.value })}
                            placeholder="Documento (C.I.)"
                        />
                        <input
                            className="input"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            placeholder="Email"
                        />
                        <input
                            className="input"
                            value={formData.phoneNumber}
                            onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                            placeholder="Telefono"
                        />
                        <div className="grid-2" style={{ gap: '0.5rem' }}>
                            <button className="btn btn-sm btn-primary" onClick={handleSave}>Guardar</button>
                            <button className="btn btn-sm btn-secondary" onClick={() => setIsEditing(false)}>Cancelar</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
