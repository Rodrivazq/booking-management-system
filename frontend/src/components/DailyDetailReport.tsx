import { Reservation, User } from '../types';

interface DailyDetailReportProps {
    reservations: Reservation[];
    users: User[];
    date: string; // YYYY-MM-DD
    slot?: string; // Optional filter by slot
}

export default function DailyDetailReport({ reservations, users, date, slot }: DailyDetailReportProps) {
    // Determine day name from date
    const dateObj = new Date(date + 'T12:00:00'); // Avoid timezone issues
    const dayIndex = dateObj.getDay(); // 0=Sun, 1=Mon...
    const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const dayName = dayNames[dayIndex];

    // Filter reservations
    const filtered = reservations.filter(r => {
        // Check if reservation covers this week
        // Ideally we check r.weekStart, but here we assume 'reservations' passed in are relevant
        // We need to check if they have a selection for this day
        const selection = r.selections?.find(s => s.day === dayName);
        if (!selection) return false;

        if (slot && r.timeSlot !== slot) return false;

        return true;
    }).map(r => {
        const selection = r.selections?.find(s => s.day === dayName);
        const user = users.find(u => u.id === r.userId);
        return {
            ...r,
            user,
            selection
        };
    });

    // Sort by time slot then name
    filtered.sort((a, b) => {
        if (a.timeSlot !== b.timeSlot) return a.timeSlot.localeCompare(b.timeSlot);
        return (a.name || '').localeCompare(b.name || '');
    });

    // If slot is provided, render the detailed list (Checklist for service)
    if (slot) {
        return (
            <div className="print-container">
                <h1>Reporte de Turno ({slot})</h1>
                <h3>Fecha: {date} ({dayName})</h3>

                <table className="print-table">
                    <thead>
                        <tr>
                            <th>Funcionario</th>
                            <th>Nombre</th>
                            <th>Menu</th>
                            <th>Postre</th>
                            <th>Pan</th>
                            <th>Check</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((item) => (
                            <tr key={item.id}>
                                <td>{item.funcNumber || item.user?.funcNumber || '-'}</td>
                                <td>{item.name}</td>
                                <td>{item.selection?.meal}</td>
                                <td>{item.selection?.dessert}</td>
                                <td>{item.selection?.bread ? 'SI' : 'NO'}</td>
                                <td><div style={{ width: '20px', height: '20px', border: '1px solid black' }}></div></td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center' }}>No hay reservas para este turno.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        );
    }

    // If no slot is provided, render the Daily Summary (Comanda for Kitchen)
    // Group by time slot
    const slots: Record<string, { meals: Record<string, number>, desserts: Record<string, number>, bread: number }> = {};

    filtered.forEach(item => {
        if (!slots[item.timeSlot]) {
            slots[item.timeSlot] = { meals: {}, desserts: {}, bread: 0 };
        }
        const s = slots[item.timeSlot];
        if (item.selection?.meal) s.meals[item.selection.meal] = (s.meals[item.selection.meal] || 0) + 1;
        if (item.selection?.dessert) s.desserts[item.selection.dessert] = (s.desserts[item.selection.dessert] || 0) + 1;
        if (item.selection?.bread) s.bread++;
    });

    return (
        <div className="print-container">
            <h1>Reporte de Produccion Diario (Comanda)</h1>
            <h3>Fecha: {date} ({dayName})</h3>

            <table className="print-table">
                <thead>
                    <tr>
                        <th>Horario</th>
                        <th>Platos a Cocinar</th>
                        <th>Postres a Preparar</th>
                        <th>Total Pan</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(slots).sort().map(([timeSlot, data]) => (
                        <tr key={timeSlot}>
                            <td style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{timeSlot}</td>
                            <td>
                                {Object.entries(data.meals).map(([name, count]) => (
                                    <div key={name} style={{ marginBottom: '4px' }}>{name}: <strong>{count}</strong></div>
                                ))}
                            </td>
                            <td>
                                {Object.entries(data.desserts).map(([name, count]) => (
                                    <div key={name} style={{ marginBottom: '4px' }}>{name}: <strong>{count}</strong></div>
                                ))}
                            </td>
                            <td style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{data.bread}</td>
                        </tr>
                    ))}
                    {Object.keys(slots).length === 0 && (
                        <tr>
                            <td colSpan={4} style={{ textAlign: 'center' }}>No hay reservas para este dia.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
