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

export function renderSidebarNav() {
    return `
        ${navItem('dashboard', 'Dashboard', 'dashboard', true)}
        ${navItem('appointments', 'Citas', 'appointments')}
        ${navItem('callbacks', 'Callbacks', 'callbacks')}
        ${navItem('reviews', 'Resenas', 'reviews')}
        ${navItem('availability', 'Disponibilidad', 'availability')}
        ${navItem('queue', 'Turnero Sala', 'queue')}
    `;
}
