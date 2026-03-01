/**
 * Lógica centralizada para cálculo de semanas operativas (Week Shift).
 * 
 * Reglas de negocio:
 * - De Lunes a Viernes: 
 *   - "current" = El lunes de la semana actual.
 *   - "next" = El próximo lunes.
 * - Sábados y Domingos (Week Shift):
 *   - "current" = Pasa a ser el lunes inminente.
 *   - "next" = Pasa a ser el lunes de la semana siguiente a la inminente.
 */

export const getCurrentMonday = (): string => {
    const today = new Date();
    const day = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    const isWeekend = day === 0 || day === 6;

    let diffToCurrentMonday = today.getDate() - day + (day === 0 ? -6 : 1);
    
    // Si es fin de semana, adelantamos "la semana actual" al lunes que viene
    if (isWeekend) {
        // day 6 (Sat): +2 días para llegar al lunes, day 0 (Sun): +1 día
        diffToCurrentMonday = today.getDate() + (day === 6 ? 2 : 1);
    }

    const monday = new Date(today);
    monday.setDate(diffToCurrentMonday);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().slice(0, 10);
};

export const getNextMonday = (): string => {
    const today = new Date();
    const day = today.getDay();

    const isWeekend = day === 0 || day === 6;

    let diffToNextMonday = (8 - day) % 7 || 7;

    // Si es fin de semana, la "próxima semana" se mueve a la semana subsiguiente (+7 días más)
    if (isWeekend) {
        diffToNextMonday = (day === 6 ? 9 : 8); 
        // day 6 + 9 = 15 (next next monday)
        // day 0 + 8 = 8 (next next monday)
    }

    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + diffToNextMonday);
    nextMonday.setHours(0, 0, 0, 0);
    return nextMonday.toISOString().slice(0, 10);
};
