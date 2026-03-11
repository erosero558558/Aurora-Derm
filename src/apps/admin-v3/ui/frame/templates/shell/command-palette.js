export function renderShellCommandPalette() {
    return `
        <div id="adminCommandPalette" class="admin-command-palette is-hidden" aria-hidden="true">
            <button type="button" class="admin-command-palette__backdrop" data-action="close-command-palette" aria-label="Cerrar paleta"></button>
            <div class="admin-command-dialog" role="dialog" aria-modal="true" aria-labelledby="adminCommandPaletteTitle">
                <div class="admin-command-dialog__head">
                    <div>
                        <p class="sony-kicker">Acciones rapidas</p>
                        <h3 id="adminCommandPaletteTitle">Ir a una tarea</h3>
                    </div>
                    <button type="button" class="admin-command-dialog__close" data-action="close-command-palette">Cerrar</button>
                </div>
                <div class="admin-command-box">
                    <input id="adminQuickCommand" type="text" placeholder="Ej. agenda, pendientes, horarios, turnero" />
                    <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>
                </div>
                <div class="admin-command-dialog__hints">
                    <span>Ctrl+K abre esta paleta</span>
                    <span>/ enfoca la busqueda de la seccion activa</span>
                </div>
            </div>
        </div>
    `;
}
