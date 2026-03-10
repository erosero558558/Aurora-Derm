import { icon } from '../../../shared/ui/icons.js';
import { renderHeaderThemeSwitcher } from './login.js';
import { renderSidebarNav } from './nav.js';
import { renderAllSections } from './sections/index.js';

export function renderDashboardTemplate() {
    return `
        <div class="admin-v3-shell">
            <aside class="admin-sidebar admin-v3-sidebar" id="adminSidebar" tabindex="-1">
                <header class="sidebar-header">
                    <div class="admin-v3-sidebar__brand">
                        <strong>Piel en Armonia</strong>
                        <small>Admin sony_v3</small>
                    </div>
                    <div class="toolbar-group">
                        <button type="button" id="adminSidebarCollapse" data-action="toggle-sidebar-collapse" aria-pressed="false">${icon('menu')}</button>
                        <button type="button" id="adminMenuClose">Cerrar</button>
                    </div>
                </header>
                <nav class="sidebar-nav" id="adminSidebarNav">
                    ${renderSidebarNav()}
                </nav>
                <footer class="sidebar-footer">
                    <button type="button" class="logout-btn" data-action="logout">${icon('logout')}<span>Cerrar sesion</span></button>
                </footer>
            </aside>
            <button type="button" id="adminSidebarBackdrop" class="admin-sidebar-backdrop is-hidden" aria-hidden="true" tabindex="-1"></button>

            <main class="admin-main admin-v3-main" id="adminMainContent" tabindex="-1" data-admin-frame="sony_v3">
                <header class="admin-v3-topbar">
                    <div class="admin-v3-topbar__copy">
                        <p class="sony-kicker">Sony V3</p>
                        <h2 id="pageTitle">Dashboard</h2>
                    </div>
                    <div class="admin-v3-topbar__actions">
                        <button type="button" id="adminMenuToggle" class="admin-v3-topbar__menu" aria-controls="adminSidebar" aria-expanded="false">${icon('menu')}<span>Menu</span></button>
                        <button type="button" class="admin-v3-command-btn" data-action="open-command-palette">Ctrl+K</button>
                        <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>
                        ${renderHeaderThemeSwitcher()}
                    </div>
                </header>

                <section class="admin-v3-context-strip" id="adminProductivityStrip">
                    <div class="admin-v3-context-copy" data-admin-section-hero>
                        <p class="sony-kicker" id="adminSectionEyebrow">Resumen Diario</p>
                        <h3 id="adminContextTitle">Que requiere atencion ahora</h3>
                        <p id="adminContextSummary">Lee agenda, callbacks y disponibilidad desde un frente claro y sin ruido.</p>
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

                ${renderAllSections()}
            </main>

            <div id="adminCommandPalette" class="admin-command-palette is-hidden" aria-hidden="true">
                <button type="button" class="admin-command-palette__backdrop" data-action="close-command-palette" aria-label="Cerrar paleta"></button>
                <div class="admin-command-dialog" role="dialog" aria-modal="true" aria-labelledby="adminCommandPaletteTitle">
                    <div class="admin-command-dialog__head">
                        <div>
                            <p class="sony-kicker">Command Palette</p>
                            <h3 id="adminCommandPaletteTitle">Accion rapida</h3>
                        </div>
                        <button type="button" class="admin-command-dialog__close" data-action="close-command-palette">Cerrar</button>
                    </div>
                    <div class="admin-command-box">
                        <input id="adminQuickCommand" type="text" placeholder="Ej. callbacks urgentes, citas transferencias, queue riesgo SLA" />
                        <button id="adminRunQuickCommandBtn" data-action="run-admin-command">Ejecutar</button>
                    </div>
                    <div class="admin-command-dialog__hints">
                        <span>Ctrl+K abre esta paleta</span>
                        <span>/ enfoca la busqueda de la seccion activa</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}
