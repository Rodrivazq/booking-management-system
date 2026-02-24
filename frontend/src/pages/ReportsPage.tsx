import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import apiFetch from '../api';
import Layout from '../components/Layout';
import { useAuthStore } from '../hooks/useAuthStore';
import WeekPicker from '../components/WeekPicker';

interface ReportStats {
    popularDishes: { name: string; count: number }[];
    dailyStats: { date: string; total: number; withBread: number; withoutBread: number }[];
    userStats: { totalUsers: number; activeUsers: number };
    breadStats: { withBread: number; withoutBread: number };
    timeSlotStats: { time: string; count: number }[];
    detailedReservations: any[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function ReportsPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [stats, setStats] = useState<ReportStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        if (user && user.role !== 'admin' && user.role !== 'superadmin') {
            navigate('/');
            return;
        }

        const fetchStats = async () => {
            setLoading(true);
            try {
                // Calculate week start (Monday)
                const d = new Date(selectedDate);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                const monday = new Date(d.setDate(diff));
                
                // Use local date string to avoid UTC shifts
                const year = monday.getFullYear();
                const month = String(monday.getMonth() + 1).padStart(2, '0');
                const dd = String(monday.getDate()).padStart(2, '0');
                const weekStr = `${year}-${month}-${dd}`;

                console.log('Fetching stats for week:', weekStr);
                const data = await apiFetch<ReportStats>(`/api/reports/stats?week=${weekStr}`);
                setStats(data);
            } catch (err) {
                console.error('ReportsPage: Error fetching stats', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [user, navigate, selectedDate]);

    const exportExcel = () => {
        if (!stats) return;

        const wb = XLSX.utils.book_new();

        // Sheet 1: Detailed Reservations (New)
        const wsDetailed = XLSX.utils.json_to_sheet(stats.detailedReservations);
        XLSX.utils.book_append_sheet(wb, wsDetailed, "Detalle Completo");

        // Sheet 2: Daily Stats
        const wsDaily = XLSX.utils.json_to_sheet(stats.dailyStats);
        XLSX.utils.book_append_sheet(wb, wsDaily, "Reservas por Dia");

        // Sheet 3: Popular Dishes
        const wsDishes = XLSX.utils.json_to_sheet(stats.popularDishes);
        XLSX.utils.book_append_sheet(wb, wsDishes, "Platos Populares");

        // Sheet 4: Time Slots
        const wsTime = XLSX.utils.json_to_sheet(stats.timeSlotStats);
        XLSX.utils.book_append_sheet(wb, wsTime, "Turnos");

        XLSX.writeFile(wb, "Reporte_Reservas_Completo.xlsx");
    };

    const exportPDF = () => {
        if (!stats) return;

        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Reporte Avanzado de Reservas", 14, 22);

        doc.setFontSize(14);
        doc.text("Resumen General", 14, 32);
        doc.setFontSize(12);
        doc.text(`Total Usuarios: ${stats.userStats.totalUsers}`, 14, 40);
        doc.text(`Usuarios Activos: ${stats.userStats.activeUsers}`, 14, 48);
        doc.text(`Total Platos con Pan: ${stats.breadStats.withBread}`, 14, 56);
        doc.text(`Total Platos sin Pan: ${stats.breadStats.withoutBread}`, 14, 64);

        doc.setFontSize(14);
        doc.text("Platos Más Populares", 14, 76);

        const dishesData = stats.popularDishes.map(d => [d.name, d.count]);
        autoTable(doc, {
            startY: 80,
            head: [['Plato', 'Cantidad']],
            body: dishesData,
        });

        const finalY = (doc as any).lastAutoTable.finalY || 100;

        doc.setFontSize(14);
        doc.text("Reservas por Día", 14, finalY + 15);

        const dailyData = stats.dailyStats.map(d => [d.date, d.total, d.withBread, d.withoutBread]);
        autoTable(doc, {
            startY: finalY + 20,
            head: [['Fecha', 'Total', 'Con Pan', 'Sin Pan']],
            body: dailyData,
        });

        doc.save("Reporte_Reservas.pdf");
    };

    if (loading) return <Layout title="Cargando reportes..."><div className="skeleton" style={{ height: '400px' }}></div></Layout>;
    if (!stats) return <Layout title="Error"><p>No se pudieron cargar los reportes.</p></Layout>;

    // Check if backend is returning the new data structure
    if (!stats.breadStats || !stats.timeSlotStats) {
        return (
            <Layout title="Actualización Requerida">
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔄</div>
                    <h3>Reinicio del Servidor Necesario</h3>
                    <p>Se han aplicado actualizaciones importantes al sistema de reportes.</p>
                    <p style={{ marginTop: '1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                        Por favor, reinicia el servidor backend (npm run dev) para ver los cambios.
                    </p>
                </div>
            </Layout>
        );
    }

    const totalReservations = stats.dailyStats.reduce((acc, curr) => acc + curr.total, 0);

    return (
        <Layout title="Reportes Avanzados" subtitle="Análisis detallado de reservas y preferencias">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <WeekPicker selectedDate={selectedDate} onChange={setSelectedDate} />
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={exportExcel} className="btn btn-primary" style={{ backgroundColor: '#217346', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📊 Excel Completo
                    </button>
                    <button onClick={exportPDF} className="btn btn-primary" style={{ backgroundColor: '#F40F02', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📄 PDF Resumen
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid-4" style={{ marginBottom: '2rem' }}>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', padding: '1.5rem', borderLeft: '4px solid #0284c7', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ background: 'rgba(2, 132, 199, 0.1)', padding: '1rem', borderRadius: '12px', color: '#0284c7' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Usuarios Totales</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text)' }}>{stats.userStats.totalUsers}</div>
                    </div>
                </div>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', padding: '1.5rem', borderLeft: '4px solid #16a34a', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ background: 'rgba(22, 163, 74, 0.1)', padding: '1rem', borderRadius: '12px', color: '#16a34a' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Adhesión Activa</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text)' }}>{stats.userStats.activeUsers}</div>
                    </div>
                </div>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', padding: '1.5rem', borderLeft: '4px solid #d97706', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ background: 'rgba(217, 119, 6, 0.1)', padding: '1rem', borderRadius: '12px', color: '#d97706' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"></path></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Volumen de Reservas</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text)' }}>{totalReservations}</div>
                    </div>
                </div>
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', padding: '1.5rem', borderLeft: '4px solid #9333ea', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                    <div style={{ background: 'rgba(147, 51, 234, 0.1)', padding: '1rem', borderRadius: '12px', color: '#9333ea' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Promedio Diario</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text)' }}>{(totalReservations / 5).toFixed(1)}</div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--accent)', fontSize: '1.4rem' }}>Fluidez de Reservas Diarias</h3>
                        <p className="muted" style={{ margin: 0, fontSize: '0.9rem', marginTop: '0.25rem' }}>Comparativa de pedidos con y sin panificados a lo largo de la semana</p>
                    </div>
                </div>
                <div style={{ width: '100%', height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.dailyStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                            <Tooltip 
                                cursor={{ fill: 'var(--bg-hover)' }}
                                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar dataKey="withBread" name="Menú c/ Pan" stackId="a" fill="#eab308" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="withoutBread" name="Menú s/ Pan" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid-2" style={{ marginBottom: '2rem', alignItems: 'stretch' }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, color: 'var(--accent)', fontSize: '1.2rem' }}>Distribución de Turnos</h3>
                        <p className="muted" style={{ margin: 0, fontSize: '0.85rem', marginTop: '0.25rem' }}>Horarios de retiro con mayor demanda</p>
                    </div>
                    <div style={{ width: '100%', minHeight: 350, flex: 1 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.timeSlotStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    cursor={{ fill: 'var(--bg-hover)' }}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Bar dataKey="count" name="Reservas" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, color: 'var(--accent)', fontSize: '1.2rem' }}>Top Platos Estrella</h3>
                        <p className="muted" style={{ margin: 0, fontSize: '0.85rem', marginTop: '0.25rem' }}>Opciones gastronómicas más populares</p>
                    </div>
                    <div style={{ width: '100%', minHeight: 350, flex: 1 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.popularDishes} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                                <XAxis type="number" tick={{ fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                                <YAxis dataKey="name" type="category" width={140} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    cursor={{ fill: 'var(--bg-hover)' }}
                                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}
                                />
                                <Bar dataKey="count" name="Pedidos" radius={[0, 4, 4, 0]} maxBarSize={40}>
                                    {stats.popularDishes.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
