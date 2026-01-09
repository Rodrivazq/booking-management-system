import { Reservation } from '../types';

interface WeeklyTotalsReportProps {
    reservations: Reservation[];
    week: string;
}

const DAYS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

export default function WeeklyTotalsReport({ reservations, week }: WeeklyTotalsReportProps) {
    // Calculate totals
    const totals: Record<string, { meals: Record<string, number>, desserts: Record<string, number>, bread: number }> = {};

    DAYS.forEach(day => {
        totals[day] = { meals: {}, desserts: {}, bread: 0 };
    });

    reservations.forEach(r => {
        if (r.week !== week) return;
        r.selections?.forEach(s => {
            if (totals[s.day]) {
                if (s.meal) totals[s.day].meals[s.meal] = (totals[s.day].meals[s.meal] || 0) + 1;
                if (s.dessert) totals[s.day].desserts[s.dessert] = (totals[s.day].desserts[s.dessert] || 0) + 1;
                if (s.bread) totals[s.day].bread++;
            }
        });
    });

    return (
        <div className="print-container">
            <h1>Reporte Semanal de Totales</h1>
            <h3>Semana: {week}</h3>

            <table className="print-table">
                <thead>
                    <tr>
                        <th>Dia</th>
                        <th>Platos</th>
                        <th>Postres</th>
                        <th>Pan</th>
                    </tr>
                </thead>
                <tbody>
                    {DAYS.map(day => (
                        <tr key={day}>
                            <td style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{day}</td>
                            <td>
                                {Object.entries(totals[day].meals).map(([name, count]) => (
                                    <div key={name}>{name}: <strong>{count}</strong></div>
                                ))}
                            </td>
                            <td>
                                {Object.entries(totals[day].desserts).map(([name, count]) => (
                                    <div key={name}>{name}: <strong>{count}</strong></div>
                                ))}
                            </td>
                            <td><strong>{totals[day].bread}</strong></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
