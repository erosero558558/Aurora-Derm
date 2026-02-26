import { checkAuth, login, login2FA, logout } from './modules/auth.js';
import { refreshData, getLocalData } from './modules/data.js';
import { showToast } from './modules/ui.js';
import {
    setCsrfToken,
    currentAppointments,
    currentCallbacks,
    currentReviews,
    currentAvailability,
} from './modules/state.js';
import { apiRequest } from './modules/api.js';
import { loadDashboardData } from './modules/dashboard.js';
import {
    loadCallbacks,
    filterCallbacks,
    markContacted,
} from './modules/callbacks.js';
import { loadReviews } from './modules/reviews.js';
import { initPushNotifications } from './modules/push.js';
import { initAdminThemeMode, setAdminThemeMode } from './modules/theme.js';
import {
    loadAppointments,
    filterAppointments,
    searchAppointments,
    resetAppointmentFilters,
    initAppointmentsToolbarPreferences,
    setAppointmentSort,
    setAppointmentDensity,
    exportAppointmentsCSV,
    approveTransfer,
    rejectTransfer,
    cancelAppointment,
    markNoShow,
} from './modules/appointments.js';
import {
    initAvailabilityCalendar,
    changeMonth,
    jumpAvailabilityToToday,
    addTimeSlot,
    prefillTimeSlot,
    removeTimeSlot,
    copyAvailabilityDay,
    pasteAvailabilityDay,
    duplicateAvailabilityDayToNext,
    clearAvailabilityDay,
} from './modules/availability.js';

const ADMIN_NAV_COMPACT_BREAKPOINT = 1024;
const ADMIN_SECTION_SHORTCUTS = new Map([
    ['digit1', 'dashboard'],
    ['digit2', 'appointments'],
    ['digit3', 'callbacks'],
    ['digit4', 'reviews'],
    ['digit5', 'availability'],
    ['1', 'dashboard'],
    ['2', 'appointments'],
    ['3', 'callbacks'],
    ['4', 'reviews'],
    ['5', 'availability'],
]);
const SIDEBAR_FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

function getNavItems() {
    return Array.from(
        document.querySelectorAll(
            '.nav-item[data-section], .admin-quick-nav-item[data-section]'
        )
    );
}

function getSectionFromHash() {
    const hashSection = window.location.hash.replace(/^#/, '').trim();
    const sections = new Set(getNavItems().map((item) => item.dataset.section));
    return sections.has(hashSection) ? hashSection : 'dashboard';
}

function getActiveSection() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section ||
        getSectionFromHash() ||
        'dashboard'
    );
}

function isCompactAdminViewport() {
    return window.innerWidth <= ADMIN_NAV_COMPACT_BREAKPOINT;
}

function isSidebarOpen() {
    return Boolean(
        document.getElementById('adminSidebar')?.classList.contains('is-open')
    );
}

function setNavActive(section) {
    getNavItems().forEach((item) => {
        const isActive = item.dataset.section === section;
        item.classList.toggle('active', isActive);
        if (isActive) {
            item.setAttribute('aria-current', 'page');
        } else {
            item.removeAttribute('aria-current');
        }
        if (item instanceof HTMLButtonElement) {
            item.setAttribute('aria-pressed', String(isActive));
        }
    });
}

function isTypingContextTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return Boolean(
        target.closest('input, textarea, select, [contenteditable="true"]')
    );
}

function syncHash(section) {
    const nextHash = `#${section}`;
    if (window.location.hash === nextHash) return;
    if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', nextHash);
        return;
    }
    window.location.hash = nextHash;
}

function getSidebarShellElements() {
    return {
        sidebar: document.getElementById('adminSidebar'),
        backdrop: document.getElementById('adminSidebarBackdrop'),
        toggleBtn: document.getElementById('adminMenuToggle'),
    };
}

function getSidebarFocusableElements() {
    const sidebar = document.getElementById('adminSidebar');
    if (!sidebar) return [];

    return Array.from(
        sidebar.querySelectorAll(SIDEBAR_FOCUSABLE_SELECTOR)
    ).filter(
        (element) =>
            element instanceof HTMLElement &&
            !element.hasAttribute('disabled') &&
            !element.hasAttribute('aria-hidden')
    );
}

