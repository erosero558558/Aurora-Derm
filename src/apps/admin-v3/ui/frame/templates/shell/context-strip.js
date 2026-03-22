export function renderShellContextStrip() {
    return `
        <section class="admin-v3-context-strip" id="adminProductivityStrip">
            <div class="admin-v3-context-copy" data-admin-section-hero>
                <p class="sony-kicker" id="adminSectionEyebrow">Turnero primero</p>
                <h3 id="adminContextTitle">Control room del consultorio</h3>
                <p id="adminContextSummary">Queue, surfaces y release registry visibles desde la primera lectura del admin.</p>
                <div id="adminContextActions" class="sony-context-actions"></div>
            </div>
            <div class="admin-v3-status-rail" data-admin-priority-rail>
                <article class="sony-status-tile">
                    <span>Push</span>
                    <strong id="pushStatusIndicator">Inicializando</strong>
                    <small id="pushStatusMeta">Comprobando permisos del navegador</small>
                </article>
                <article class="sony-status-tile" id="adminSessionTile" data-state="neutral">
                    <span>Sesion</span>
                    <strong id="adminSessionState">No autenticada</strong>
                    <small id="adminSessionMeta">Autenticate para operar el panel</small>
                </article>
                <article class="sony-status-tile">
                    <span>Sincronizacion</span>
                    <strong id="adminRefreshStatus">Datos: sin sincronizar</strong>
                    <small id="adminSyncState">Listo para primera sincronizacion</small>
                </article>
            </div>
        </section>
    `;
}
