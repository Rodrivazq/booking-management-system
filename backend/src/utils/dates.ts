/**
 * Lógica centralizada para cálculo de semanas operativas y zona horaria.
 * Siempre utilizamos America/Montevideo para evitar fallos si el servidor (ej. Railway) corre en UTC.
 */

export const getNowUY = (): Date => {
    // Obtenemos la hora actual en Uruguay
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Montevideo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const mapped = Object.fromEntries(parts.map(p => [p.type, p.value]));
    
    // Creamos un objeto Date local que imita exactamente la hora de Uruguay.
    // OJO: Solo debe usarse con getters locales (getFullYear, getMonth, getHours)
    // NUNCA usar toISOString() sobre esta fecha porque el motor de node la desplazaría de nuevo.
    return new Date(
        Number(mapped.year),
        Number(mapped.month) - 1,
        Number(mapped.day),
        Number(mapped.hour),
        Number(mapped.minute),
        Number(mapped.second)
    );
};

export const toDateStringUY = (d: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const getCurrentMonday = (): string => {
    const today = getNowUY();
    const day = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const isWeekend = day === 0 || day === 6;

    let diffToCurrentMonday = today.getDate() - day + (day === 0 ? -6 : 1);
    
    if (isWeekend) {
        diffToCurrentMonday = today.getDate() + (day === 6 ? 2 : 1);
    }

    const monday = new Date(today);
    monday.setDate(diffToCurrentMonday);
    return toDateStringUY(monday);
};

export const getNextMonday = (): string => {
    const today = getNowUY();
    const day = today.getDay();
    const isWeekend = day === 0 || day === 6;

    let diffToNextMonday = (8 - day) % 7 || 7;

    if (isWeekend) {
        diffToNextMonday = (day === 6 ? 9 : 8); 
    }

    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + diffToNextMonday);
    return toDateStringUY(nextMonday);
};
