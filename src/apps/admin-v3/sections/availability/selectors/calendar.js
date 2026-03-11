export function monthLabel(date) {
    return new Intl.DateTimeFormat('es-EC', {
        month: 'long',
        year: 'numeric',
    }).format(date);
}

export function buildMonthDays(anchorDate) {
    const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);

    const days = [];
    for (let i = 0; i < 42; i += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        days.push(date);
    }
    return days;
}

export function describeDay(slots, readOnly) {
    if (!slots.length) {
        return readOnly
            ? 'No hay slots publicados en este dia.'
            : 'Agrega slots o copia una jornada existente.';
    }

    if (slots.length === 1) {
        return `1 slot publicado. ${readOnly ? 'Lectura desde Google Calendar.' : 'Puedes duplicarlo o ampliarlo.'}`;
    }

    return `${slots.length} slots en el dia. ${readOnly ? 'Referencia en solo lectura.' : 'Listo para copiar o limpiar.'}`;
}