function syncSidebarOverlayA11yState(isOpen) {
    const sidebar = document.getElementById('adminSidebar');
    const mainContent = document.getElementById('adminMainContent');
    const compactViewport = isCompactAdminViewport();
    const overlayOpen = Boolean(compactViewport && isOpen);

    if (sidebar) {
        sidebar.setAttribute(
            'aria-hidden',
            String(!overlayOpen && compactViewport)
        );
    }

    if (mainContent) {
        if (overlayOpen) {
            mainContent.setAttribute('aria-hidden', 'true');
        } else {
            mainContent.removeAttribute('aria-hidden');
        }
    }
}

function focusSidebarPrimaryTarget() {
    const sidebar = document.getElementById('adminSidebar');
    if (!sidebar) return;

    const activeNavItem = sidebar.querySelector('.nav-item.active');
    if (activeNavItem instanceof HTMLElement) {
        activeNavItem.scrollIntoView({ block: 'nearest' });
        activeNavItem.focus();
        return;
    }

    const focusableElements = getSidebarFocusableElements();
    if (focusableElements[0] instanceof HTMLElement) {
        focusableElements[0].focus();
        return;
    }

    sidebar.focus();
}

function trapSidebarFocus(event) {
    if (event.key !== 'Tab') return;
    if (!isCompactAdminViewport() || !isSidebarOpen()) return;

    const sidebar = document.getElementById('adminSidebar');
    if (!sidebar) return;

    const focusableElements = getSidebarFocusableElements();
    if (focusableElements.length === 0) {
        event.preventDefault();
        sidebar.focus();
        return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;
    const isFocusInsideSidebar =
        activeElement instanceof HTMLElement && sidebar.contains(activeElement);

    if (!isFocusInsideSidebar) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
        return;
    }

    if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
    }
}

function setSidebarOpen(isOpen) {
    const { sidebar, backdrop, toggleBtn } = getSidebarShellElements();
    if (!sidebar || !backdrop || !toggleBtn) return;

    const shouldOpen = Boolean(isOpen && isCompactAdminViewport());
    sidebar.classList.toggle('is-open', shouldOpen);
    backdrop.classList.toggle('is-hidden', !shouldOpen);
    backdrop.setAttribute('aria-hidden', String(!shouldOpen));
    document.body.classList.toggle('admin-sidebar-open', shouldOpen);
    toggleBtn.setAttribute('aria-expanded', String(shouldOpen));
    syncSidebarOverlayA11yState(shouldOpen);

    if (shouldOpen) {
        focusSidebarPrimaryTarget();
    }
}

function closeSidebar({ restoreFocus = false } = {}) {
    const { toggleBtn } = getSidebarShellElements();
    const wasOpen = document
        .getElementById('adminSidebar')
        ?.classList.contains('is-open');
    setSidebarOpen(false);
    if (restoreFocus && wasOpen && toggleBtn) {
        toggleBtn.focus();
    }
}

function handleAdminKeyboardShortcuts(event) {
    if (!event.altKey || !event.shiftKey) return;
    if (isTypingContextTarget(event.target)) return;

    const dashboard = document.getElementById('adminDashboard');
    if (!dashboard || dashboard.classList.contains('is-hidden')) return;

    const key = String(event.key || '').toLowerCase();
    const code = String(event.code || '').toLowerCase();
    if (key === 'm' || code === 'keym') {
        event.preventDefault();
        setSidebarOpen(!isSidebarOpen());
        return;
    }

    const targetSection =
        ADMIN_SECTION_SHORTCUTS.get(code) || ADMIN_SECTION_SHORTCUTS.get(key);
    if (!targetSection) return;

    event.preventDefault();
    void navigateToSection(targetSection);
}

