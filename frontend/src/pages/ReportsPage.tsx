import { useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import apiFetch from '../api';
import Layout from '../components/Layout';
import { useAuthStore } from '../hooks/useAuthStore';
import { useSettings } from '../context/SettingsContext';
import WeekPicker from '../components/WeekPicker';

interface ReportStats {
    popularDishes: { name: string; count: number }[];
    dailyStats: { date: string; total: number; withBread: number; withoutBread: number }[];
    userStats: { totalUsers: number; activeUsers: number };
    breadStats: { withBread: number; withoutBread: number };
    timeSlotStats: { time: string; count: number }[];
    detailedReservations: any[];
}

interface WeeklyRatingRow {
    itemName: string;
    itemType: 'meal' | 'dessert';
    day: string;
    liked: number;
    neutral: number;
    disliked: number;
    total: number;
    positivePercent: number;
}

interface GlobalRatingRow {
    itemName: string;
    itemType: 'meal' | 'dessert';
    liked: number;
    neutral: number;
    disliked: number;
    total: number;
    positivePercent: number;
}

// Semantic colors for rating cells (greater contrast in both light and dark modes).
const RATING_COLORS = {
    liked:    { bg: 'rgba(22, 163, 74, 0.15)',  text: '#16a34a' },  // verde
    neutral:  { bg: 'rgba(234, 179, 8, 0.15)',  text: '#a16207' },  // amarillo
    disliked: { bg: 'rgba(220, 38, 38, 0.15)',  text: '#dc2626' },  // rojo
};

const ratingCellStyle = (kind: 'liked' | 'neutral' | 'disliked', value: number): CSSProperties => ({
    textAlign: 'right',
    fontWeight: 700,
    color: value > 0 ? RATING_COLORS[kind].text : 'var(--text-light)',
    background: value > 0 ? RATING_COLORS[kind].bg : 'transparent',
});

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

// ─── Helpers de exportación ──────────────────────────────────────────────────
type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
    if (!m) return [22, 163, 74]; // fallback verde de marca
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

// Mezcla un color hacia el blanco (t entre 0 y 1) para fondos suaves.
function tint([r, g, b]: RGB, t: number): RGB {
    return [
        Math.round(r + (255 - r) * t),
        Math.round(g + (255 - g) * t),
        Math.round(b + (255 - b) * t),
    ];
}

function getMondayStr(date: Date): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function formatWeekRange(weekStr: string): string {
    const [y, m, d] = weekStr.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d + 4);
    const pad = (n: number) => String(n).padStart(2, '0');
    const f = (dt: Date) => `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
    return `${f(start)} al ${f(end)}`;
}

export default function ReportsPage() {
    const { user } = useAuthStore();
    const { settings } = useSettings();
    const navigate = useNavigate();
    const [stats, setStats] = useState<ReportStats | null>(null);
    const [weeklyRatings, setWeeklyRatings] = useState<WeeklyRatingRow[]>([]);
    const [globalRatings, setGlobalRatings] = useState<GlobalRatingRow[]>([]);
    const [ratingsView, setRatingsView] = useState<'week' | 'global'>('week');
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

                const [data, weekly, global] = await Promise.all([
                    apiFetch<ReportStats>(`/api/reports/stats?week=${weekStr}`),
                    apiFetch<WeeklyRatingRow[]>(`/api/ratings/admin?week=${weekStr}`).catch(() => []),
                    apiFetch<GlobalRatingRow[]>(`/api/ratings/admin/global`).catch(() => []),
                ]);
                setStats(data);
                setWeeklyRatings(weekly);
                setGlobalRatings(global);
            } catch (err) {
                console.error('ReportsPage: Error fetching stats', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [user, navigate, selectedDate]);

    const weekStr = getMondayStr(selectedDate);
    const weekRange = formatWeekRange(weekStr);

    const exportExcel = () => {
        if (!stats) return;

        const wb = XLSX.utils.book_new();
        wb.Props = {
            Title: `Reporte de Reservas — ${weekRange}`,
            Author: settings.companyName,
            CreatedDate: new Date(),
        };

        const totalRes = stats.dailyStats.reduce((a, c) => a + c.total, 0);
        const adhesion = stats.userStats.totalUsers > 0
            ? Math.round((stats.userStats.activeUsers / stats.userStats.totalUsers) * 100)
            : 0;

        // ── Hoja 1: Resumen ─────────────────────────────────────────────
        const resumen: (string | number)[][] = [
            [settings.companyName],
            ['Reporte de Reservas y Calificaciones'],
            [`Semana: ${weekRange}`],
            [`Generado: ${new Date().toLocaleString('es-UY')}`],
            [],
            ['Indicador', 'Valor'],
            ['Usuarios totales', stats.userStats.totalUsers],
            ['Usuarios activos (con reserva)', stats.userStats.activeUsers],
            ['Adhesión', `${adhesion}%`],
            ['Reservas de la semana', totalRes],
            ['Promedio diario', Number((totalRes / 5).toFixed(1))],
            ['Platos con pan', stats.breadStats.withBread],
            ['Platos sin pan', stats.breadStats.withoutBread],
        ];
        const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
        wsResumen['!cols'] = [{ wch: 32 }, { wch: 26 }];
        wsResumen['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
        ];
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

        // ── Hoja 2: Detalle completo ────────────────────────────────────
        const detalle = stats.detailedReservations.map(r => ({
            Fecha: r.date,
            Día: r.day,
            Funcionario: r.userName,
            'N° Func.': r.funcNumber,
            Comida: r.meal,
            Postre: r.dessert,
            Pan: r.bread,
            Horario: r.timeSlot,
        }));
        const wsDetalle = XLSX.utils.json_to_sheet(detalle);
        wsDetalle['!cols'] = [{ wch: 12 }, { wch: 11 }, { wch: 26 }, { wch: 10 }, { wch: 24 }, { wch: 20 }, { wch: 6 }, { wch: 9 }];
        XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle Completo');

        // ── Hoja 3: Reservas por día ────────────────────────────────────
        const porDia = stats.dailyStats.map((d: any) => ({
            Fecha: d.date,
            Día: d.dayName || '',
            Total: d.total,
            'Con pan': d.withBread,
            'Sin pan': d.withoutBread,
        }));
        const wsDia = XLSX.utils.json_to_sheet(porDia);
        wsDia['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 9 }, { wch: 9 }];
        XLSX.utils.book_append_sheet(wb, wsDia, 'Reservas por Día');

        // ── Hoja 4: Platos populares ────────────────────────────────────
        const populares = stats.popularDishes.map((d, i) => ({ '#': i + 1, Plato: d.name, Pedidos: d.count }));
        const wsPop = XLSX.utils.json_to_sheet(populares);
        wsPop['!cols'] = [{ wch: 5 }, { wch: 30 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsPop, 'Platos Populares');

        // ── Hoja 5: Turnos ──────────────────────────────────────────────
        const turnos = stats.timeSlotStats.map(t => ({ Horario: t.time, Reservas: t.count }));
        const wsTurnos = XLSX.utils.json_to_sheet(turnos);
        wsTurnos['!cols'] = [{ wch: 12 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, wsTurnos, 'Turnos');

        // ── Hoja 6: Calificaciones de la semana ─────────────────────────
        if (weeklyRatings.length > 0) {
            const cal = weeklyRatings.map(r => ({
                Plato: r.itemName,
                Tipo: r.itemType === 'meal' ? 'Comida' : 'Postre',
                Día: r.day,
                'Me gustó': r.liked,
                Indiferente: r.neutral,
                'No me gustó': r.disliked,
                Total: r.total,
                '% positivo': `${r.positivePercent}%`,
            }));
            const wsCal = XLSX.utils.json_to_sheet(cal);
            wsCal['!cols'] = [{ wch: 26 }, { wch: 9 }, { wch: 11 }, { wch: 10 }, { wch: 11 }, { wch: 12 }, { wch: 7 }, { wch: 11 }];
            XLSX.utils.book_append_sheet(wb, wsCal, 'Calificaciones Semana');
        }

        // ── Hoja 7: Calificaciones global ───────────────────────────────
        if (globalRatings.length > 0) {
            const cal = globalRatings.map(r => ({
                Plato: r.itemName,
                Tipo: r.itemType === 'meal' ? 'Comida' : 'Postre',
                'Me gustó': r.liked,
                Indiferente: r.neutral,
                'No me gustó': r.disliked,
                Total: r.total,
                '% positivo': r.total === 0 ? '—' : `${r.positivePercent}%`,
            }));
            const wsCal = XLSX.utils.json_to_sheet(cal);
            wsCal['!cols'] = [{ wch: 26 }, { wch: 9 }, { wch: 10 }, { wch: 11 }, { wch: 12 }, { wch: 7 }, { wch: 11 }];
            XLSX.utils.book_append_sheet(wb, wsCal, 'Calificaciones Global');
        }

        XLSX.writeFile(wb, `Reporte_${weekStr}.xlsx`);
    };

    const exportPDF = () => {
        if (!stats) return;

        const brand = hexToRgb(settings.primaryColor);
        const brandSoft = tint(brand, 0.85);
        const zebra = tint(brand, 0.94);
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 14;
        const totalRes = stats.dailyStats.reduce((a, c) => a + c.total, 0);
        const adhesion = stats.userStats.totalUsers > 0
            ? Math.round((stats.userStats.activeUsers / stats.userStats.totalUsers) * 100)
            : 0;

        // ── Banda de encabezado de marca ────────────────────────────────
        doc.setFillColor(...brand);
        doc.rect(0, 0, pageW, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(settings.companyName, margin, 13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.text('Reporte de Reservas y Calificaciones', margin, 20);
        doc.setFontSize(8.5);
        doc.text(`Semana ${weekRange}`, pageW - margin, 13, { align: 'right' });
        doc.text(`Generado: ${new Date().toLocaleString('es-UY')}`, pageW - margin, 19, { align: 'right' });

        // ── Tarjetas KPI ────────────────────────────────────────────────
        const kpis = [
            { value: String(stats.userStats.totalUsers), label: 'Usuarios totales' },
            { value: String(stats.userStats.activeUsers), label: 'Usuarios activos' },
            { value: `${adhesion}%`, label: 'Adhesión' },
            { value: String(totalRes), label: 'Reservas semana' },
        ];
        const boxGap = 4;
        const boxW = (pageW - margin * 2 - boxGap * (kpis.length - 1)) / kpis.length;
        const boxY = 37;
        const boxH = 20;
        kpis.forEach((k, i) => {
            const x = margin + i * (boxW + boxGap);
            doc.setFillColor(...brandSoft);
            doc.roundedRect(x, boxY, boxW, boxH, 2.5, 2.5, 'F');
            doc.setTextColor(...brand);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.text(k.value, x + boxW / 2, boxY + 9.5, { align: 'center' });
            doc.setTextColor(90, 90, 90);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text(k.label, x + boxW / 2, boxY + 15.5, { align: 'center' });
        });

        let y = boxY + boxH + 10;

        const sectionTitle = (text: string) => {
            if (y > pageH - 35) { doc.addPage(); y = 22; }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(...brand);
            doc.text(text, margin, y);
            doc.setDrawColor(...brand);
            doc.setLineWidth(0.6);
            doc.line(margin, y + 1.5, margin + 26, y + 1.5);
            y += 6;
        };

        const tableCommon = {
            theme: 'grid' as const,
            headStyles: { fillColor: brand, textColor: [255, 255, 255] as RGB, fontStyle: 'bold' as const, halign: 'left' as const },
            alternateRowStyles: { fillColor: zebra },
            styles: { fontSize: 9, cellPadding: 2.2, lineColor: [228, 228, 228] as RGB, lineWidth: 0.1 },
            margin: { left: margin, right: margin },
        };

        // ── Platos más populares ────────────────────────────────────────
        sectionTitle('Platos más populares');
        autoTable(doc, {
            ...tableCommon,
            startY: y,
            head: [['#', 'Plato', 'Pedidos']],
            body: stats.popularDishes.map((d, i) => [String(i + 1), d.name, d.count]),
            columnStyles: { 0: { halign: 'center', cellWidth: 12 }, 2: { halign: 'right', cellWidth: 28 } },
        });
        y = (doc as any).lastAutoTable.finalY + 9;

        // ── Reservas por día ────────────────────────────────────────────
        sectionTitle('Reservas por día');
        autoTable(doc, {
            ...tableCommon,
            startY: y,
            head: [['Fecha', 'Día', 'Total', 'Con pan', 'Sin pan']],
            body: stats.dailyStats.map((d: any) => [d.date, d.dayName || '', d.total, d.withBread, d.withoutBread]),
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        });
        y = (doc as any).lastAutoTable.finalY + 9;

        // ── Distribución de turnos ──────────────────────────────────────
        if (stats.timeSlotStats.length > 0) {
            sectionTitle('Distribución de turnos');
            autoTable(doc, {
                ...tableCommon,
                startY: y,
                head: [['Horario', 'Reservas']],
                body: stats.timeSlotStats.map(t => [t.time, t.count]),
                columnStyles: { 1: { halign: 'right' } },
            });
            y = (doc as any).lastAutoTable.finalY + 9;
        }

        // ── Calificaciones (semana si hay, si no global) ────────────────
        const useWeekly = weeklyRatings.length > 0;
        const ratingRows = useWeekly ? weeklyRatings : globalRatings;
        if (ratingRows.length > 0) {
            sectionTitle(useWeekly ? 'Calificaciones de la semana' : 'Calificaciones globales');
            const head = useWeekly
                ? [['Plato', 'Tipo', 'Día', 'Me gustó', 'Indif.', 'No gustó', 'Total', '% pos.']]
                : [['Plato', 'Tipo', 'Me gustó', 'Indif.', 'No gustó', 'Total', '% pos.']];
            const body = ratingRows.map((r: any) => {
                const base = [r.itemName, r.itemType === 'meal' ? 'Comida' : 'Postre'];
                const tail = [r.liked, r.neutral, r.disliked, r.total, r.total === 0 ? '—' : `${r.positivePercent}%`];
                return useWeekly ? [...base, r.day, ...tail] : [...base, ...tail];
            });
            const pctCol = useWeekly ? 7 : 6;
            autoTable(doc, {
                ...tableCommon,
                startY: y,
                head,
                body,
                columnStyles: {
                    [pctCol - 4]: { halign: 'right' },
                    [pctCol - 3]: { halign: 'right' },
                    [pctCol - 2]: { halign: 'right' },
                    [pctCol - 1]: { halign: 'right' },
                    [pctCol]: { halign: 'right', fontStyle: 'bold' },
                },
                // Colorea el % positivo: verde/ámbar/rojo según umbral.
                didParseCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === pctCol) {
                        const v = parseInt(String(data.cell.raw), 10);
                        if (!isNaN(v)) {
                            if (v >= 70) data.cell.styles.textColor = [22, 163, 74];
                            else if (v >= 40) data.cell.styles.textColor = [161, 98, 7];
                            else data.cell.styles.textColor = [220, 38, 38];
                        }
                    }
                },
            });
            y = (doc as any).lastAutoTable.finalY + 9;
        }

        // ── Pie de página con numeración en todas las páginas ───────────
        const pages = doc.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
            doc.setPage(i);
            doc.setDrawColor(...tint(brand, 0.6));
            doc.setLineWidth(0.3);
            doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(130, 130, 130);
            doc.text(settings.companyName, margin, pageH - 7);
            doc.text(`Página ${i} de ${pages}`, pageW - margin, pageH - 7, { align: 'right' });
        }

        doc.save(`Reporte_${weekStr}.pdf`);
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
    const adhesion = stats.userStats.totalUsers > 0
        ? Math.round((stats.userStats.activeUsers / stats.userStats.totalUsers) * 100)
        : 0;

    const chartTooltip = {
        cursor: { fill: 'var(--border)' },
        contentStyle: { borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    };

    return (
        <Layout title="Reportes" subtitle="Reservas y calificaciones de la semana seleccionada">
            {/* ── Barra de contexto + acciones ── */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1rem 1.25rem' }}>
                <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-light)', fontWeight: 700 }}>Semana seleccionada</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>{weekRange}</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <WeekPicker selectedDate={selectedDate} onChange={setSelectedDate} />
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <button onClick={exportExcel} className="btn btn-primary" style={{ backgroundColor: '#217346', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            📊 Excel
                        </button>
                        <button onClick={exportPDF} className="btn btn-primary" style={{ backgroundColor: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            📄 PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* ── KPIs ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '2.5rem' }}>
                <KpiCard color="#0284c7" label="Usuarios totales" value={stats.userStats.totalUsers}
                    icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>} />
                <KpiCard color="#16a34a" label="Reservaron esta semana" value={stats.userStats.activeUsers} hint={`${adhesion}% de adhesión`}
                    icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>} />
                <KpiCard color="#d97706" label="Reservas totales" value={totalReservations} hint="comidas pedidas en la semana"
                    icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"></path></svg>} />
                <KpiCard color="#9333ea" label="Promedio por día" value={(totalReservations / 5).toFixed(1)} hint="reservas/día (lun-vie)"
                    icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>} />
            </div>

            {/* ── Sección: actividad de reservas ── */}
            <SectionHeading title="Actividad de reservas" subtitle="Cuántas reservas hubo, cuándo se retiran y qué se pide más" />

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <CardHeader title="Reservas por día" subtitle="Total de cada día, dividido entre menú con y sin pan" />
                <div style={{ width: '100%', height: 360 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.dailyStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                            <XAxis dataKey="date" tick={{ fill: 'var(--text-light)' }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fill: 'var(--text-light)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip {...chartTooltip} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            <Bar dataKey="withBread" name="Con pan" stackId="a" fill="#eab308" radius={[0, 0, 4, 4]} />
                            <Bar dataKey="withoutBread" name="Sin pan" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid-2" style={{ marginBottom: '2.5rem', alignItems: 'stretch' }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <CardHeader title="Horarios de retiro" subtitle="Franjas con mayor demanda" />
                    <div style={{ width: '100%', minHeight: 320, flex: 1 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.timeSlotStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="time" tick={{ fill: 'var(--text-light)' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fill: 'var(--text-light)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip {...chartTooltip} />
                                <Bar dataKey="count" name="Reservas" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={60} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <CardHeader title="Platos más pedidos" subtitle="Top opciones elegidas en las reservas" />
                    <div style={{ width: '100%', minHeight: 320, flex: 1 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.popularDishes} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                                <XAxis type="number" tick={{ fill: 'var(--text-light)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <YAxis dataKey="name" type="category" width={140} tick={{ fill: 'var(--text-light)', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip {...chartTooltip} />
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

            {/* ── Sección: calificaciones ── */}
            <SectionHeading title="Calificaciones del menú" subtitle="Qué tan satisfecha quedó la gente con cada plato" />

            <div className="card" style={{ marginBottom: '2rem' }}>
                <CardHeader
                    title={ratingsView === 'week' ? 'Calificaciones de esta semana' : 'Calificaciones globales'}
                    subtitle={ratingsView === 'week'
                        ? 'Cómo se calificaron los platos servidos en la semana seleccionada'
                        : 'Promedio histórico por plato, sumando todas las semanas'}
                    right={
                        <div className="btn-group" role="tablist" aria-label="Vista de calificaciones">
                            <button type="button" className={`btn btn-sm ${ratingsView === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setRatingsView('week')}>
                                Esta semana
                            </button>
                            <button type="button" className={`btn btn-sm ${ratingsView === 'global' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setRatingsView('global')}>
                                Global (todas)
                            </button>
                        </div>
                    }
                />

                {ratingsView === 'week' ? (
                    <RatingsTable
                        rows={weeklyRatings}
                        showDay
                        emptyText="Todavía no hay calificaciones para esta semana. Se habilitan a partir del día servido."
                    />
                ) : (
                    <RatingsTable
                        rows={globalRatings}
                        showDay={false}
                        emptyText="Todavía no hay calificaciones registradas en el sistema."
                    />
                )}
            </div>
        </Layout>
    );
}

// ─── Subcomponentes de presentación ──────────────────────────────────────────
function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0 0 1rem' }}>
            <span style={{ width: 4, height: 30, background: 'var(--accent)', borderRadius: 4, flexShrink: 0 }} />
            <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text)' }}>{title}</h2>
                {subtitle && <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>{subtitle}</p>}
            </div>
        </div>
    );
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
    return (
        <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
                <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1.15rem' }}>{title}</h3>
                {subtitle && <p className="muted" style={{ margin: 0, fontSize: '0.85rem', marginTop: '0.25rem' }}>{subtitle}</p>}
            </div>
            {right}
        </div>
    );
}

function KpiCard({ color, label, value, hint, icon }: { color: string; label: string; value: string | number; hint?: string; icon: ReactNode }) {
    return (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', borderLeft: `4px solid ${color}` }}>
            <div style={{ background: `${color}1a`, padding: '0.85rem', borderRadius: '12px', color, display: 'flex', flexShrink: 0 }}>{icon}</div>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.15 }}>{value}</div>
                {hint && <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.1rem' }}>{hint}</div>}
            </div>
        </div>
    );
}

type RatingSortKey = 'itemName' | 'itemType' | 'day' | 'liked' | 'neutral' | 'disliked' | 'total' | 'positivePercent';

function RatingsTable({ rows, showDay, emptyText }: { rows: Array<WeeklyRatingRow | GlobalRatingRow>; showDay: boolean; emptyText: string }) {
    // Sin orden seleccionado se respeta el orden del backend. Al tocar una
    // columna se ordena por ella (primer clic mayor→menor, luego invierte).
    const [sortKey, setSortKey] = useState<RatingSortKey | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    if (rows.length === 0) {
        return <p className="muted" style={{ padding: '1rem 0' }}>{emptyText}</p>;
    }

    const handleSort = (col: RatingSortKey) => {
        if (col === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortKey(col); setSortDir('desc'); }
    };

    const sorted = sortKey
        ? [...rows].sort((a, b) => {
            const dir = sortDir === 'asc' ? 1 : -1;
            const av = (a as any)[sortKey];
            const bv = (b as any)[sortKey];
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av ?? '').localeCompare(String(bv ?? ''), 'es') * dir;
        })
        : rows;

    const Th = ({ label, col, align = 'left', titleAttr }: { label: string; col: RatingSortKey; align?: 'left' | 'right'; titleAttr?: string }) => {
        const active = sortKey === col;
        return (
            <th
                onClick={() => handleSort(col)}
                aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                title={titleAttr ? `${titleAttr} — clic para ordenar` : 'Clic para ordenar'}
                style={{ textAlign: align, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
            >
                {label}
                <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: '0.8em' }}>
                    {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
            </th>
        );
    };

    return (
        <div className="admin-table-wrap">
            <table className="res-table">
                <thead>
                    <tr>
                        <Th label="Plato" col="itemName" />
                        <Th label="Tipo" col="itemType" />
                        {showDay && <Th label="Día" col="day" />}
                        <Th label="👍 Me gustó" col="liked" align="right" titleAttr="Me gustó" />
                        <Th label="😐 Indiferente" col="neutral" align="right" titleAttr="Indiferente" />
                        <Th label="👎 No me gustó" col="disliked" align="right" titleAttr="No me gustó" />
                        <Th label="Total" col="total" align="right" />
                        <Th label="% positivo" col="positivePercent" align="right" />
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((r, idx) => {
                        const day = (r as WeeklyRatingRow).day;
                        return (
                            <tr key={`${r.itemType}-${day ?? ''}-${r.itemName}-${idx}`}>
                                <td style={{ color: 'var(--text)' }}>{r.itemName}</td>
                                <td><span className="badge badge-gray">{r.itemType === 'meal' ? 'Comida' : 'Postre'}</span></td>
                                {showDay && <td style={{ textTransform: 'capitalize', color: 'var(--text)' }}>{day}</td>}
                                <td style={ratingCellStyle('liked', r.liked)}>{r.liked}</td>
                                <td style={ratingCellStyle('neutral', r.neutral)}>{r.neutral}</td>
                                <td style={ratingCellStyle('disliked', r.disliked)}>{r.disliked}</td>
                                <td style={{ textAlign: 'right', color: 'var(--text)', fontWeight: 700 }}>{r.total}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                    <span className={`badge ${r.total === 0 ? 'badge-gray' : r.positivePercent >= 70 ? 'badge-success' : r.positivePercent >= 40 ? 'badge-warning' : 'badge-error'}`}>
                                        {r.total === 0 ? '—' : `${r.positivePercent}%`}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
