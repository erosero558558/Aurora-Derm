import { icon } from '../../../../shared/ui/icons.js';
import { renderSidebarNav } from '../nav.js';

export function renderShellSidebar() {
    return `
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
    `;
}
