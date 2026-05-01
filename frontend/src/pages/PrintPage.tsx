import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiFetch from '../api';
import { Reservation, User } from '../types';
import WeeklyTotalsReport from '../components/WeeklyTotalsReport';
import DailyDetailReport from '../components/DailyDetailReport';

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

export default function PrintPage() {
    const [searchParams] = useSearchParams();
    const type = searchParams.get('type'); // 'weekly', 'daily', 'slot', 'full_week'
    const week = searchParams.get('week');
    const date = searchParams.get('date');
    const slot = searchParams.get('slot');

    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Fetch ALL reservations for this week (no pagination limit)
            const weekParam = week ? `&week=${encodeURIComponent(week)}` : '';
            const r = await apiFetch<{ reservations: Reservation[] }>(
                `/api/reservations/admin?limit=9999&page=1${weekParam}`
            );
            setReservations(r.reservations ?? []);

            // Fetch ALL users so DailyDetailReport / slot reports have complete data
            const u = await apiFetch<{ users: User[] }>(
                `/api/reservations/admin?type=users&limit=9999&page=1`
            );
            setUsers(u.users ?? []);
        } catch (e) {
            console.error(e);
            alert('Error cargando datos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!loading && reservations.length > 0) {
            // Small delay to ensure render
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [loading, reservations]);

    if (loading) return <div>Cargando datos para imprimir...</div>;

    return (
        <div className="print-page">
            <style>{`
                @media print {
                    @page { margin: 0.5cm; }
                    body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: white !important; color: black !important; font-size: 10px; line-height: 1.1; }
                    * { color: black !important; }
                    .print-container { width: 100%; margin-bottom: 15px; page-break-inside: avoid; }
                    .print-table { width: 100%; border-collapse: collapse; font-size: 10px; color: black; }
                    .print-table th, .print-table td { border: 1px solid #999; padding: 3px 4px; text-align: left; color: black; }
                    .print-table th { background: #eee !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: bold; }
                    h1 { font-size: 13px; margin: 0 0 3px 0; color: black; text-transform: uppercase; }
                    h3 { font-size: 11px; margin: 0 0 8px 0; color: #444; }
                    .print-break { page-break-before: always; }
                    tr { page-break-inside: avoid; }
                    thead { display: table-header-group; }
                    
                    /* Utility to save vertical space */
                    .compact-row td { padding: 2px 4px; }
                    .check-box { width: 10px; height: 10px; border: 1px solid black; }
                }
                /* Screen styles for preview */
                .print-page { padding: 20px; background: white; min-height: 100vh; color: black; }
                .print-page * { color: black; }
                .print-container { margin-bottom: 20px; }
                .print-table { width: 100%; border-collapse: collapse; margin-top: 5px; color: black; font-size: 12px; }
                .print-table th, .print-table td { border: 1px solid #ccc; padding: 6px; color: black; }
                .print-table th { background: #f5f5f5; color: black; }
                .print-break { page-break-before: always; }
                .check-box { width: 14px; height: 14px; border: 1px solid black; }
                h1 { font-size: 18px; margin: 0 0 5px 0; }
                h3 { font-size: 14px; margin: 0 0 10px 0; color: #666; }
            `}</style>

            {
                type === 'weekly' && week && (
                    <WeeklyTotalsReport reservations={reservations} week={week} />
                )
            }

            {
                type === 'daily' && date && (
                    <DailyDetailReport reservations={reservations} users={users} date={date} />
                )
            }

            {
                type === 'slot' && date && slot && (
                    <DailyDetailReport reservations={reservations} users={users} date={date} slot={slot} />
                )
            }

            {
                type === 'full_week' && week && (
                    <div>
                        <WeeklyTotalsReport reservations={reservations} week={week} />

                        {DAYS.map((day, dayIndex) => {
                            // Calculate date for this day
                            const [y, m, d] = week.split('-').map(Number);
                            const dateObj = new Date(y, m - 1, d + dayIndex);
                            const dateStr = dateObj.toISOString().split('T')[0];

                            // Find unique slots for this day
                            const daySlots = Array.from(new Set(
                                reservations
                                    .filter(r => r.week === week && r.selections?.some(s => s.day === day))
                                    .map(r => r.timeSlot)
                            )).sort();

                            if (daySlots.length === 0) return null; // No print break if no data

                            return (
                                <div key={day}>
                                    {/* Only break page between days, not between time slots */}
                                    <div className="print-break"></div>
                                    <DailyDetailReport reservations={reservations} users={users} date={dateStr} />

                                    <div style={{ marginTop: '15px' }}>
                                        {daySlots.map(s => (
                                            <div key={s} style={{ marginBottom: '15px' }}>
                                                <DailyDetailReport reservations={reservations} users={users} date={dateStr} slot={s} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            }

            {!type && <div>Parámetros inválidos</div>}
        </div >
    );
}
