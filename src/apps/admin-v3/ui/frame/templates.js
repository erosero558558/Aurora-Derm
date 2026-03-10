import { qs } from '../../shared/ui/render.js';
import { contextActionItem } from './templates/context.js';
import { renderLoginTemplate } from './templates/login.js';
import { renderDashboardTemplate } from './templates/shell.js';

export { contextActionItem };

export function renderV3Frame() {
    const loginScreen = qs('#loginScreen');
    const dashboard = qs('#adminDashboard');

    if (
        !(loginScreen instanceof HTMLElement) ||
        !(dashboard instanceof HTMLElement)
    ) {
        throw new Error('Contenedores admin no encontrados');
    }

    loginScreen.innerHTML = renderLoginTemplate();
    dashboard.innerHTML = renderDashboardTemplate();
}
