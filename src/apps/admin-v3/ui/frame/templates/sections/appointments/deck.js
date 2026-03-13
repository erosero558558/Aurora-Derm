export function renderAppointmentsCommandDeck() {
    return `
        <article class="sony-panel appointments-command-deck">
            <header class="section-header appointments-command-head">
                <div>
                    <p class="sony-kicker">Agenda clinica</p>
                    <h3>Citas</h3>
                    <p id="appointmentsDeckSummary">Sin citas cargadas.</p>
                </div>
                <span class="appointments-deck-chip" id="appointmentsDeckChip">Agenda estable</span>
            </header>
            <div class="appointments-ops-grid">
                <article class="appointments-ops-card tone-warning">
                    <span>Transferencias</span>
                    <strong id="appointmentsOpsPendingTransfer">0</strong>
                    <small id="appointmentsOpsPendingTransferMeta">Nada por validar</small>
                </article>
                <article class="appointments-ops-card tone-neutral">
                    <span>Proximas 48h</span>
                    <strong id="appointmentsOpsUpcomingCount">0</strong>
                    <small id="appointmentsOpsUpcomingMeta">Sin presion inmediata</small>
                </article>
                <article class="appointments-ops-card tone-danger">
                    <span>No show</span>
                    <strong id="appointmentsOpsNoShowCount">0</strong>
                    <small id="appointmentsOpsNoShowMeta">Sin incidencias</small>
                </article>
                <article class="appointments-ops-card tone-success">
                    <span>Hoy</span>
                    <strong id="appointmentsOpsTodayCount">0</strong>
                    <small id="appointmentsOpsTodayMeta">Carga diaria limpia</small>
                </article>
            </div>
            <div class="appointments-command-actions">
                <button type="button" data-action="context-open-appointments-transfer">Priorizar transferencias</button>
                <button type="button" data-action="context-open-callbacks-pending">Cruzar callbacks</button>
                <button type="button" id="appointmentsExportBtn" data-action="export-csv">Exportar CSV</button>
            </div>
        </article>
    `;
}

export function renderAppointmentsFocusPanel() {
    return `
        <article class="sony-panel appointments-focus-panel">
            <header class="section-header">
                <div>
                    <p class="sony-kicker" id="appointmentsFocusLabel">Sin foco activo</p>
                    <h3 id="appointmentsFocusPatient">Sin citas activas</h3>
                    <p id="appointmentsFocusMeta">Cuando entren citas accionables apareceran aqui.</p>
                </div>
            </header>
            <div class="appointments-focus-grid">
                <div class="appointments-focus-stat">
                    <span>Siguiente ventana</span>
                    <strong id="appointmentsFocusWindow">-</strong>
                </div>
                <div class="appointments-focus-stat">
                    <span>Pago</span>
                    <strong id="appointmentsFocusPayment">-</strong>
                </div>
                <div class="appointments-focus-stat">
                    <span>Estado</span>
                    <strong id="appointmentsFocusStatus">-</strong>
                </div>
                <div class="appointments-focus-stat">
                    <span>Contacto</span>
                    <strong id="appointmentsFocusContact">-</strong>
                </div>
            </div>
            <div id="appointmentsFocusTags" class="appointments-focus-tags"></div>
            <p id="appointmentsFocusHint" class="appointments-focus-hint">Sin bloqueos operativos.</p>
            <div id="appointmentsQueueReview" class="appointments-review-context is-hidden"></div>
        </article>
    `;
}