function focusSection(section, { preventScroll = true } = {}) {
    const sectionEl = document.getElementById(section);
    if (!sectionEl) return;
    if (!sectionEl.hasAttribute('tabindex')) {
        sectionEl.setAttribute('tabindex', '-1');
    }
    window.requestAnimationFrame(() => {
        if (typeof sectionEl.focus === 'function') {
            sectionEl.focus({ preventScroll });
        }
    });
}

async function navigateToSection(section, options = {}) {
    const {
        refresh = true,
        updateHash = true,
        focus = true,
        closeMobileNav = true,
    } = options;
    const targetSection = section || 'dashboard';

    setNavActive(targetSection);

    if (closeMobileNav) {
        closeSidebar();
    }

    if (refresh) {
        try {
            await refreshData();
        } catch (error) {
            showToast(
                `No se pudo actualizar datos en vivo: ${error?.message || 'error desconocido'}`,
                'warning'
            );
        }
    }

    await renderSection(targetSection);

    if (updateHash) {
        syncHash(targetSection);
    }

    if (focus) {
        focusSection(targetSection);
    }
}

/**
 * Renders the specified section of the admin dashboard.
 * Loads the necessary data and updates the UI.
 *
 * @param {string} section - The section ID to render (e.g., 'dashboard', 'appointments').
 */
async function renderSection(section) {
    const titles = {
        dashboard: 'Dashboard',
        appointments: 'Citas',
        callbacks: 'Callbacks',
        reviews: 'Resenas',
        availability: 'Disponibilidad',
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[section] || 'Dashboard';

    document
        .querySelectorAll('.admin-section')
        .forEach((s) => s.classList.remove('active'));
    const sectionEl = document.getElementById(section);
    if (sectionEl) sectionEl.classList.add('active');

    switch (section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'appointments': {
            loadAppointments();
            break;
        }
        case 'callbacks':
            loadCallbacks();
            break;
        case 'reviews':
            loadReviews();
            break;
        case 'availability': {
            await initAvailabilityCalendar();
            break;
        }
        default:
            loadDashboardData();
            break;
    }
}

/**
 * Shows the login screen and hides the dashboard.
 */
function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    closeSidebar();
    if (loginScreen) loginScreen.classList.remove('is-hidden');
    if (dashboard) dashboard.classList.add('is-hidden');
}

/**
 * Shows the dashboard and hides the login screen.
 * Initializes data loading and push notifications.
 */
async function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.classList.add('is-hidden');
    if (dashboard) dashboard.classList.remove('is-hidden');
    setNavActive(getSectionFromHash());
    closeSidebar();
    await updateDate();
    await initPushNotifications();
}

/**
 * Handles the login form submission.
 * Supports standard password login and 2FA.
 *
 * @param {Event} event - The form submission event.
 */
async function handleLogin(event) {
    event.preventDefault();

    const group2FA = document.getElementById('group2FA');
    const is2FAMode = group2FA && !group2FA.classList.contains('is-hidden');

    if (is2FAMode) {
        const code = document.getElementById('admin2FACode')?.value || '';
        try {
            const result = await login2FA(code);
            if (result.csrfToken) setCsrfToken(result.csrfToken);
            showToast('Bienvenido al panel de administracion', 'success');
            await showDashboard();
        } catch {
            showToast('Codigo incorrecto o sesion expirada', 'error');
        }
        return;
    }

    const password = document.getElementById('adminPassword')?.value || '';
    try {
        const loginResult = await login(password);

        if (loginResult.twoFactorRequired) {
            document
                .getElementById('passwordGroup')
                ?.classList.add('is-hidden');
            group2FA?.classList.remove('is-hidden');
            document.getElementById('admin2FACode')?.focus();
            const btn = document.getElementById('loginBtn');
            if (btn) btn.innerHTML = '<i class="fas fa-check"></i> Verificar';
            showToast('Ingresa tu codigo 2FA', 'info');
            return;
        }

        if (loginResult.csrfToken) setCsrfToken(loginResult.csrfToken);
        showToast('Bienvenido al panel de administracion', 'success');
        await showDashboard();
    } catch {
        showToast('Contrasena incorrecta', 'error');
    }
}

/**
 * Checks authentication status on boot.
 * If authenticated, shows the dashboard; otherwise, shows the login screen.
 * Handles offline mode by loading local data.
 */
