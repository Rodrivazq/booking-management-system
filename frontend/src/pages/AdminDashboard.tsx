import { useEffect, useState, useRef, Fragment, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import Layout from '../components/Layout'
import WeekPicker from '../components/WeekPicker'
import apiFetch from '../api'
import { Menu, Reservation, User } from '../types'
import { useAuthStore } from '../hooks/useAuthStore'
import Skeleton from '../components/Skeleton'
import { useToast } from '../context/ToastContext'
import AvatarUploader, { type AvatarUploaderHandle } from '../components/AvatarUploader'
import Icon from '../components/Icon'
import ConfirmDialog, { type ConfirmOptions } from '../components/ConfirmDialog'

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']

type CatalogItem = { name: string; count: number }

// Resumen del menú seleccionado: platos cargados, días completos y faltantes.
function computeMenuStats(menu: any) {
    let total = 0
    let configured = 0
    const incomplete: string[] = []
    for (const day of DAYS) {
        const meals = (menu?.days?.[day]?.meals || []).filter((x: string) => String(x || '').trim())
        const desserts = (menu?.days?.[day]?.desserts || []).filter((x: string) => String(x || '').trim())
        total += meals.length + desserts.length
        if (meals.length > 0 && desserts.length > 0) configured++
        else incomplete.push(day)
    }
    return { total, configured, incomplete }
}
type UserRole = User['role']
const USER_ROLES: UserRole[] = ['user', 'admin', 'superadmin']

// Resumen agregado de una semana (de /api/reports/stats)
interface ReservasSummary {
    dailyStats: { date: string; total: number; withBread: number; withoutBread: number; dayName?: string }[]
    userStats: { totalUsers: number; activeUsers: number }
    breadStats: { withBread: number; withoutBread: number }
    timeSlotStats: { time: string; count: number }[]
}

// Resumen agregado de usuarios (de /api/admin/users/overview)
interface UsersOverview {
    total: number
    byRole: { user: number; admin: number; superadmin: number }
    verified: number
    unverified: number
    withReservation: number
    withRatings: number
    totalRatings: number
    globalSatisfaction: number
}

// Perfil de gustos de un usuario (de /api/ratings/admin/user/:id)
interface UserRatings {
    total: number
    liked: number
    neutral: number
    disliked: number
    satisfactionPercent: number
    favorites: { itemName: string; itemType: string; liked: number; total: number; positivePercent: number }[]
    dislikedDishes: { itemName: string; itemType: string; disliked: number; total: number }[]
    recent: { itemName: string; itemType: string; rating: string; day: string; weekStart: string }[]
}

export default function AdminDashboard() {
    const navigate = useNavigate()
    const { success, error } = useToast()
    const currentUser = useAuthStore(s => s.user)
    const [searchParams, setSearchParams] = useSearchParams()
    const urlTab = searchParams.get('tab') as 'overview' | 'reservations' | 'menu' | 'users' | 'reports' | null
    const [activeTab, setActiveTabState] = useState<'overview' | 'reservations' | 'menu' | 'users' | 'reports'>(urlTab || 'overview')

    const setActiveTab = (tab: 'overview' | 'reservations' | 'menu' | 'users' | 'reports') => {
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

    // Confirmación tematizada (reemplaza window.confirm)
    const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null)
    const confirmResolver = useRef<((v: boolean) => void) | null>(null)
    const requestConfirm = (opts: ConfirmOptions) => new Promise<boolean>(resolve => {
        confirmResolver.current = resolve
        setConfirmState(opts)
    })
    const resolveConfirm = (result: boolean) => {
        setConfirmState(null)
        const r = confirmResolver.current
        confirmResolver.current = null
        r?.(result)
    }

    // Datos del panel de inicio (overview)
    const [overview, setOverview] = useState<{
        window: { isReservationOpen: boolean; deadlineDay: number; deadlineTime: string; reason: string; activeWeek: string }
        totalUsers: number
        reservedActive: number
        withoutActive: number
    } | null>(null)
    const [overviewLoading, setOverviewLoading] = useState(false)

    // Resumen de la semana en la pestaña Reservas
    const [weekSummary, setWeekSummary] = useState<ReservasSummary | null>(null)

    // Catálogo de platos ya usados (autocompletado en la pestaña Menú)
    const [menuCatalog, setMenuCatalog] = useState<{ meals: string[]; desserts: string[]; catalog: { meals: CatalogItem[]; desserts: CatalogItem[] } }>({ meals: [], desserts: [], catalog: { meals: [], desserts: [] } })
    const [catalogQuery, setCatalogQuery] = useState('')
    const [catalogFilter, setCatalogFilter] = useState<'meals' | 'desserts'>('meals')
    const [catalogOpen, setCatalogOpen] = useState(false)

    // Overview de usuarios + perfil de gustos del usuario abierto en el modal
    const [usersOverview, setUsersOverview] = useState<UsersOverview | null>(null)
    const [userRatings, setUserRatings] = useState<UserRatings | null>(null)
    const [userRatingsLoading, setUserRatingsLoading] = useState(false)

    // Create User State
    const [showCreateUser, setShowCreateUser] = useState(false)
    const avatarRef = useRef<AvatarUploaderHandle>(null)
    const emptyNewUser = {
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        funcNumber: '',
        documentId: '',
        phoneNumber: '',
        role: 'user' as 'user' | 'admin' | 'superadmin',
        photoUrl: ''
    }
    const [newUser, setNewUser] = useState(emptyNewUser)

    const handleCreateUser = async () => {
        if (!newUser.firstName.trim() || !newUser.lastName.trim() || !newUser.email || !newUser.password || !newUser.funcNumber || !newUser.documentId) {
            error('Completá nombre, apellido, email, contraseña, nro de funcionario y documento.')
            return
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email.trim())) {
            error('Ingresá un correo electrónico válido.')
            return
        }
        try {
            const { firstName, lastName, ...rest } = newUser
            await apiFetch('/api/admin/users', {
                method: 'POST',
                body: JSON.stringify({ ...rest, name: `${firstName.trim()} ${lastName.trim()}`.trim() })
            })
            success('Usuario creado exitosamente')
            setShowCreateUser(false)
            setNewUser(emptyNewUser)
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

    // Cargar el resumen de usuarios al entrar a la pestaña Usuarios
    useEffect(() => {
        if (activeTab !== 'users') return
        let cancelled = false
        apiFetch<UsersOverview>('/api/admin/users/overview')
            .then(d => { if (!cancelled) setUsersOverview(d) })
            .catch(e => console.error('users overview error', e))
        return () => { cancelled = true }
    }, [activeTab])

    // Cargar el perfil de gustos cuando se abre el modal de un usuario
    useEffect(() => {
        if (!selectedUserForModal) { setUserRatings(null); return }
        let cancelled = false
        setUserRatingsLoading(true)
        apiFetch<UserRatings>(`/api/ratings/admin/user/${selectedUserForModal.id}`)
            .then(d => { if (!cancelled) setUserRatings(d) })
            .catch(() => { if (!cancelled) setUserRatings(null) })
            .finally(() => { if (!cancelled) setUserRatingsLoading(false) })
        return () => { cancelled = true }
    }, [selectedUserForModal])

    // Cargar el catálogo de platos al entrar a la pestaña Menú
    useEffect(() => {
        if (activeTab !== 'menu') return
        let cancelled = false
        apiFetch<{ meals: string[]; desserts: string[]; catalog?: { meals: CatalogItem[]; desserts: CatalogItem[] } }>('/api/menu/catalog')
            .then(d => {
                if (cancelled) return
                setMenuCatalog({
                    meals: d.meals || [],
                    desserts: d.desserts || [],
                    catalog: {
                        meals: d.catalog?.meals || [],
                        desserts: d.catalog?.desserts || [],
                    },
                })
            })
            .catch(e => console.error('menu catalog error', e))
        return () => { cancelled = true }
    }, [activeTab])

    // Cargar el resumen agregado de la semana para la pestaña Reservas
    useEffect(() => {
        if (activeTab !== 'reservations' || !selectedWeek) return
        let cancelled = false
        setWeekSummary(null)
        apiFetch<ReservasSummary>(`/api/reports/stats?week=${encodeURIComponent(selectedWeek)}`)
            .then(d => { if (!cancelled) setWeekSummary(d) })
            .catch(e => console.error('week summary error', e))
        return () => { cancelled = true }
    }, [activeTab, selectedWeek])

    // Cargar datos del panel de inicio cuando se entra a esa pestaña
    useEffect(() => {
        if (activeTab !== 'overview') return
        let cancelled = false
        const run = async () => {
            setOverviewLoading(true)
            try {
                const [w, usersRes] = await Promise.all([
                    apiFetch<{ isReservationOpen: boolean; deadlineDay: number; deadlineTime: string; reason: string; activeWeek: string }>('/api/reservations/window'),
                    apiFetch<{ total: number }>('/api/reservations/admin?type=users&page=1&limit=1'),
                ])
                const [resRes, withoutRes] = await Promise.all([
                    apiFetch<{ total: number }>(`/api/reservations/admin?week=${encodeURIComponent(w.activeWeek)}&page=1&limit=1`),
                    apiFetch<{ users: User[] }>(`/api/reservations/admin/without-reservation?week=${encodeURIComponent(w.activeWeek)}`),
                ])
                if (!cancelled) setOverview({ window: w, totalUsers: usersRes.total, reservedActive: resRes.total, withoutActive: withoutRes.users.length })
            } catch (e) {
                console.error('overview load error', e)
            } finally {
                if (!cancelled) setOverviewLoading(false)
            }
        }
        run()
        return () => { cancelled = true }
    }, [activeTab])

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

        // Salvaguarda: editar la semana EN CURSO es riesgoso (puede haber reservas
        // hechas). Pedimos confirmación explícita para no cambiarla por error
        // creyendo que era la próxima.
        if (menuType === 'current' && !initializeEmpty) {
            const ok = await requestConfirm({
                title: 'Vas a cambiar la semana EN CURSO',
                message: 'Estás por modificar el menú de la semana actual, que ya está corriendo. Si hay reservas hechas, quitar o cambiar platos puede afectarlas. ¿Seguro que querés editar la semana actual y no la próxima?',
                confirmLabel: 'Sí, editar la semana actual',
                tone: 'danger',
            })
            if (!ok) return
        }

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

    // Copia el menú de la otra semana al que se está editando (no guarda hasta confirmar).
    const copyMenuFromOtherWeek = () => {
        if (!menuData) return
        const source = menuType === 'next' ? menuData.current : menuData.next
        if (!source?.days || Object.keys(source.days).length === 0) {
            error('La otra semana no tiene un menú cargado para copiar.')
            return
        }
        setMenuData({
            ...menuData,
            [menuType]: { ...menuData[menuType], days: JSON.parse(JSON.stringify(source.days)) },
        })
        success('Menú copiado al formulario. Revisá y guardá los cambios.')
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

        let title = 'Cambiar rol'
        let message = `¿Cambiar el rol de "${userName}" de ${currentRole.toUpperCase()} a ${newRole.toUpperCase()}?`
        if (promotingToSuperAdmin) {
            title = 'Otorgar Super Admin'
            message = `Estás por otorgar privilegios de SUPER ADMIN a "${userName}". Este rol tiene acceso total al sistema. ¿Confirmás?`
        } else if (promotingToAdmin) {
            title = 'Promover a administrador'
            message = `Estás por promover a "${userName}" a ADMINISTRADOR. Tendrá acceso al panel de administración. ¿Confirmás?`
        } else if (demoting) {
            title = 'Degradar usuario'
            message = `Estás por degradar a "${userName}" de ${currentRole.toUpperCase()} a USUARIO. Perderá acceso admin. ¿Confirmás?`
        }

        const ok = await requestConfirm({
            title,
            message,
            confirmLabel: promotingToSuperAdmin ? 'Sí, otorgar' : demoting ? 'Sí, degradar' : 'Confirmar',
            tone: (promotingToSuperAdmin || demoting) ? 'danger' : 'primary',
        })
        if (!ok) return

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

    // Copia nombres + teléfonos de quienes no reservaron, para recordatorios manuales.
    const copyWithoutReservation = async () => {
        if (usersWithoutReservation.length === 0) return
        const text = usersWithoutReservation
            .map(u => `${u.name}${u.phoneNumber ? ' - ' + u.phoneNumber : ''}`)
            .join('\n')
        try {
            await navigator.clipboard.writeText(text)
            success(`Copiados ${usersWithoutReservation.length} contacto(s) sin reserva`)
        } catch {
            error('No se pudo copiar al portapapeles')
        }
    }

    // Habilita/deshabilita a un usuario a reservar la semana en curso.
    const toggleReservationOverride = async (enable: boolean) => {
        if (!selectedUserForModal) return
        try {
            const r = await apiFetch<{ reservationOverrideWeek: string | null }>(`/api/admin/users/${selectedUserForModal.id}/reservation-override`, {
                method: 'PUT',
                body: JSON.stringify({ enable }),
            })
            setSelectedUserForModal({ ...selectedUserForModal, reservationOverrideWeek: r.reservationOverrideWeek })
            success(enable ? 'Habilitado para reservar la semana actual.' : 'Permiso de esta semana quitado.')
            loadData()
        } catch (e: any) {
            error(e.message || 'No se pudo actualizar el permiso')
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
                    className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                    aria-current={activeTab === 'overview' ? 'page' : undefined}
                >
                    <span className="admin-nav-icon"><Icon name="home" /></span> Inicio
                </button>
                <button
                    className={`admin-nav-item ${activeTab === 'reservations' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reservations')}
                    aria-current={activeTab === 'reservations' ? 'page' : undefined}
                >
                    <span className="admin-nav-icon"><Icon name="list" /></span> Reservas
                </button>
                <button
                    className={`admin-nav-item ${activeTab === 'menu' ? 'active' : ''}`}
                    onClick={() => setActiveTab('menu')}
                    aria-current={activeTab === 'menu' ? 'page' : undefined}
                >
                    <span className="admin-nav-icon"><Icon name="utensils" /></span> Menú
                </button>
                <button
                    className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                    aria-current={activeTab === 'users' ? 'page' : undefined}
                >
                    <span className="admin-nav-icon"><Icon name="users" /></span> Usuarios
                </button>
                <button
                    className={`admin-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reports')}
                    aria-current={activeTab === 'reports' ? 'page' : undefined}
                >
                    <span className="admin-nav-icon"><Icon name="barChart" /></span> Reportes
                </button>
                {currentUser?.role === 'superadmin' && (
                    <button className="admin-nav-item" onClick={() => navigate('/admin/settings')}>
                        <span className="admin-nav-icon"><Icon name="settings" /></span> Configuración
                    </button>
                )}
            </nav>

            {activeTab === 'overview' && (
                <div className="admin-content">
                    <div className="admin-section-header">
                        <div>
                            <p className="admin-section-title">Inicio</p>
                            <p className="admin-section-subtitle">Resumen operativo del sistema</p>
                        </div>
                    </div>

                    {overviewLoading && !overview ? (
                        <div className="admin-panel"><div className="admin-panel-body"><Skeleton height="90px" /></div></div>
                    ) : overview && (() => {
                        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
                        const open = overview.window.isReservationOpen
                        const nextOk = ((menuData?.next?.days as any)?.lunes?.meals?.length ?? 0) > 0

                        const alerts: Array<{ tone: 'warning' | 'info' | 'success'; text: string; action?: { label: string; tab: 'reservations' | 'menu' } }> = []
                        if (!nextOk) alerts.push({ tone: 'warning', text: 'El menú de la próxima semana no está configurado. Los usuarios no podrán reservar hasta cargarlo.', action: { label: 'Ir a Menú', tab: 'menu' } })
                        if (overview.withoutActive > 0 && open) alerts.push({ tone: 'info', text: `${overview.withoutActive} funcionario${overview.withoutActive !== 1 ? 's' : ''} todavía no reservó para la semana activa.`, action: { label: 'Ver reservas', tab: 'reservations' } })
                        if (!open) alerts.push({ tone: 'info', text: 'La ventana de reservas está cerrada para esta semana.' })
                        if (alerts.length === 0) alerts.push({ tone: 'success', text: 'Todo en orden: menú cargado y ventana de reservas al día.' })

                        const toneColor = (t: string) => t === 'warning' ? 'var(--warning-text)' : t === 'success' ? 'var(--rating-liked)' : 'var(--accent)'
                        const toneBg = (t: string) => t === 'warning' ? 'var(--warning-bg)' : t === 'success' ? 'var(--success-bg)' : 'var(--accent-light)'

                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* Estado de la ventana de reservas */}
                                <div className="admin-panel" style={{ borderLeft: `4px solid ${open ? 'var(--rating-liked)' : 'var(--rating-disliked)'}` }}>
                                    <div className="admin-panel-body" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                        <span style={{ color: open ? 'var(--rating-liked)' : 'var(--rating-disliked)', display: 'flex' }}><Icon name="clock" size={28} /></span>
                                        <div style={{ flex: 1, minWidth: '200px' }}>
                                            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>{open ? 'Reservas abiertas' : 'Reservas cerradas'}</div>
                                            <div className="muted" style={{ fontSize: '0.9rem' }}>{overview.window.reason}</div>
                                        </div>
                                        <span className={`badge ${open ? 'badge-success' : 'badge-error'}`}>Cierre: {dayNames[overview.window.deadlineDay]} {overview.window.deadlineTime}</span>
                                    </div>
                                </div>

                                {/* KPIs */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    <ReportStatTile icon={<Icon name="users" />} label="Usuarios totales" value={overview.totalUsers} accent="#0284c7" />
                                    <ReportStatTile icon={<Icon name="check" />} label="Reservaron (semana activa)" value={overview.reservedActive} accent="#16a34a" />
                                    <ReportStatTile icon={<Icon name="alert" />} label="Sin reserva" value={overview.withoutActive} accent={overview.withoutActive > 0 ? '#dc2626' : '#64748b'} />
                                </div>

                                {/* Alertas */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {alerts.map((a, i) => (
                                        <div key={i} className="admin-panel" style={{ borderLeft: `4px solid ${toneColor(a.tone)}`, background: toneBg(a.tone) }}>
                                            <div className="admin-panel-body" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                                                <span style={{ color: toneColor(a.tone), display: 'flex' }}><Icon name={a.tone === 'success' ? 'check' : 'alert'} size={20} /></span>
                                                <span style={{ flex: 1, minWidth: '200px', color: 'var(--text)', fontSize: '0.92rem' }}>{a.text}</span>
                                                {a.action && (
                                                    <button className="btn btn-sm btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} onClick={() => setActiveTab(a.action!.tab)}>
                                                        {a.action.label} <Icon name="arrowRight" size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Accesos rápidos */}
                                <div className="admin-panel">
                                    <div className="admin-panel-header"><span className="admin-panel-title">Accesos rápidos</span></div>
                                    <div className="admin-panel-body" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                        <button className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }} onClick={() => setActiveTab('reservations')}><Icon name="list" size={16} /> Reservas</button>
                                        <button className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }} onClick={() => setActiveTab('menu')}><Icon name="utensils" size={16} /> Menú</button>
                                        <button className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }} onClick={() => setActiveTab('users')}><Icon name="users" size={16} /> Usuarios</button>
                                        <button className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }} onClick={() => setActiveTab('reports')}><Icon name="barChart" size={16} /> Reportes</button>
                                    </div>
                                </div>
                            </div>
                        )
                    })()}
                </div>
            )}

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
                                <span className="admin-panel-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}><Icon name="calendar" size={17} /> Seleccionar semana del historial</span>
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

                    {/* Resumen agregado de la semana */}
                    {weekSummary && (() => {
                        const s = weekSummary
                        const active = s.userStats.activeUsers
                        const total = s.userStats.totalUsers
                        const adhesion = total > 0 ? Math.round((active / total) * 100) : 0
                        const without = Math.max(0, total - active)
                        const totalMeals = s.dailyStats.reduce((a, c) => a + c.total, 0)
                        const cap = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1) : str
                        const dayItems: Array<[string, number]> = s.dailyStats.map(d => [cap(d.dayName || d.date), d.total])
                        const slotItems: Array<[string, number]> = s.timeSlotStats.map(t => [t.time, t.count])
                        return (
                            <div className="admin-panel">
                                <div className="admin-panel-header">
                                    <span className="admin-panel-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}><Icon name="barChart" size={17} /> Resumen de la semana</span>
                                    <button className="btn btn-sm btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} onClick={() => window.open(`/print?type=weekly&week=${selectedWeek}`, '_blank')}>
                                        <Icon name="printer" size={14} /> Imprimir
                                    </button>
                                </div>
                                <div className="admin-panel-body">
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                                        <ReportStatTile icon={<Icon name="check" />} label="Reservaron" value={active} accent="#16a34a" />
                                        <ReportStatTile icon={<Icon name="users" />} label="Adhesión" value={`${adhesion}%`} accent="#0284c7" />
                                        <ReportStatTile icon={<Icon name="alert" />} label="Sin reserva" value={without} accent={without > 0 ? '#dc2626' : '#64748b'} />
                                        <ReportStatTile icon={<Icon name="utensils" />} label="Comidas a preparar" value={totalMeals} accent="#9333ea" />
                                        <ReportStatTile icon={<Icon name="bread" />} label="Con pan" value={s.breadStats.withBread} accent="#d97706" />
                                    </div>
                                    <div className="grid-2" style={{ gap: '1.5rem' }}>
                                        <ReportBreakdownList title="Reservas por día" icon={<Icon name="calendar" size={15} />} accent="#0284c7" sortItems={false} items={dayItems} />
                                        <ReportBreakdownList title="Horarios de retiro" icon={<Icon name="clock" size={15} />} accent="#8b5cf6" sortItems={false} items={slotItems} />
                                    </div>
                                </div>
                            </div>
                        )
                    })()}

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
                                                                        {s.bread && <span className="badge badge-gray" style={{ fontSize: '0.7rem', marginTop: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Icon name="bread" size={12} /> Pan</span>}
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
                                <div className="empty-state-icon"><Icon name="list" size={36} /></div>
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
                            <span className="admin-panel-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}><Icon name="alert" size={17} /> Sin reserva esta semana</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                <span className="badge badge-warning">{usersWithoutReservation.length} funcionario{usersWithoutReservation.length !== 1 ? 's' : ''}</span>
                                {usersWithoutReservation.length > 0 && (
                                    <button className="btn btn-sm btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} onClick={copyWithoutReservation}>
                                        <Icon name="list" size={14} /> Copiar contactos
                                    </button>
                                )}
                            </div>
                        </div>
                        {usersWithoutReservation.length === 0 ? (
                            <div className="empty-state" style={{ padding: '1.5rem' }}>
                                <div className="empty-state-icon" style={{ color: 'var(--rating-liked)' }}><Icon name="check" size={36} /></div>
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
                                    <>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                            onClick={copyMenuFromOtherWeek}
                                            disabled={loading}
                                            title={`Copiar el menú de la semana ${menuType === 'next' ? 'actual' : 'próxima'} a este formulario`}
                                        >
                                            <Icon name="calendar" size={15} /> Copiar de {menuType === 'next' ? 'Sem. actual' : 'Sem. próxima'}
                                        </button>
                                        <button
                                            className="btn btn-primary btn-sm admin-toolbar-action"
                                            onClick={() => handleUpdateMenu(false)}
                                            disabled={loading || !menuData[menuType]}
                                            aria-label="Guardar cambios del menú"
                                        >
                                            {loading ? 'Guardando...' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Icon name="save" size={15} /> Guardar cambios</span>}
                                        </button>
                                    </>
                                ) : (
                                    <span className="badge badge-gray">Solo lectura</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Resumen del menú seleccionado */}
                    {(() => {
                        const stats = menuData[menuType] ? computeMenuStats(menuData[menuType]) : null
                        const kpis = [
                            { label: 'Días completos', value: stats ? `${stats.configured}/5` : '—' },
                            { label: 'Platos en la semana', value: stats ? String(stats.total) : '—' },
                            { label: 'Catálogo · comidas', value: String(menuCatalog.catalog.meals.length) },
                            { label: 'Catálogo · postres', value: String(menuCatalog.catalog.desserts.length) },
                        ]
                        return (
                            <div className="admin-panel">
                                <div className="admin-panel-header">
                                    <p className="admin-panel-title">Resumen del menú</p>
                                </div>
                                <div className="admin-panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                                    {kpis.map(k => (
                                        <div key={k.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.85rem 1rem' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>{k.value}</div>
                                            <div className="muted" style={{ fontSize: '0.8rem' }}>{k.label}</div>
                                        </div>
                                    ))}
                                </div>
                                {stats && stats.incomplete.length > 0 && (
                                    <div className="admin-panel-body" style={{ paddingTop: 0 }}>
                                        <span className="badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
                                            Faltan platos en: {stats.incomplete.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    })()}

                    {/* Catálogo de platos usados (solo lectura) */}
                    <div className="admin-panel">
                        <div className="admin-panel-header" style={{ cursor: 'pointer' }} onClick={() => setCatalogOpen(o => !o)}>
                            <div>
                                <p className="admin-panel-title">Catálogo de platos</p>
                                <p className="admin-section-subtitle">
                                    {menuCatalog.catalog.meals.length} comidas · {menuCatalog.catalog.desserts.length} postres usados en menús anteriores
                                </p>
                            </div>
                            <button type="button" className="btn btn-secondary btn-sm">{catalogOpen ? 'Ocultar' : 'Ver catálogo'}</button>
                        </div>
                        {catalogOpen && (
                            <div className="admin-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <div className="week-pills">
                                        <button className={`week-pill ${catalogFilter === 'meals' ? 'active' : ''}`} onClick={() => setCatalogFilter('meals')}>Comidas</button>
                                        <button className={`week-pill ${catalogFilter === 'desserts' ? 'active' : ''}`} onClick={() => setCatalogFilter('desserts')}>Postres</button>
                                    </div>
                                    <input className="input" placeholder="Buscar plato…" value={catalogQuery} onChange={e => setCatalogQuery(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
                                </div>
                                {(() => {
                                    const items = catalogFilter === 'meals' ? menuCatalog.catalog.meals : menuCatalog.catalog.desserts
                                    const q = catalogQuery.trim().toLowerCase()
                                    const filtered = q ? items.filter(i => i.name.toLowerCase().includes(q)) : items
                                    if (filtered.length === 0) {
                                        return <p className="muted" style={{ margin: 0 }}>{items.length === 0 ? 'Todavía no hay platos en el catálogo.' : 'No hay platos que coincidan con la búsqueda.'}</p>
                                    }
                                    return (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem', maxHeight: 360, overflowY: 'auto' }}>
                                            {filtered.map(item => (
                                                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem' }}>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>{item.name}</span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                                        <span className="badge badge-gray" title="Veces usado en menús">{item.count}×</span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary btn-sm"
                                                            title="Copiar nombre del plato"
                                                            onClick={() => { navigator.clipboard?.writeText(item.name); success(`"${item.name}" copiado`) }}
                                                        >
                                                            Copiar
                                                        </button>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                })()}
                                <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                                    Solo lectura. Copiá un plato y pegalo en cualquier casilla del menú; al escribir en una casilla también se autocompleta desde este catálogo.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Aviso al editar la semana en curso */}
                    {menuType === 'current' && (
                        <div className="admin-panel" style={{ borderLeft: '4px solid var(--warning-text)', background: 'var(--warning-bg)' }}>
                            <div className="admin-panel-body" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
                                <span style={{ color: 'var(--warning-text)', display: 'flex', flexShrink: 0, marginTop: '0.1rem' }}><Icon name="alert" size={22} /></span>
                                <div>
                                    <strong style={{ color: 'var(--warning-text)' }}>Estás editando la semana EN CURSO</strong>
                                    <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>
                                        Esta es la semana que ya está corriendo. Tené cuidado: quitar o cambiar platos puede afectar reservas ya hechas.
                                        Si querías cargar la <strong>semana próxima</strong>, cambiá arriba a “Próxima Semana”.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Catálogo para autocompletado (platos ya usados en menús previos) */}
                    <datalist id="menu-meals-catalog">
                        {menuCatalog.meals.map(m => <option key={m} value={m} />)}
                    </datalist>
                    <datalist id="menu-desserts-catalog">
                        {menuCatalog.desserts.map(d => <option key={d} value={d} />)}
                    </datalist>

                    {menuData[menuType] ? (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {DAYS.map(day => (
                                <div key={day} className="menu-day-panel">
                                    <div className="menu-day-header">
                                        <Icon name="calendar" size={16} />
                                        <span>{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                                    </div>
                                    <div className="menu-day-body">
                                        <div className="menu-day-col">
                                            <div className="menu-col-label">
                                                <Icon name="utensils" size={15} /> Comidas
                                            </div>
                                            <div className="menu-input-list">
                                                {menuData[menuType]?.days[day]?.meals?.map((m: string, i: number) => (
                                                    <input
                                                        key={i}
                                                        className="input"
                                                        list="menu-meals-catalog"
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
                                                <Icon name="cake" size={15} /> Postres
                                            </div>
                                            <div className="menu-input-list">
                                                {menuData[menuType]?.days[day]?.desserts?.map((d: string, i: number) => (
                                                    <input
                                                        key={i}
                                                        className="input"
                                                        list="menu-desserts-catalog"
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
                            <span style={{ color: 'var(--warning-text)' }}><Icon name="alert" size={40} /></span>
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

                            {/* Resumen general de usuarios */}
                            {usersOverview && (
                                <div className="admin-panel" style={{ marginBottom: '2.5rem' }}>
                                    <div className="admin-panel-header">
                                        <span className="admin-panel-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}><Icon name="users" size={17} /> Resumen de usuarios</span>
                                    </div>
                                    <div className="admin-panel-body">
                                        {/* KPIs compactos */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                                            <ReportStatTile icon={<Icon name="users" />} label="Usuarios totales" value={usersOverview.total} accent="#0284c7" />
                                            <ReportStatTile icon={<Icon name="list" />} label="Con reserva" value={usersOverview.withReservation} accent="#0ea5e9" />
                                            <ReportStatTile icon={<Icon name="star" />} label="Con reseñas" value={usersOverview.withRatings} accent="#9333ea" />
                                            <ReportStatTile icon={<Icon name="check" />} label="Reseñas totales" value={usersOverview.totalRatings} accent="#16a34a" />
                                        </div>
                                        {/* Gráficas */}
                                        <div className="grid-3" style={{ gap: '1.5rem' }}>
                                            <UsersDonut
                                                title="Composición"
                                                subtitle="Por tipo de cuenta"
                                                centerValue={usersOverview.total}
                                                centerLabel="usuarios"
                                                data={[
                                                    { name: 'Funcionarios', value: usersOverview.byRole.user, color: '#0284c7' },
                                                    { name: 'Admins', value: usersOverview.byRole.admin, color: '#9333ea' },
                                                    { name: 'Super admins', value: usersOverview.byRole.superadmin, color: '#16a34a' },
                                                ]}
                                            />
                                            <UsersDonut
                                                title="Verificación de email"
                                                subtitle="Cuentas confirmadas"
                                                centerValue={`${usersOverview.total > 0 ? Math.round((usersOverview.verified / usersOverview.total) * 100) : 0}%`}
                                                centerLabel="verificados"
                                                data={[
                                                    { name: 'Verificados', value: usersOverview.verified, color: '#16a34a' },
                                                    { name: 'Pendientes', value: usersOverview.unverified, color: '#d97706' },
                                                ]}
                                            />
                                            <SatisfactionGauge
                                                value={usersOverview.totalRatings > 0 ? usersOverview.globalSatisfaction : 0}
                                                subtitle={usersOverview.totalRatings > 0 ? `${usersOverview.totalRatings} reseñas en total` : 'Sin reseñas aún'}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Separador: base de usuarios */}
                            <div className="admin-section-header" style={{ marginBottom: '1rem' }}>
                                <div>
                                    <p className="admin-section-title" style={{ fontSize: '1.15rem' }}>Lista de funcionarios</p>
                                    <p className="admin-section-subtitle">{totalItems} usuarios{totalPages > 1 ? ` · página ${page} de ${totalPages}` : ''}</p>
                                </div>
                            </div>

                            {showCreateUser && createPortal(
                                <div className="modal-backdrop animate-fade-in" onClick={() => setShowCreateUser(false)} role="presentation">
                                    <div className="modal animate-slide-up" role="dialog" aria-modal="true" aria-labelledby="create-user-title" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
                                        <div className="modal-header">
                                            <h2 id="create-user-title">Nuevo usuario</h2>
                                            <button
                                                aria-label="Cerrar"
                                                onClick={() => setShowCreateUser(false)}
                                                style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-light)', lineHeight: 1 }}
                                            >×</button>
                                        </div>
                                        <div className="modal-body">
                                            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                                                <AvatarUploader
                                                    ref={avatarRef}
                                                    currentPhotoUrl={newUser.photoUrl}
                                                    onPhotoChange={(url) => setNewUser(prev => ({ ...prev, photoUrl: url }))}
                                                    nameForInitials={newUser.firstName || 'U'}
                                                    size="100px"
                                                />
                                                <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                                    Si no subís foto, se usan las iniciales del nombre.
                                                </p>
                                            </div>
                                            <div className="grid-2" style={{ gap: '1rem' }}>
                                                <Field label="Nombre" required>
                                                    <input className="input" placeholder="Juan" value={newUser.firstName} onChange={e => setNewUser({ ...newUser, firstName: e.target.value })} />
                                                </Field>
                                                <Field label="Apellido" required>
                                                    <input className="input" placeholder="Pérez" value={newUser.lastName} onChange={e => setNewUser({ ...newUser, lastName: e.target.value })} />
                                                </Field>
                                                <Field label="Email" required>
                                                    <input className="input" type="email" placeholder="nombre@empresa.com" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                                                </Field>
                                                <Field label="Contraseña" required>
                                                    <input className="input" type="password" placeholder="Mínimo 6 caracteres" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                                                </Field>
                                                <Field label="Nro de funcionario" required>
                                                    <input className="input" inputMode="numeric" placeholder="Solo números" value={newUser.funcNumber} onChange={e => setNewUser({ ...newUser, funcNumber: e.target.value.replace(/\D/g, '') })} />
                                                </Field>
                                                <Field label="Documento (CI)" required>
                                                    <input className="input" inputMode="numeric" placeholder="Solo números" value={newUser.documentId} onChange={e => setNewUser({ ...newUser, documentId: e.target.value.replace(/\D/g, '') })} />
                                                </Field>
                                                <Field label="Teléfono">
                                                    <input className="input" type="tel" inputMode="tel" placeholder="Opcional" value={newUser.phoneNumber} onChange={e => setNewUser({ ...newUser, phoneNumber: e.target.value.replace(/[^\d+]/g, '') })} />
                                                </Field>
                                                <Field label="Rol">
                                                    <select className="input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}>
                                                        <option value="user">Usuario</option>
                                                        {(currentUser?.role === 'superadmin' || currentUser?.role === 'admin') && <option value="admin">Administrador</option>}
                                                        {currentUser?.role === 'superadmin' && <option value="superadmin">Admin General (Super Admin)</option>}
                                                    </select>
                                                </Field>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.5rem' }}>
                                                <button className="btn btn-secondary" onClick={() => setShowCreateUser(false)}>Cancelar</button>
                                                <button className="btn btn-primary" onClick={handleCreateUser}>Crear usuario</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>,
                                document.body
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

                        {(() => {
                            const isCurrent = selectedWeek === menuData?.current?.weekStart
                            const isNext = selectedWeek === menuData?.next?.weekStart
                            const heroLabel = isCurrent
                                ? 'Semana en curso'
                                : isNext
                                    ? 'Proyección de la semana próxima'
                                    : 'Semana de historial'
                            return (
                                <div className="admin-panel admin-report-hero">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                        <div>
                                            <h3 style={{ margin: 0 }}>Reporte semanal</h3>
                                            <p className="muted" style={{ margin: '0.25rem 0 0' }}>{heroLabel} — semana del {selectedWeek || '—'}</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                                                onClick={() => window.open(`/print?type=full_week&week=${selectedWeek}`, '_blank')}
                                            >
                                                <Icon name="printer" size={16} /> Imprimir reporte completo
                                            </button>
                                            <button
                                                className="btn btn-primary"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                                                onClick={() => navigate('/admin/reports')}
                                            >
                                                <Icon name="activity" size={16} /> Ver gráficos y exportar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
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
                                <span className="admin-panel-title">Resumen de la semana</span>
                                <button
                                    className="btn btn-sm btn-secondary"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                    onClick={() => window.open(`/print?type=weekly&week=${selectedWeek}`, '_blank')}
                                >
                                    <Icon name="printer" size={15} /> Imprimir semanal
                                </button>
                            </div>
                            {(() => {
                                const weeklyMeals: Record<string, number> = {}
                                const weeklyDesserts: Record<string, number> = {}
                                let totalBread = 0
                                DAYS.forEach(day => {
                                    const dayStats = stats[day] || {}
                                    if (Object.keys(dayStats).length > 0) {
                                        const totals = getDailyTotals(dayStats)
                                        Object.entries(totals.meals).forEach(([name, count]) => { weeklyMeals[name] = (weeklyMeals[name] || 0) + count })
                                        Object.entries(totals.desserts).forEach(([name, count]) => { weeklyDesserts[name] = (weeklyDesserts[name] || 0) + count })
                                        totalBread += totals.bread
                                    }
                                })
                                const totalMeals = Object.values(weeklyMeals).reduce((a, b) => a + b, 0)
                                const totalDesserts = Object.values(weeklyDesserts).reduce((a, b) => a + b, 0)
                                return (
                                    <div style={{ padding: '1.25rem' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                                            <ReportStatTile icon={<Icon name="utensils" />} label="Comidas totales" value={totalMeals} accent="#0284c7" />
                                            <ReportStatTile icon={<Icon name="cake" />} label="Postres totales" value={totalDesserts} accent="#9333ea" />
                                            <ReportStatTile icon={<Icon name="bread" />} label="Panes" value={totalBread} accent="#d97706" />
                                        </div>
                                        <div className="grid-2" style={{ gap: '1.5rem' }}>
                                            <ReportBreakdownList title="Comidas" icon={<Icon name="utensils" />} accent="#0284c7" items={Object.entries(weeklyMeals)} />
                                            <ReportBreakdownList title="Postres" icon={<Icon name="cake" />} accent="#9333ea" items={Object.entries(weeklyDesserts)} />
                                        </div>
                                    </div>
                                )
                            })()}
                        </div>

                        {dishRatings && dishRatings.length > 0 && (
                            <div className="admin-panel admin-report-ratings" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                                <div className="admin-panel-header">
                                    <span className="admin-panel-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}><Icon name="star" size={18} /> Satisfacción de platos</span>
                                </div>
                                <div className="admin-panel-body" style={{ padding: '1rem 0' }}>
                                    <div className="grid-2" style={{ gap: '1.5rem' }}>
                                        <div className="card">
                                            <h4 style={{ color: 'var(--rating-liked)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}><Icon name="award" size={18} /> Mejores platos</h4>
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
                                                                    <span className={`badge ${r.positivePercent >= 80 ? 'badge-success' : r.positivePercent >= 50 ? 'badge-warning' : 'badge-error'}`}>
                                                                        {r.positivePercent}%
                                                                    </span>
                                                                </td>
                                                                <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                                    <span style={{ color: 'var(--rating-liked)' }}>👍 {r.liked}</span>
                                                                    <span style={{ color: 'var(--rating-neutral)', margin: '0 0.4rem' }}>😐 {r.neutral}</span>
                                                                    <span style={{ color: 'var(--rating-disliked)' }}>👎 {r.disliked}</span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div className="card">
                                            <h4 style={{ color: 'var(--rating-disliked)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}><Icon name="trendingDown" size={18} /> Más votos negativos</h4>
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
                                                                        <span className="badge badge-error">
                                                                            {negPercent}%
                                                                        </span>
                                                                    </td>
                                                                    <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                                        <span style={{ color: 'var(--rating-liked)' }}>👍 {r.liked}</span>
                                                                        <span style={{ color: 'var(--rating-neutral)', margin: '0 0.4rem' }}>😐 {r.neutral}</span>
                                                                        <span style={{ color: 'var(--rating-disliked)' }}>👎 {r.disliked}</span>
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
                                                <h5 style={{ marginBottom: '0.5rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Icon name="utensils" size={16} /> Comidas</h5>
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
                                                                        <span style={{ color: 'var(--rating-liked)' }}>👍 {r.liked}</span>
                                                                        <span style={{ color: 'var(--rating-neutral)', margin: '0 0.4rem' }}>😐 {r.neutral}</span>
                                                                        <span style={{ color: 'var(--rating-disliked)' }}>👎 {r.disliked}</span>
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
                                                <h5 style={{ marginBottom: '0.5rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Icon name="cake" size={16} /> Postres</h5>
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
                                                                        <span style={{ color: 'var(--rating-liked)' }}>👍 {r.liked}</span>
                                                                        <span style={{ color: 'var(--rating-neutral)', margin: '0 0.4rem' }}>😐 {r.neutral}</span>
                                                                        <span style={{ color: 'var(--rating-disliked)' }}>👎 {r.disliked}</span>
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
                                                <div style={{ marginBottom: '1.5rem' }}>
                                                    <div className="flex-between" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                                        <h4 style={{ color: 'var(--accent)', margin: 0 }}>Resumen de producción (total del día)</h4>
                                                        <button
                                                            className="btn btn-sm btn-secondary"
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                                            onClick={() => {
                                                                const dayIndex = DAYS.indexOf(day);
                                                                const [y, m, d] = selectedWeek.split('-').map(Number);
                                                                const date = new Date(y, m - 1, d + dayIndex);
                                                                const dateStr = date.toISOString().split('T')[0];
                                                                window.open(`/print?type=daily&date=${dateStr}`, '_blank');
                                                            }}
                                                        >
                                                            <Icon name="printer" size={15} /> Imprimir día
                                                        </button>
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                                                        <ReportStatTile icon={<Icon name="utensils" />} label="Comidas" value={Object.values(totals!.meals).reduce((a, b) => a + b, 0)} accent="#0284c7" />
                                                        <ReportStatTile icon={<Icon name="cake" />} label="Postres" value={Object.values(totals!.desserts).reduce((a, b) => a + b, 0)} accent="#9333ea" />
                                                        <ReportStatTile icon={<Icon name="bread" />} label="Panes" value={totals!.bread} accent="#d97706" />
                                                    </div>
                                                    <div className="grid-2" style={{ gap: '1.5rem' }}>
                                                        <ReportBreakdownList title="Comidas" icon={<Icon name="utensils" />} accent="#0284c7" items={Object.entries(totals!.meals)} />
                                                        <ReportBreakdownList title="Postres" icon={<Icon name="cake" />} accent="#9333ea" items={Object.entries(totals!.desserts)} />
                                                    </div>
                                                </div>

                                                <h4 style={{ marginBottom: '1rem' }}>Detalle por horario</h4>
                                                <div className="admin-table-wrap">
                                                    <table className="res-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Horario</th>
                                                                <th>Comidas</th>
                                                                <th>Postres</th>
                                                                <th style={{ textAlign: 'right' }}>Pan</th>
                                                                <th style={{ textAlign: 'right' }}>Acción</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {Object.entries(dayStats).sort().map(([slot, data]: [string, any]) => (
                                                                <tr key={slot}>
                                                                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{slot}</td>
                                                                    <td>
                                                                        {Object.entries(data.meals).map(([name, count]: [string, any]) => (
                                                                            <div key={name}>{name}: <strong>{count}</strong></div>
                                                                        ))}
                                                                    </td>
                                                                    <td>
                                                                        {Object.entries(data.desserts).map(([name, count]: [string, any]) => (
                                                                            <div key={name}>{name}: <strong>{count}</strong></div>
                                                                        ))}
                                                                    </td>
                                                                    <td style={{ textAlign: 'right' }}><strong>{data.bread}</strong></td>
                                                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                                        <button
                                                                            className="btn btn-sm btn-secondary"
                                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                                                            onClick={() => {
                                                                                const dayIndex = DAYS.indexOf(day);
                                                                                const [y, m, d] = selectedWeek.split('-').map(Number);
                                                                                const date = new Date(y, m - 1, d + dayIndex);
                                                                                const dateStr = date.toISOString().split('T')[0];
                                                                                window.open(`/print?type=slot&date=${dateStr}&slot=${slot}`, '_blank');
                                                                            }}
                                                                        >
                                                                            <Icon name="printer" size={14} /> Imprimir
                                                                        </button>
                                                                    </td>
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

            {selectedUserForModal && createPortal(
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

                            {/* Habilitar reserva de la semana en curso (altas a mitad de semana) */}
                            {selectedUserForModal.role === 'user' && (() => {
                                const currentMonday = menuData?.current?.weekStart
                                const enabled = !!currentMonday && selectedUserForModal.reservationOverrideWeek === currentMonday
                                return (
                                    <div style={{ width: '100%', background: enabled ? 'var(--success-bg)' : 'var(--bg)', border: `1px solid ${enabled ? 'var(--success-border)' : 'var(--border)'}`, borderRadius: '0.5rem', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <div>
                                            <strong style={{ fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Icon name="calendar" size={15} /> Reserva de la semana actual</strong>
                                            <p className="muted" style={{ margin: '0.15rem 0 0', fontSize: '0.8rem' }}>
                                                {enabled ? 'Habilitado: puede elegir el menú de la semana en curso.' : 'Para altas a mitad de semana: permitile reservar esta semana fuera del cierre.'}
                                            </p>
                                        </div>
                                        <button
                                            className={`btn btn-sm ${enabled ? 'btn-secondary' : 'btn-primary'}`}
                                            onClick={() => toggleReservationOverride(!enabled)}
                                        >
                                            {enabled ? 'Quitar permiso' : 'Habilitar esta semana'}
                                        </button>
                                    </div>
                                )
                            })()}

                            {/* Perfil de gustos del usuario */}
                            <div style={{ width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                                    <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}><Icon name="star" size={15} /> Opinión sobre los platos</strong>
                                    {userRatings && userRatings.total > 0 && (
                                        <span className={`badge ${userRatings.satisfactionPercent >= 70 ? 'badge-success' : userRatings.satisfactionPercent >= 40 ? 'badge-warning' : 'badge-error'}`}>
                                            {userRatings.satisfactionPercent}% satisfacción
                                        </span>
                                    )}
                                </div>
                                {userRatingsLoading ? (
                                    <Skeleton height="48px" />
                                ) : !userRatings || userRatings.total === 0 ? (
                                    <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>Todavía no calificó ningún plato.</p>
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: '0.5rem', background: 'var(--border)' }}>
                                            <div style={{ width: `${(userRatings.liked / userRatings.total) * 100}%`, background: 'var(--rating-liked)' }} />
                                            <div style={{ width: `${(userRatings.neutral / userRatings.total) * 100}%`, background: 'var(--rating-neutral)' }} />
                                            <div style={{ width: `${(userRatings.disliked / userRatings.total) * 100}%`, background: 'var(--rating-disliked)' }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                                            <span style={{ color: 'var(--rating-liked)', fontWeight: 600 }}>👍 {userRatings.liked}</span>
                                            <span style={{ color: 'var(--rating-neutral)', fontWeight: 600 }}>😐 {userRatings.neutral}</span>
                                            <span style={{ color: 'var(--rating-disliked)', fontWeight: 600 }}>👎 {userRatings.disliked}</span>
                                            <span className="muted">· {userRatings.total} calificaciones</span>
                                        </div>
                                        {userRatings.favorites.length > 0 && (
                                            <div style={{ marginBottom: '0.6rem' }}>
                                                <span className="muted" style={{ fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>Le gustan</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                    {userRatings.favorites.map(f => <span key={`${f.itemType}-${f.itemName}`} className="badge badge-success" style={{ fontSize: '0.72rem' }}>{f.itemName}</span>)}
                                                </div>
                                            </div>
                                        )}
                                        {userRatings.dislikedDishes.length > 0 && (
                                            <div>
                                                <span className="muted" style={{ fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>No le gustan</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                    {userRatings.dislikedDishes.map(f => <span key={`${f.itemType}-${f.itemName}`} className="badge badge-error" style={{ fontSize: '0.72rem' }}>{f.itemName}</span>)}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>{/* end admin-layout */}

        <ConfirmDialog
            state={confirmState}
            onConfirm={() => resolveConfirm(true)}
            onCancel={() => resolveConfirm(false)}
        />
        </Layout>
    )
}


// Campo de formulario con label accesible (envuelve el input → el clic en la
// etiqueta enfoca el control). Marca obligatorios con un asterisco.
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
    return (
        <label style={{ display: 'block' }}>
            <span style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                {label}{required && <span style={{ color: 'var(--error-text)' }}> *</span>}
            </span>
            {children}
        </label>
    )
}

// Dona con leyenda y total al centro (composición de usuarios, verificación…)
function UsersDonut({ title, subtitle, data, centerValue, centerLabel }: {
    title: string; subtitle?: string; centerValue: number | string; centerLabel: string
    data: Array<{ name: string; value: number; color: string }>
}) {
    const filtered = data.filter(d => d.value > 0)
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '0.25rem' }}>
                <h5 style={{ margin: 0, color: 'var(--text)' }}>{title}</h5>
                {subtitle && <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>{subtitle}</p>}
            </div>
            <div style={{ position: 'relative', width: '100%', height: 180 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                            {filtered.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)', fontSize: '0.8rem' }} />
                    </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{centerValue}</span>
                    <span className="muted" style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{centerLabel}</span>
                </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                {filtered.map((d, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-light)' }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} /> {d.name}: <strong style={{ color: 'var(--text)' }}>{d.value}</strong>
                    </span>
                ))}
            </div>
        </div>
    )
}

// Medidor radial de satisfacción general (% positivo).
function SatisfactionGauge({ value, subtitle }: { value: number; subtitle: string }) {
    const color = value >= 70 ? '#16a34a' : value >= 40 ? '#d97706' : '#dc2626'
    const data = [{ name: 'satisfaccion', value }]
    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '0.25rem' }}>
                <h5 style={{ margin: 0, color: 'var(--text)' }}>Satisfacción general</h5>
                <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>{subtitle}</p>
            </div>
            <div style={{ position: 'relative', width: '100%', height: 180, marginTop: 'auto' }}>
                <ResponsiveContainer>
                    <RadialBarChart innerRadius="66%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                        <RadialBar background={{ fill: 'var(--border)' }} dataKey="value" cornerRadius={12} angleAxisId={0} fill={color} />
                    </RadialBarChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color }}>{value}%</span>
                    <span className="muted" style={{ fontSize: '0.7rem' }}>positivo</span>
                </div>
            </div>
        </div>
    )
}

// ─── Subcomponentes de presentación para la pestaña Reportes ─────────────────
function ReportStatTile({ icon, label, value, accent }: { icon: ReactNode; label: string; value: number | string; accent: string }) {
    return (
        <div style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '1.1rem 1.25rem', background: 'var(--bg)', border: '1px solid var(--border)', borderLeft: `4px solid ${accent}`, borderRadius: 'var(--radius)' }}>
            <span style={{ display: 'flex', color: accent, background: `${accent}1a`, padding: '0.55rem', borderRadius: '10px' }}>{icon}</span>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
                <div className="muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>{label}</div>
            </div>
        </div>
    )
}

function ReportBreakdownList({ title, icon, items, accent, sortItems = true }: { title: string; icon: ReactNode; items: Array<[string, number]>; accent: string; sortItems?: boolean }) {
    const sorted = sortItems ? [...items].sort((a, b) => b[1] - a[1]) : items
    const max = sorted.reduce((m, [, c]) => Math.max(m, c), 0) || 1
    const total = sorted.reduce((s, [, c]) => s + c, 0)
    return (
        <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h5 style={{ margin: 0, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}><span>{icon}</span>{title}</h5>
                <span className="muted" style={{ fontSize: '0.8rem' }}>Total <strong style={{ color: 'var(--text)' }}>{total}</strong></span>
            </div>
            {sorted.length === 0 ? (
                <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>Sin datos</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    {sorted.map(([name, count]) => (
                        <div key={name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                                <span style={{ color: 'var(--text)' }}>{name}</span>
                                <strong style={{ color: 'var(--text)' }}>{count}</strong>
                            </div>
                            <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: accent, borderRadius: 4 }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
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
                            placeholder="Teléfono"
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
