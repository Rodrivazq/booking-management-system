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
            const r = await apiFetch<{ reservations: Reservation[], users: User[] }>('/api/reservations/admin');
            setReservations(r.reservations);
            setUsers(r.users);
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
                    body { margin: 0; padding: 0; font-family: sans-serif; }
                    .print-container { width: 100%; }
                    .print-table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    .print-table th, .print-table td { border: 1px solid #ccc; padding: 4px; text-align: left; }
                    .print-table th { background: #eee; }
                    h1 { font-size: 18px; margin-bottom: 5px; }
                    h3 { font-size: 14px; margin-bottom: 10px; color: #666; }
                }
                /* Screen styles for preview */
                .print-page { padding: 20px; background: white; min-height: 100vh; }
                .print-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .print-table th, .print-table td { border: 1px solid #ddd; padding: 8px; }
                .print-table th { background: #f5f5f5; }
                .print-break { page-break-before: always; }
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

                            return (
                                <div key={day}>
                                    <div className="print-break"></div>
                                    <DailyDetailReport reservations={reservations} users={users} date={dateStr} />

                                    {daySlots.map(s => (
                                        <div key={s}>
                                            <div className="print-break"></div>
                                            <DailyDetailReport reservations={reservations} users={users} date={dateStr} slot={s} />
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                )
            }

            {!type && <div>Parametros invalidos</div>}
        </div >
    );
}
