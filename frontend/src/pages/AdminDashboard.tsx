import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import WeekPicker from '../components/WeekPicker'
import apiFetch from '../api'
import { Menu, Reservation, User } from '../types'
import { useAuthStore } from '../hooks/useAuthStore'
import Skeleton from '../components/Skeleton'
import { useToast } from '../context/ToastContext'

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']

export default function AdminDashboard() {
    const navigate = useNavigate()
    const { success, error } = useToast()
    const currentUser = useAuthStore(s => s.user)
    const [activeTab, setActiveTab] = useState<'reservations' | 'menu' | 'users' | 'reports'>('reservations')
    const [reservations, setReservations] = useState<Reservation[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [menuData, setMenuData] = useState<{ current: Menu, next: Menu } | null>(null)
    const [menuType, setMenuType] = useState<'current' | 'next'>('next')
    const [qr, setQr] = useState('')
    const [stats, setStats] = useState<any>(null)
    const [weeks, setWeeks] = useState<string[]>([])
    const [selectedWeek, setSelectedWeek] = useState('')
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [expandedResId, setExpandedResId] = useState<string | null>(null)

    // Create User State
    const [showCreateUser, setShowCreateUser] = useState(false)
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        password: '',
        funcNumber: '',
        phoneNumber: '',
        role: 'user' as 'user' | 'admin' | 'superadmin'
    })

    const handleCreateUser = async () => {
        if (!newUser.name || !newUser.email || !newUser.password || !newUser.funcNumber) {
            error('Por favor completa todos los campos obligatorios')
            return
        }
        try {
            await apiFetch('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify(newUser)
            })
            success('Usuario creado exitosamente')
            setShowCreateUser(false)
            setNewUser({ name: '', email: '', password: '', funcNumber: '', phoneNumber: '', role: 'user' })
            loadData()
        } catch (e: any) {
            error(e.message)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    // Fetch stats when selectedWeek changes
    useEffect(() => {
        if (selectedWeek && activeTab === 'reports') {
            loadStats(selectedWeek)
        }
    }, [selectedWeek, activeTab])

    const loadData = async () => {
        try {
            const r = await apiFetch<{ reservations: Reservation[], users: User[] }>('/api/reservations/admin')
            setReservations(r.reservations)
            setUsers(r.users)

            const m = await apiFetch<{ menu: { current: Menu, next: Menu } }>('/api/menu')
            setMenuData(m.menu)

            const q = await apiFetch<{ dataUrl: string }>('/api/qr')
            setQr(q.dataUrl)

            const w = await apiFetch<{ weeks: string[] }>('/api/stats/weeks')
            setWeeks(w.weeks)
            if (w.weeks.length > 0) {
                setSelectedWeek(w.weeks[0])
            }
        } catch (e) {
            console.error(e)
        }
    }

    const loadStats = async (week: string) => {
        setLoading(true)
        try {
            console.log('Fetching stats for week:', week)
            const s = await apiFetch<{ stats: any }>('/api/stats?week=' + week)
            console.log('Received stats:', s.stats)
            setStats(s.stats)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateMenu = async () => {
        if (!menuData) return
        setLoading(true)
        try {
            await apiFetch('/api/menu', {
                method: 'PUT',
                body: JSON.stringify({ days: menuData[menuType].days, type: menuType })
            })
            success('Menu actualizado')
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
        <Layout title="Panel de Administracion">
            <div className="nav-tabs">
                <button className={`nav-tab ${activeTab === 'reservations' ? 'active' : ''}`} onClick={() => setActiveTab('reservations')}>Reservas</button>
                <button className={`nav-tab ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => setActiveTab('menu')}>Menu</button>
                <button className={`nav-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Usuarios</button>
                <button className={`nav-tab ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>Reportes</button>
                {currentUser?.role === 'superadmin' && (
                    <button className="nav-tab" onClick={() => navigate('/admin/settings')}>Configuración</button>
                )}
            </div>

            {activeTab === 'reservations' && (
                <div className="flex-col" style={{ gap: '1rem' }}>
                    <div className="flex-between" style={{ marginBottom: '1rem', alignItems: 'flex-start' }}>
                        <div className="btn-group">
                            <button
                                className={`btn ${selectedWeek === (menuData?.current.weekStart || weeks[0]) ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSelectedWeek(menuData?.current.weekStart || weeks[0])}
                            >
                                Semana Actual
                            </button>
                            <button
                                className={`btn ${selectedWeek === (menuData?.next.weekStart) ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setSelectedWeek(menuData?.next.weekStart || '')}
                            >
                                Semana Proxima
                            </button>
                            <button
                                className={`btn ${![menuData?.current.weekStart, menuData?.next.weekStart].includes(selectedWeek) ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => {
                                    // Default to the first week in history that isn't current or next
                                    const historyWeek = weeks.find(w => w !== menuData?.current.weekStart && w !== menuData?.next.weekStart)
                                    if (historyWeek) {
                                        setSelectedWeek(historyWeek)
                                    } else {
                                        // If no history, default to previous week of current
                                        if (menuData?.current.weekStart) {
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

                    {
                        ![menuData?.current.weekStart, menuData?.next.weekStart].includes(selectedWeek) && (
                            <div className="card">
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
                        )
                    }

                    <div className="card">
                        <div className="flex-between" style={{ marginBottom: '1rem' }}>
                            <h3>Reservas ({selectedWeek})</h3>
                            <input
                                className="input"
                                placeholder="Buscar reserva..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ maxWidth: '300px' }}
                            />
                        </div>
                        <div className="list">
                            {reservations.filter(r => {
                                return r.week === selectedWeek && (
                                    (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    (r.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    (r.funcNumber || '').includes(searchTerm)
                                )
                            }).map(r => {
                                const user = users.find(u => u.id === r.userId)
                                return (
                                    <div key={r.id} className="item flex-col" style={{ gap: '0.5rem' }}>
                                        <div className="flex-between" style={{ alignItems: 'center', width: '100%' }}>
                                            <div>
                                                <strong>{r.name}</strong> <span className="muted">({r.funcNumber})</span>
                                                <div className="muted">{r.email}</div>
                                                {user?.phoneNumber && <div className="muted" style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>Tel: {user.phoneNumber}</div>}
                                            </div>
                                            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div className="badge badge-success">{r.timeSlot}</div>
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => setExpandedResId(expandedResId === r.id ? null : r.id)}
                                                >
                                                    {expandedResId === r.id ? 'Ocultar' : 'Ver Detalle'}
                                                </button>
                                            </div>
                                        </div>

                                        {expandedResId === r.id && r.selections && (
                                            <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: '0.5rem', marginTop: '0.5rem', border: '1px solid var(--border)' }}>
                                                <h5 style={{ marginBottom: '0.5rem' }}>Detalle del Pedido</h5>
                                                <div className="grid-2" style={{ gap: '1rem' }}>
                                                    {r.selections.map((s, idx) => (
                                                        <div key={idx} style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                                                            <strong style={{ textTransform: 'capitalize' }}>{s.day}</strong>
                                                            <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                                                                <div>Meal: {s.meal}</div>
                                                                <div>Dessert: {s.dessert}</div>
                                                                {s.bread && <div className="badge badge-gray" style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>Con Pan</div>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            {reservations.filter(r => r.week === selectedWeek).length === 0 && <p className="muted">No hay reservas para esta semana.</p>}
                        </div>
                    </div>

                    <div className="card card-error">
                        <h3>Funcionarios Sin Reserva ({selectedWeek})</h3>
                        <p className="muted" style={{ marginBottom: '1rem' }}>Lista de usuarios que aun no han reservado su menu para esta semana.</p>
                        <div className="grid-2">
                            {users.filter(u => {
                                const hasReservation = reservations.some(r => r.userId === u.id && r.week === selectedWeek)
                                return !hasReservation && u.role !== 'admin'
                            }).map(u => (
                                <div key={u.id} className="card" style={{ border: '1px solid var(--border)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    {u.photoUrl ? (
                                        <img
                                            src={u.photoUrl}
                                            alt={u.name}
                                            style={{ width: '3rem', height: '3rem', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '3rem',
                                            height: '3rem',
                                            borderRadius: '50%',
                                            background: 'var(--accent)',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 'bold',
                                            fontSize: '1.2rem',
                                            flexShrink: 0
                                        }}>
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <strong>{u.name}</strong>
                                        <div className="muted" style={{ fontSize: '0.9rem' }}>{u.email}</div>
                                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                                            <div className="badge badge-gray">Func: {u.funcNumber || 'N/A'}</div>
                                            {u.phoneNumber && <div className="badge badge-gray">Tel: {u.phoneNumber}</div>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div >
            )
            }

            {
                activeTab === 'menu' && menuData && (
                    <div className="grid">
                        <div className="card">
                            <div className="flex-between">
                                <h3>Gestion del Menu</h3>
                                <div className="btn-group">
                                    <button
                                        className={`btn ${menuType === 'current' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setMenuType('current')}
                                    >
                                        Menu Actual (En curso)
                                    </button>
                                    <button
                                        className={`btn ${menuType === 'next' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setMenuType('next')}
                                    >
                                        Menu Proximo (Semana sgte)
                                    </button>
                                </div>
                            </div>
                            <div className="flex-between" style={{ marginTop: '1rem' }}>
                                <p className="muted">Editando: {menuType === 'current' ? 'Menu de esta semana' : 'Menu de la proxima semana'}</p>
                                {currentUser?.role === 'superadmin' ? (
                                    <button className="btn btn-primary" onClick={handleUpdateMenu} disabled={loading}>
                                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                                    </button>
                                ) : (
                                    <span className="badge badge-gray">Solo lectura (Requiere Super Admin)</span>
                                )}
                            </div>
                        </div>

                        {DAYS.map(day => (
                            <div key={day} className="card">
                                <h4 style={{ textTransform: 'capitalize', marginBottom: '1rem' }}>{day}</h4>
                                <div className="grid-2">
                                    <div>
                                        <h5 className="muted">Comidas</h5>
                                        <div className="flex-col" style={{ marginTop: '0.5rem' }}>
                                            {menuData[menuType].days[day].meals.map((m, i) => (
                                                <input
                                                    key={i}
                                                    className="input"
                                                    value={m}
                                                    onChange={e => handleMenuChange(day, 'meals', i, e.target.value)}
                                                    disabled={currentUser?.role !== 'superadmin'}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <h5 className="muted">Postres</h5>
                                        <div className="flex-col" style={{ marginTop: '0.5rem' }}>
                                            {menuData[menuType].days[day].desserts.map((d, i) => (
                                                <input
                                                    key={i}
                                                    className="input"
                                                    value={d}
                                                    onChange={e => handleMenuChange(day, 'desserts', i, e.target.value)}
                                                    disabled={currentUser?.role !== 'superadmin'}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }

            {
                activeTab === 'users' && (
                    <div className="grid">
                        <div className="card">
                            <div className="flex-between" style={{ marginBottom: '1rem' }}>
                                <h3>Usuarios y Funcionarios</h3>
                                <div className="flex-between" style={{ gap: '0.5rem' }}>
                                    <input
                                        className="input"
                                        placeholder="Buscar por nombre, email o nro..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        style={{ maxWidth: '300px' }}
                                    />
                                    <button className="btn btn-primary" onClick={() => setShowCreateUser(true)}>
                                        Crear Usuario
                                    </button>
                                </div>
                            </div>

                            {showCreateUser && (
                                <div style={{ marginBottom: '2rem', padding: '1.5rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                    <h4 style={{ marginBottom: '1rem' }}>Nuevo Usuario</h4>
                                    <div className="grid-2" style={{ gap: '1rem' }}>
                                        <input className="input" placeholder="Nombre Completo" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                                        <input className="input" placeholder="Email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                                        <input className="input" placeholder="Contrasena" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                        <input className="input" placeholder="Nro Funcionario" value={newUser.funcNumber} onChange={e => setNewUser({ ...newUser, funcNumber: e.target.value })} />
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

                            <div className="grid-2">
                                {users.filter(u => {
                                    const term = searchTerm.toLowerCase()
                                    return u.name.toLowerCase().includes(term) ||
                                        u.email.toLowerCase().includes(term) ||
                                        (u.funcNumber && u.funcNumber.includes(term))
                                }).map(u => (
                                    <UserRow key={u.id} user={u} onUpdate={handleUpdateUser} />
                                ))}
                            </div>
                        </div>

                        <div className="card">
                            <h3>Codigo QR de Acceso</h3>
                            <p className="muted" style={{ marginBottom: '1rem' }}>Escanea este codigo para acceder a la aplicacion desde el movil.</p>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                {qr && <img src={qr} alt="QR Code" style={{ width: '200px', height: '200px' }} />}
                            </div>
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'reports' && (
                    <div className="flex-col" style={{ gap: '1rem' }}>
                        <div className="flex-between" style={{ marginBottom: '1rem' }}>
                            <div className="btn-group">
                                <button
                                    className={`btn ${selectedWeek === (menuData?.current.weekStart || weeks[0]) ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setSelectedWeek(menuData?.current.weekStart || weeks[0])}
                                >
                                    Semana Actual
                                </button>
                                <button
                                    className={`btn ${selectedWeek === (menuData?.next.weekStart) ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setSelectedWeek(menuData?.next.weekStart || '')}
                                >
                                    Semana Proxima
                                </button>
                                <button
                                    className={`btn ${![menuData?.current.weekStart, menuData?.next.weekStart].includes(selectedWeek) ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => {
                                        // Default to the first week in history that isn't current or next
                                        const historyWeek = weeks.find(w => w !== menuData?.current.weekStart && w !== menuData?.next.weekStart)
                                        if (historyWeek) {
                                            setSelectedWeek(historyWeek)
                                        } else {
                                            // If no history, default to previous week of current
                                            if (menuData?.current.weekStart) {
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

                        {![menuData?.current.weekStart, menuData?.next.weekStart].includes(selectedWeek) && (
                            <div className="card">
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

                        {selectedWeek === menuData?.current.weekStart && (
                            <div className="card card-success">
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

                        {selectedWeek === menuData?.next.weekStart && (
                            <div className="card card-warning">
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
                !loading && stats && (
                    <>
                        <div className="card" style={{ marginBottom: '1rem', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                            <div className="flex-between" style={{ marginBottom: '1rem' }}>
                                <h3 style={{ color: 'var(--accent)' }}>Resumen Semanal (Total)</h3>
                                <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => window.open(`/print?type=weekly&week=${selectedWeek}`, '_blank')}
                                >
                                    Imprimir Semanal
                                </button>
                            </div>
                            <div className="grid-3">
                                <div>
                                    <h4 className="muted" style={{ marginBottom: '0.5rem' }}>Total Comidas</h4>
                                    <ul style={{ paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
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
                                <div>
                                    <h4 className="muted" style={{ marginBottom: '0.5rem' }}>Total Postres</h4>
                                    <ul style={{ paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
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
                                <div>
                                    <h4 className="muted" style={{ marginBottom: '0.5rem' }}>Total Extras</h4>
                                    <div style={{ fontSize: '1rem' }}>
                                        Panes: <strong>
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

                        <div className="grid">
                            {DAYS.map(day => {
                                const dayStats = stats[day] || {}
                                const hasData = Object.keys(dayStats).length > 0
                                const totals = hasData ? getDailyTotals(dayStats) : null

                                return (
                                    <div key={day} className="card">
                                        <h3 style={{ textTransform: 'capitalize', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>{day}</h3>

                                        {!hasData ? (
                                            <p className="muted">No hay datos para este dia.</p>
                                        ) : (
                                            <>
                                                <div style={{ background: 'var(--accent-light)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                                                    <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
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
                                                    <div className="grid-3">
                                                        <div>
                                                            <strong>Comidas:</strong>
                                                            <ul style={{ paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
                                                            {Object.entries(totals!.meals).map(([name, count]) => (
                                                                    <li key={name}>{name}: <strong>{count}</strong></li>
                                                                ))}
                                                                <li style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.25rem' }}>
                                                                    Total: <strong>{Object.values(totals!.meals).reduce((a, b) => a + b, 0)}</strong>
                                                                </li>
                                                            </ul>
                                                        </div>
                                                        <div>
                                                            <strong>Postres:</strong>
                                                            <ul style={{ paddingLeft: '1.2rem', fontSize: '0.9rem' }}>
                                                                {Object.entries(totals!.desserts).map(([name, count]) => (
                                                                    <li key={name}>{name}: <strong>{count}</strong></li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                        <div>
                                                            <strong>Extras:</strong>
                                                            <div style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                                                                Panes: <strong>{totals!.bread}</strong>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <h4 style={{ marginBottom: '1rem' }}>Detalle por Horario</h4>
                                                <div className="table-container">
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                        <thead>
                                                            <tr style={{ background: 'var(--bg)', textAlign: 'left' }}>
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
        </Layout >
    )
}

function UserRow({ user, onUpdate }: { user: User, onUpdate: (id: string, data: { funcNumber?: string, email?: string, phoneNumber?: string }) => void }) {
    const [isEditing, setIsEditing] = useState(false)
    const [formData, setFormData] = useState({
        funcNumber: user.funcNumber || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || ''
    })

    useEffect(() => {
        setFormData({
            funcNumber: user.funcNumber || '',
            email: user.email || '',
            phoneNumber: user.phoneNumber || ''
        })
    }, [user])

    const handleSave = () => {
        onUpdate(user.id, formData)
        setIsEditing(false)
    }

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border)' }}>
            <div className="flex-between">
                <div>
                    <strong>{user.name}</strong>
                    <div className="muted" style={{ fontSize: '0.9rem' }}>{user.email}</div>
                    {user.phoneNumber && <div className="muted" style={{ fontSize: '0.8rem' }}>Tel: {user.phoneNumber}</div>}
                </div>
                <span className="badge badge-gray">{user.funcNumber || 'S/N'}</span>
            </div>

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
