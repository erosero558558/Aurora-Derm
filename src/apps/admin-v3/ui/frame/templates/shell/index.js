import { renderShellCommandPalette } from './command-palette.js';
import { renderShellMain } from './main.js';
import { renderShellSidebar } from './sidebar.js';

export function renderDashboardTemplate() {
    return `
        <div class="admin-v3-shell">
            ${renderShellSidebar()}
            ${renderShellMain()}
            ${renderShellCommandPalette()}
        </div>
    `;
}
