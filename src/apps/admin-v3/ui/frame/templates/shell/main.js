import { renderAllSections } from '../sections/index.js';
import { renderShellContextStrip } from './context-strip.js';
import { renderShellTopbar } from './topbar.js';

export function renderShellMain() {
    return `
        <main class="admin-main admin-v3-main" id="adminMainContent" tabindex="-1" data-admin-frame="sony_v3">
            ${renderShellTopbar()}
            ${renderShellContextStrip()}
            ${renderAllSections()}
        </main>
    `;
}