async function checkAuthAndBoot() {
    if (!navigator.onLine && getLocalData('appointments', null)) {
        showToast('Modo offline: mostrando datos locales', 'info');
        await showDashboard();
        return;
    }

    const authenticated = await checkAuth();
    if (authenticated) {
        await showDashboard();
        return;
    }
    showLogin();
}

/**
 * Updates the current date display and refreshes the data.
 */
async function updateDate() {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        };
        dateEl.textContent = new Date().toLocaleDateString('es-EC', options);
    }

    try {
        await refreshData();
    } catch (error) {
        showToast(
            `No se pudo actualizar datos en vivo: ${error?.message || 'error desconocido'}`,
            'warning'
        );
    }
    const section = getActiveSection();
    await renderSection(section);
}

/**
 * Exports the current application data (appointments, callbacks, reviews, availability) to a JSON file.
 */
function exportData() {
    const payload = {
        appointments: currentAppointments,
        callbacks: currentCallbacks,
        reviews: currentReviews,
        availability: currentAvailability,
        exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `piel-en-armonia-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Datos exportados correctamente', 'success');
}

/**
 * Imports application data from a JSON file.
 * Replaces existing data with the imported data.
 *
 * @param {HTMLInputElement} input - The file input element containing the JSON file.
 */
async function importData(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    input.value = '';

    if (
        !confirm(
            'Esto reemplazara TODOS los datos actuales con los del archivo seleccionado.\n\nDeseas continuar?'
        )
    ) {
        return;
    }

    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object') {
            throw new Error('El archivo no contiene datos validos');
        }

        const payload = {
            appointments: Array.isArray(data.appointments)
                ? data.appointments
                : [],
            callbacks: Array.isArray(data.callbacks) ? data.callbacks : [],
            reviews: Array.isArray(data.reviews) ? data.reviews : [],
            availability:
                data.availability && typeof data.availability === 'object'
                    ? data.availability
                    : {},
        };

        await apiRequest('import', {
            method: 'POST',
            body: payload,
        });

        await refreshData();
        const activeItem = document.querySelector('.nav-item.active');
        await renderSection(activeItem?.dataset.section || 'dashboard');
        showToast(
            `Datos importados: ${payload.appointments.length} citas`,
            'success'
        );
    } catch (error) {
        showToast(`Error al importar: ${error.message}`, 'error');
    }
}

function attachGlobalListeners() {
    document.addEventListener('click', async (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) return;
        const action = actionEl.dataset.action;

        if (action === 'close-toast') {
            actionEl.closest('.toast')?.remove();
            return;
        }

        if (action === 'logout') {
            event.preventDefault();
            await logout();
            return;
        }

        if (action === 'export-data') {
            event.preventDefault();
            exportData();
            return;
        }

        if (action === 'open-import-file') {
            event.preventDefault();
            document.getElementById('importFileInput')?.click();
            return;
        }

        if (action === 'set-admin-theme') {
            event.preventDefault();
            setAdminThemeMode(actionEl.dataset.themeMode || 'system');
            return;
        }

        try {
            if (action === 'export-csv') {
                event.preventDefault();
                exportAppointmentsCSV();
                return;
            }
            if (action === 'clear-appointment-filters') {
                event.preventDefault();
                resetAppointmentFilters();
                return;
            }
            if (action === 'appointment-density') {
                event.preventDefault();
                setAppointmentDensity(
                    actionEl.dataset.density || 'comfortable'
                );
                return;
            }
            if (action === 'change-month') {
                event.preventDefault();
                changeMonth(Number(actionEl.dataset.delta || 0));
                return;
            }
            if (action === 'availability-today') {
                event.preventDefault();
                jumpAvailabilityToToday();
                return;
            }
            if (action === 'prefill-time-slot') {
                event.preventDefault();
                prefillTimeSlot(actionEl.dataset.time || '');
                return;
            }
            if (action === 'copy-availability-day') {
                event.preventDefault();
                copyAvailabilityDay();
                return;
            }
            if (action === 'paste-availability-day') {
                event.preventDefault();
                await pasteAvailabilityDay();
                return;
            }
            if (action === 'duplicate-availability-day-next') {
                event.preventDefault();
                await duplicateAvailabilityDayToNext();
                return;
            }
            if (action === 'clear-availability-day') {
                event.preventDefault();
                await clearAvailabilityDay();
                return;
            }
            if (action === 'add-time-slot') {
                event.preventDefault();
                await addTimeSlot();
                return;
            }
            if (action === 'remove-time-slot') {
                event.preventDefault();
                await removeTimeSlot(
                    decodeURIComponent(actionEl.dataset.date || ''),
                    decodeURIComponent(actionEl.dataset.time || '')
                );
                return;
            }
            if (action === 'approve-transfer') {
                event.preventDefault();
                await approveTransfer(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'reject-transfer') {
                event.preventDefault();
                await rejectTransfer(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'cancel-appointment') {
                event.preventDefault();
                await cancelAppointment(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'mark-no-show') {
                event.preventDefault();
                await markNoShow(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'mark-contacted') {
                event.preventDefault();
                await markContacted(
                    Number(actionEl.dataset.callbackId || 0),
                    actionEl.dataset.callbackDate || ''
                );
            }
        } catch (error) {
            showToast(`Error ejecutando accion: ${error.message}`, 'error');
        }
    });

    const appointmentFilter = document.getElementById('appointmentFilter');
    if (appointmentFilter) {
        appointmentFilter.addEventListener('change', () => {
            filterAppointments();
        });
    }

    const searchInput = document.getElementById('searchAppointments');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            searchAppointments();
        });
    }

    const appointmentSort = document.getElementById('appointmentSort');
    if (appointmentSort) {
        appointmentSort.addEventListener('change', () => {
            setAppointmentSort(appointmentSort.value || 'datetime_desc');
        });
    }

    const callbackFilter = document.getElementById('callbackFilter');
    if (callbackFilter) {
        callbackFilter.addEventListener('change', filterCallbacks);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initAdminThemeMode();
    attachGlobalListeners();
    initAppointmentsToolbarPreferences();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const navItems = getNavItems();
    navItems.forEach((item) => {
        item.addEventListener('click', async (event) => {
            event.preventDefault();
            await navigateToSection(item.dataset.section || 'dashboard');
        });
    });

    document
        .getElementById('adminMenuToggle')
        ?.addEventListener('click', () => {
            const sidebar = document.getElementById('adminSidebar');
            const isOpen = sidebar?.classList.contains('is-open');
            setSidebarOpen(!isOpen);
        });
    document
        .getElementById('adminMenuClose')
        ?.addEventListener('click', () => closeSidebar({ restoreFocus: true }));
    document
        .getElementById('adminSidebarBackdrop')
        ?.addEventListener('click', () => closeSidebar({ restoreFocus: true }));

    window.addEventListener('keydown', (event) => {
        trapSidebarFocus(event);

        if (event.key === 'Escape') {
            closeSidebar({ restoreFocus: true });
            return;
        }

        handleAdminKeyboardShortcuts(event);
    });
    window.addEventListener('resize', () => {
        if (!isCompactAdminViewport()) {
            closeSidebar();
        }
        syncSidebarOverlayA11yState(isSidebarOpen());
    });
    window.addEventListener('hashchange', async () => {
        const dashboard = document.getElementById('adminDashboard');
        if (!dashboard || dashboard.classList.contains('is-hidden')) return;
        await navigateToSection(getSectionFromHash(), {
            refresh: false,
            updateHash: false,
            focus: false,
            closeMobileNav: false,
        });
    });

    const importFileInput = document.getElementById('importFileInput');
    if (importFileInput) {
        importFileInput.addEventListener('change', () =>
            importData(importFileInput)
        );
    }

    window.addEventListener('online', async () => {
        showToast('Conexion restaurada. Actualizando datos...', 'success');
        await refreshData();
        await renderSection(getActiveSection());
    });

    syncSidebarOverlayA11yState(false);
    await checkAuthAndBoot();
});
