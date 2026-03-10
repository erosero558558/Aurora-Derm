export function renderAvailabilityDetailGrid() {
    return `
        <div id="availabilityDetailGrid" class="availability-detail-grid">
            <article class="sony-panel soft">
                <h4 id="selectedDate">-</h4>
                <div id="timeSlotsList" class="time-slots-list"></div>
            </article>

            <article class="sony-panel soft">
                <div id="availabilityQuickSlotPresets" class="slot-presets">
                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:00">09:00</button>
                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="09:30">09:30</button>
                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="10:00">10:00</button>
                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:00">16:00</button>
                    <button type="button" class="slot-preset-btn" data-action="prefill-time-slot" data-time="16:30">16:30</button>
                </div>
                <div id="addSlotForm" class="add-slot-form">
                    <input type="time" id="newSlotTime" />
                    <button type="button" data-action="add-time-slot">Agregar</button>
                </div>
                <div id="availabilityDayActions" class="toolbar-group wrap">
                    <button type="button" data-action="copy-availability-day">Copiar dia</button>
                    <button type="button" data-action="paste-availability-day">Pegar dia</button>
                    <button type="button" data-action="duplicate-availability-day-next">Duplicar +1</button>
                    <button type="button" data-action="duplicate-availability-next-week">Duplicar +7</button>
                    <button type="button" data-action="clear-availability-day">Limpiar dia</button>
                    <button type="button" data-action="clear-availability-week">Limpiar semana</button>
                </div>
                <p id="availabilityDayActionsStatus">Sin acciones pendientes</p>
                <div class="toolbar-group">
                    <button type="button" id="availabilitySaveDraftBtn" data-action="save-availability-draft" disabled>Guardar</button>
                    <button type="button" id="availabilityDiscardDraftBtn" data-action="discard-availability-draft" disabled>Descartar</button>
                </div>
            </article>
        </div>
    `;
}
