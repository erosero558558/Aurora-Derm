export function renderAvailabilityHeader() {
    return `
        <header class="section-header availability-header">
            <div class="availability-calendar">
                <h3 id="availabilityHeading">Configurar Horarios Disponibles</h3>
                <div class="availability-badges">
                    <span id="availabilitySourceBadge" class="availability-badge">Fuente: Local</span>
                    <span id="availabilityModeBadge" class="availability-badge">Modo: Editable</span>
                    <span id="availabilityTimezoneBadge" class="availability-badge">TZ: -</span>
                </div>
            </div>
            <div class="toolbar-group calendar-header">
                <button type="button" data-action="change-month" data-delta="-1">Prev</button>
                <strong id="calendarMonth"></strong>
                <button type="button" data-action="change-month" data-delta="1">Next</button>
                <button type="button" data-action="availability-today">Hoy</button>
                <button type="button" data-action="availability-prev-with-slots">Anterior con slots</button>
                <button type="button" data-action="availability-next-with-slots">Siguiente con slots</button>
            </div>
        </header>
    `;
}
