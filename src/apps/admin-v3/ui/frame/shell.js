import { qs, qsa } from '../../shared/ui/render.js';
import { SECTION_TITLES } from './config.js';

export function showLoginView() {
    const login = qs('#loginScreen');
    const dashboard = qs('#adminDashboard');
    if (login) login.classList.remove('is-hidden');
    if (dashboard) dashboard.classList.add('is-hidden');
}

export function showDashboardView() {
    const login = qs('#loginScreen');
    const dashboard = qs('#adminDashboard');
    if (login) login.classList.add('is-hidden');
    if (dashboard) dashboard.classList.remove('is-hidden');
}

export function showCommandPalette() {
    const palette = qs('#adminCommandPalette');
    if (!(palette instanceof HTMLElement)) return;
    palette.classList.remove('is-hidden');
    palette.setAttribute('aria-hidden', 'false');
    document.body.classList.add('admin-command-open');
}

export function hideCommandPalette() {
    const palette = qs('#adminCommandPalette');
    if (!(palette instanceof HTMLElement)) return;
    palette.classList.add('is-hidden');
    palette.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('admin-command-open');
}

export function setActiveSection(section) {
    qsa('.admin-section').forEach((node) => {
        node.classList.toggle('active', node.id === section);
    });

    qsa('.nav-item[data-section]').forEach((node) => {
        const active = node.dataset.section === section;
        node.classList.toggle('active', active);
        if (active) {
            node.setAttribute('aria-current', 'page');
        } else {
            node.removeAttribute('aria-current');
        }
    });

    qsa('.admin-quick-nav-item[data-section]').forEach((node) => {
        const active = node.dataset.section === section;
        node.classList.toggle('active', active);
        node.setAttribute('aria-pressed', String(active));
    });

    const title = SECTION_TITLES[section] || 'Inicio';
    const pageTitle = qs('#pageTitle');
    if (pageTitle) pageTitle.textContent = title;
}

export function setSidebarState({ open, collapsed }) {
    const sidebar = qs('#adminSidebar');
    const backdrop = qs('#adminSidebarBackdrop');
    const toggle = qs('#adminMenuToggle');

    if (sidebar) sidebar.classList.toggle('is-open', Boolean(open));
    if (backdrop) backdrop.classList.toggle('is-hidden', !open);
    if (toggle) toggle.setAttribute('aria-expanded', String(Boolean(open)));

    document.body.classList.toggle('admin-sidebar-open', Boolean(open));
    document.body.classList.toggle(
        'admin-sidebar-collapsed',
        Boolean(collapsed)
    );

    const collapseBtn = qs('#adminSidebarCollapse');
    if (collapseBtn)
        collapseBtn.setAttribute('aria-pressed', String(Boolean(collapsed)));
}

export function getSectionTitle(section) {
    return SECTION_TITLES[section] || 'Inicio';
}
