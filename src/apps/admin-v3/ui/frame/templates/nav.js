import { icon } from '../../../shared/ui/icons.js';

function navItem(section, label, iconName, isActive = false) {
    return `
        <a
            href="#${section}"
            class="nav-item${isActive ? ' active' : ''}"
            data-section="${section}"
            ${isActive ? 'aria-current="page"' : ''}
        >
            ${icon(iconName)}
            <span>${label}</span>
            <span class="badge" id="${section}Badge">0</span>
        </a>
    `;
}

function navGroupLabel(label) {
    return `<p class="admin-nav-group__label">${label}</p>`;
}

export function renderSidebarNav() {
    return `
        <div class="admin-nav-group" id="adminPrimaryNav">
            ${navGroupLabel('Flujo diario')}
            ${navItem('dashboard', 'Inicio', 'dashboard', true)}
            ${navItem('appointments', 'Agenda', 'appointments')}
            ${navItem('callbacks', 'Pendientes', 'callbacks')}
            ${navItem('availability', 'Horarios', 'availability')}
        </div>
        <div class="admin-nav-group admin-nav-group-secondary" id="adminSecondaryNav">
            ${navGroupLabel('Mas herramientas')}
            ${navItem('reviews', 'Resenas', 'reviews')}
            ${navItem('queue', 'Turnero avanzado', 'queue')}
        </div>
    `;
}
