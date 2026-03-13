export function renderQueueTableShell() {
    return `
        <ul id="queueNextAdminList" class="sony-list"></ul>

        <div
            id="queueReceptionGuidancePanel"
            class="sony-panel soft queue-reception-guidance"
        >
            <div class="queue-reception-guidance__header">
                <div>
                    <h4>Guia de recepcion</h4>
                    <p id="queueReceptionGuidanceMeta">
                        Sin apoyos activos para recepcion.
                    </p>
                </div>
            </div>
            <ul id="queueReceptionGuidanceList" class="sony-list"></ul>
        </div>

        <div
            id="queueReceptionResolutionsPanel"
            class="sony-panel soft queue-reception-guidance"
        >
            <div class="queue-reception-guidance__header">
                <div>
                    <h4>Resoluciones recientes</h4>
                    <p id="queueRecentResolutionsMeta">
                        Sin cierres asistidos todavia.
                    </p>
                </div>
            </div>
            <ul id="queueRecentResolutionsList" class="sony-list"></ul>
        </div>

        <div class="table-scroll">
            <table class="sony-table queue-admin-table">
                <thead>
                    <tr>
                        <th>Sel</th>
                        <th>Ticket</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th>Consultorio</th>
                        <th>Espera</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody id="queueTableBody"></tbody>
            </table>
        </div>

        <div id="queueActivityPanel" class="sony-panel soft">
            <h4>Actividad</h4>
            <ul id="queueActivityList" class="sony-list"></ul>
        </div>
    `;
}
