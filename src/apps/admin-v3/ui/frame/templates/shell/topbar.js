import { icon } from '../../../../shared/ui/icons.js';
import { renderHeaderThemeSwitcher } from '../login.js';

export function renderShellTopbar() {
    return `
        <header class="admin-v3-topbar">
            <div class="admin-v3-topbar__copy">
                <p class="sony-kicker">Consola de control</p>
                <h2 id="pageTitle">Turnero</h2>
            </div>
            <div class="admin-v3-topbar__actions">
                <button type="button" id="adminMenuToggle" class="admin-v3-topbar__menu" aria-controls="adminSidebar" aria-expanded="false">${icon('menu')}<span>Menu</span></button>
                <button type="button" class="admin-v3-agent-btn" data-action="open-agent-panel">Copiloto</button>
                <button type="button" class="admin-v3-command-btn" data-action="open-command-palette">Acciones</button>
                <button type="button" id="refreshAdminDataBtn" data-action="refresh-admin-data">Actualizar</button>
                ${renderHeaderThemeSwitcher()}
            </div>
        </header>
    `;
}
