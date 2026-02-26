import { checkAuth, login, login2FA, logout } from './modules/auth.js';
import { refreshData, getLocalData } from './modules/data.js';
import { showToast } from './modules/ui.js';
import {
    setCsrfToken,
    currentAppointments,
    currentCallbacks,
    currentReviews,
    currentAvailability,
    currentQueueTickets,
} from './modules/state.js';
import { apiRequest } from './modules/api.js';
import { loadDashboardData } from './modules/dashboard.js';
import {
    loadCallbacks,
    filterCallbacks,
    applyCallbackQuickFilter,
    searchCallbacks,
    resetCallbackFilters,
    focusCallbackSearch,
    isCallbacksSectionActive,
    markContacted,
    focusNextPendingCallback,
} from './modules/callbacks.js';
import { loadReviews } from './modules/reviews.js';
import { initPushNotifications } from './modules/push.js';
import { initAdminThemeMode, setAdminThemeMode } from './modules/theme.js';
import {
    loadAppointments,
    filterAppointments,
    searchAppointments,
    applyAppointmentQuickFilter,
    focusAppointmentSearch,
    isAppointmentsSectionActive,
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
    jumpAvailabilityToNextWithSlots,
    focusAvailabilityTimeInput,
    isAvailabilitySectionActive,
    hasAvailabilityDraftChanges,
    addTimeSlot,
    prefillTimeSlot,
    removeTimeSlot,
    copyAvailabilityDay,
    pasteAvailabilityDay,
    duplicateAvailabilityDayToNext,
    duplicateAvailabilityDayToNextWeek,
    clearAvailabilityDay,
    clearAvailabilityWeek,
    saveAvailabilityDraft,
    discardAvailabilityDraft,
} from './modules/availability.js';
import {
    loadQueueSection,
    refreshQueueRealtime,
    startQueueRealtimeSync,
    stopQueueRealtimeSync,
    callNextForConsultorio,
    applyQueueTicketAction,
    reprintQueueTicket,
} from './modules/queue.js';

const ADMIN_NAV_COMPACT_BREAKPOINT = 1024;
const ADMIN_SECTION_SHORTCUTS = new Map([
    ['digit1', 'dashboard'],
    ['digit2', 'appointments'],
    ['digit3', 'callbacks'],
    ['digit4', 'reviews'],
    ['digit5', 'availability'],
    ['digit6', 'queue'],
    ['1', 'dashboard'],
    ['2', 'appointments'],
    ['3', 'callbacks'],
    ['4', 'reviews'],
    ['5', 'availability'],
    ['6', 'queue'],
]);
const SIDEBAR_FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');
const ADMIN_REFRESH_STALE_AFTER_MS = 5 * 60 * 1000;
const ADMIN_REFRESH_STATUS_TICK_MS = 30 * 1000;
const ADMIN_LAST_SECTION_STORAGE_KEY = 'adminLastSection';
const ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY = 'adminSidebarCollapsed';
const ADMIN_CONTEXT_ACTIONS = {
    dashboard: {
        title: 'Acciones rápidas: dashboard',
        actions: [
            {
                action: 'refresh-admin-data',
                icon: 'fa-rotate-right',
                label: 'Actualizar datos',
            },
            {
                action: 'context-open-appointments-today',
                icon: 'fa-calendar-day',
                label: 'Citas de hoy',
            },
            {
                action: 'context-open-callbacks-pending',
                icon: 'fa-phone',
                label: 'Callbacks pendientes',
            },
        ],
    },
    appointments: {
        title: 'Acciones rápidas: citas',
        actions: [
            {
                action: 'appointment-quick-filter',
                filterValue: 'today',
                icon: 'fa-calendar-day',
                label: 'Filtrar hoy',
            },
            {
                action: 'appointment-quick-filter',
                filterValue: 'pending_transfer',
                icon: 'fa-money-check-dollar',
                label: 'Por validar',
            },
            {
                action: 'clear-appointment-filters',
                icon: 'fa-filter-circle-xmark',
                label: 'Limpiar filtros',
            },
            {
                action: 'export-csv',
                icon: 'fa-file-csv',
                label: 'Exportar CSV',
            },
        ],
    },
    callbacks: {
        title: 'Acciones rápidas: callbacks',
        actions: [
            {
                action: 'callback-quick-filter',
                filterValue: 'pending',
                icon: 'fa-phone',
                label: 'Pendientes',
            },
            {
                action: 'callback-quick-filter',
                filterValue: 'today',
                icon: 'fa-calendar-day',
                label: 'Hoy',
            },
            {
                action: 'clear-callback-filters',
                icon: 'fa-filter-circle-xmark',
                label: 'Limpiar filtros',
            },
            {
                action: 'context-open-appointments-transfer',
                icon: 'fa-calendar-check',
                label: 'Ver citas por validar',
            },
            {
                action: 'context-open-callbacks-next',
                icon: 'fa-phone-volume',
                label: 'Siguiente llamada',
            },
        ],
    },
    reviews: {
        title: 'Acciones rápidas: reseñas',
        actions: [
            {
                action: 'refresh-admin-data',
                icon: 'fa-rotate-right',
                label: 'Actualizar datos',
            },
            {
                action: 'context-open-dashboard',
                icon: 'fa-chart-line',
                label: 'Volver a dashboard',
            },
            {
                action: 'context-open-callbacks-pending',
                icon: 'fa-headset',
                label: 'Revisar callbacks',
            },
        ],
    },
    availability: {
        title: 'Acciones rápidas: disponibilidad',
        actions: [
            {
                action: 'context-availability-today',
                icon: 'fa-calendar-day',
                label: 'Ir a hoy',
            },
            {
                action: 'context-availability-next',
                icon: 'fa-forward',
                label: 'Siguiente con horarios',
            },
            {
                action: 'context-focus-slot-input',
                icon: 'fa-clock',
                label: 'Agregar horario',
            },
            {
                action: 'context-copy-availability-day',
                icon: 'fa-copy',
                label: 'Copiar día',
            },
        ],
    },
    queue: {
        title: 'Acciones rápidas: turnero sala',
        actions: [
            {
                action: 'queue-call-next',
                queueConsultorio: '1',
                icon: 'fa-bullhorn',
                label: 'Llamar C1',
            },
            {
                action: 'queue-call-next',
                queueConsultorio: '2',
                icon: 'fa-bullhorn',
                label: 'Llamar C2',
            },
            {
                action: 'queue-refresh-state',
                icon: 'fa-rotate-right',
                label: 'Refrescar cola',
            },
            {
                action: 'context-open-dashboard',
                icon: 'fa-chart-line',
                label: 'Volver dashboard',
            },
        ],
    },
};

let adminLastRefreshAt = 0;
let adminRefreshStatusTimerId = 0;

function getNavItems() {
    return Array.from(
        document.querySelectorAll(
            '.nav-item[data-section], .admin-quick-nav-item[data-section]'
        )
    );
}

function normalizeAdminSection(section, fallback = 'dashboard') {
    const candidate = String(section || '').trim();
    if (!candidate) return fallback;
    const sections = new Set(getNavItems().map((item) => item.dataset.section));
    return sections.has(candidate) ? candidate : fallback;
}

function getSectionFromHash({ fallback = 'dashboard' } = {}) {
    const hashSection = window.location.hash.replace(/^#/, '').trim();
    return normalizeAdminSection(hashSection, fallback);
}

function readStoredAdminSection() {
    try {
        const storedSection = localStorage.getItem(
            ADMIN_LAST_SECTION_STORAGE_KEY
        );
        return normalizeAdminSection(storedSection, 'dashboard');
    } catch (_error) {
        return 'dashboard';
    }
}

function persistAdminSection(section) {
    const normalizedSection = normalizeAdminSection(section, 'dashboard');
    try {
        localStorage.setItem(ADMIN_LAST_SECTION_STORAGE_KEY, normalizedSection);
    } catch (_error) {
        // no-op
    }
}

function resolvePreferredSection() {
    const hashSection = window.location.hash.replace(/^#/, '').trim();
    if (hashSection) {
        return normalizeAdminSection(hashSection, 'dashboard');
    }
    return readStoredAdminSection();
}

function getActiveSection() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section ||
        resolvePreferredSection() ||
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

function isSidebarCollapsed() {
    return Boolean(
        document.body?.classList.contains('admin-sidebar-collapsed')
    );
}

function readSidebarCollapsedPreference() {
    try {
        return (
            localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
        );
    } catch (_error) {
        return false;
    }
}

function persistSidebarCollapsedPreference(isCollapsed) {
    try {
        localStorage.setItem(
            ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY,
            isCollapsed ? '1' : '0'
        );
    } catch (_error) {
        // no-op
    }
}

function syncSidebarCollapseButtonState(isCollapsed) {
    const collapseBtn = document.getElementById('adminSidebarCollapse');
    if (!(collapseBtn instanceof HTMLButtonElement)) return;
    const nextLabel = isCollapsed
        ? 'Expandir navegación lateral'
        : 'Contraer navegación lateral';
    collapseBtn.setAttribute('aria-pressed', String(isCollapsed));
    collapseBtn.setAttribute('aria-label', nextLabel);
    collapseBtn.setAttribute('title', nextLabel);
}

function setSidebarCollapsed(isCollapsed, { persist = true } = {}) {
    if (!document.body) return false;

    const shouldCollapse = Boolean(!isCompactAdminViewport() && isCollapsed);
    document.body.classList.toggle('admin-sidebar-collapsed', shouldCollapse);
    syncSidebarCollapseButtonState(shouldCollapse);

    if (persist) {
        persistSidebarCollapsedPreference(shouldCollapse);
    }

    return shouldCollapse;
}

function syncSidebarLayoutMode() {
    if (isCompactAdminViewport()) {
        setSidebarCollapsed(false, { persist: false });
        return;
    }
    setSidebarCollapsed(readSidebarCollapsedPreference(), { persist: false });
}

function setNavActive(section) {
    const normalizedSection = normalizeAdminSection(section, 'dashboard');
    getNavItems().forEach((item) => {
        const isActive = item.dataset.section === normalizedSection;
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
    persistAdminSection(normalizedSection);
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

function normalizeCommandText(value) {
    return String(value || '')
        .toLocaleLowerCase('es')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function formatRefreshAge(nowTimestamp) {
    if (!adminLastRefreshAt) return 'sin actualizar';
    const elapsedMs = Math.max(0, nowTimestamp - adminLastRefreshAt);
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    if (elapsedMinutes <= 0) return 'hace menos de 1 min';
    if (elapsedMinutes === 1) return 'hace 1 min';
    return `hace ${elapsedMinutes} min`;
}

function updateAdminRefreshStatus() {
    const statusEl = document.getElementById('adminRefreshStatus');
    if (!statusEl) return;

    statusEl.classList.remove('status-pill-live', 'status-pill-stale');

    if (!adminLastRefreshAt) {
        statusEl.classList.add('status-pill-muted');
        statusEl.textContent = 'Datos: sin actualizar';
        return;
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, now - adminLastRefreshAt);
    const refreshAge = formatRefreshAge(now);
    const isStale = elapsedMs >= ADMIN_REFRESH_STALE_AFTER_MS;
    statusEl.classList.remove('status-pill-muted');
    statusEl.classList.add(isStale ? 'status-pill-stale' : 'status-pill-live');
    statusEl.textContent = `Datos: ${refreshAge}`;
}

function markAdminDataRefreshed() {
    adminLastRefreshAt = Date.now();
    updateAdminRefreshStatus();
}

function ensureAdminRefreshStatusTicker() {
    if (adminRefreshStatusTimerId) return;
    adminRefreshStatusTimerId = window.setInterval(() => {
        updateAdminRefreshStatus();
    }, ADMIN_REFRESH_STATUS_TICK_MS);
}

function focusAdminQuickCommand({ select = true } = {}) {
    const commandInput = document.getElementById('adminQuickCommand');
    if (!(commandInput instanceof HTMLInputElement)) {
        return false;
    }
    commandInput.focus({ preventScroll: true });
    if (select) {
        commandInput.select();
    }
    return true;
}

function createContextActionButton(actionDef) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-context-action-btn';
    button.dataset.action = actionDef.action;
    if (actionDef.filterValue) {
        button.dataset.filterValue = actionDef.filterValue;
    }
    if (actionDef.targetSection) {
        button.dataset.targetSection = actionDef.targetSection;
    }
    if (actionDef.queueConsultorio) {
        button.dataset.queueConsultorio = actionDef.queueConsultorio;
    }
    button.title = actionDef.hint || actionDef.label;
    button.innerHTML = `<i class="fas ${actionDef.icon}" aria-hidden="true"></i><span>${actionDef.label}</span>`;
    return button;
}

function renderAdminContextActions(section) {
    const contextTitle = document.getElementById('adminContextTitle');
    const contextActions = document.getElementById('adminContextActions');
    if (!contextTitle || !contextActions) return;

    const normalizedSection =
        section && ADMIN_CONTEXT_ACTIONS[section] ? section : 'dashboard';
    const config = ADMIN_CONTEXT_ACTIONS[normalizedSection];
    contextTitle.textContent = config.title;
    contextActions.innerHTML = '';
    config.actions.forEach((actionDef) => {
        contextActions.appendChild(createContextActionButton(actionDef));
    });
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
    ).filter((element) => {
        if (!(element instanceof HTMLElement)) return false;
        if (element.hasAttribute('disabled')) return false;
        if (element.getAttribute('aria-hidden') === 'true') return false;
        if (element.closest('.is-hidden')) return false;
        if (element.getClientRects().length === 0) return false;
        if (element.offsetWidth === 0 && element.offsetHeight === 0) {
            return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        return true;
    });
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
    const dashboard = document.getElementById('adminDashboard');
    if (!dashboard || dashboard.classList.contains('is-hidden')) return;
    const isTyping = isTypingContextTarget(event.target);
    const key = String(event.key || '').toLowerCase();
    const code = String(event.code || '').toLowerCase();

    if (
        (event.ctrlKey || event.metaKey) &&
        key === 'k' &&
        !event.altKey &&
        !event.shiftKey
    ) {
        event.preventDefault();
        focusAdminQuickCommand();
        return;
    }

    if (
        event.key === '/' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        isAppointmentsSectionActive() &&
        !isTyping
    ) {
        event.preventDefault();
        focusAppointmentSearch();
        return;
    }

    if (
        event.key === '/' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        isCallbacksSectionActive() &&
        !isTyping
    ) {
        event.preventDefault();
        focusCallbackSearch();
        return;
    }

    if (
        event.key === '/' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        isAvailabilitySectionActive() &&
        !isTyping
    ) {
        event.preventDefault();
        focusAvailabilityTimeInput();
        return;
    }

    if (
        event.key === '/' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !isTyping
    ) {
        event.preventDefault();
        focusAdminQuickCommand();
        return;
    }

    if (!event.altKey || !event.shiftKey) return;
    if (isTyping) return;

    if (code === 'keyr') {
        event.preventDefault();
        void refreshAdminDataAndRender({ showSuccessToast: true });
        return;
    }

    if (key === 'm' || code === 'keym') {
        event.preventDefault();
        if (isCompactAdminViewport()) {
            setSidebarOpen(!isSidebarOpen());
            return;
        }
        setSidebarCollapsed(!isSidebarCollapsed());
        return;
    }

    if (isAvailabilitySectionActive()) {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            changeMonth(-1);
            return;
        }
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            changeMonth(1);
            return;
        }
        if (code === 'keyy') {
            event.preventDefault();
            jumpAvailabilityToToday();
            return;
        }
        if (code === 'keys') {
            event.preventDefault();
            jumpAvailabilityToNextWithSlots();
            return;
        }
        if (code === 'keyd') {
            event.preventDefault();
            void duplicateAvailabilityDayToNext();
            return;
        }
        if (code === 'keyw') {
            event.preventDefault();
            void duplicateAvailabilityDayToNextWeek();
            return;
        }
        if (code === 'keyv') {
            event.preventDefault();
            void pasteAvailabilityDay();
            return;
        }
        if (code === 'keyx') {
            event.preventDefault();
            void clearAvailabilityDay();
            return;
        }
        if (code === 'keyq') {
            event.preventDefault();
            void clearAvailabilityWeek();
            return;
        }
        if (code === 'keyg') {
            event.preventDefault();
            void saveAvailabilityDraft();
            return;
        }
        if (code === 'keyz') {
            event.preventDefault();
            discardAvailabilityDraft();
            return;
        }
    }

    const appointmentShortcutFilters = {
        keya: 'all',
        keyh: 'today',
        keyt: 'pending_transfer',
        keyn: 'no_show',
    };
    const quickFilter = appointmentShortcutFilters[code] || null;
    if (quickFilter) {
        event.preventDefault();
        void navigateToAppointmentsWithQuickFilter(quickFilter);
        return;
    }

    const callbackShortcutFilters = {
        keyp: 'pending',
        keyc: 'contacted',
    };
    const callbackQuickFilter = callbackShortcutFilters[code] || null;
    if (callbackQuickFilter) {
        event.preventDefault();
        void navigateToCallbacksWithQuickFilter(callbackQuickFilter);
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
    const currentSection = normalizeAdminSection(
        getActiveSection(),
        'dashboard'
    );
    const targetSection = normalizeAdminSection(section, 'dashboard');

    if (
        currentSection === 'availability' &&
        targetSection !== 'availability' &&
        hasAvailabilityDraftChanges()
    ) {
        const shouldDiscardPendingChanges = confirm(
            'Tienes cambios pendientes en disponibilidad sin guardar. Si continuas se mantendran como borrador. Deseas salir de esta seccion?'
        );
        if (!shouldDiscardPendingChanges) {
            setNavActive(currentSection);
            if (!updateHash) {
                syncHash(currentSection);
            }
            if (focus) {
                focusSection(currentSection);
            }
            return false;
        }
    }

    setNavActive(targetSection);

    if (closeMobileNav) {
        closeSidebar();
    }

    if (refresh) {
        try {
            await refreshData();
            markAdminDataRefreshed();
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

    return true;
}

async function navigateToAppointmentsWithQuickFilter(filter) {
    await navigateToSection('appointments', { focus: false });
    applyAppointmentQuickFilter(filter, { preserveSearch: false });
    focusSection('appointments');
}

async function navigateToCallbacksWithQuickFilter(filter) {
    await navigateToSection('callbacks', { focus: false });
    applyCallbackQuickFilter(filter, { preserveSearch: false });
    focusSection('callbacks');
}

async function refreshAdminDataAndRender({
    showSuccessToast = false,
    showErrorToast = true,
} = {}) {
    try {
        await refreshData();
        markAdminDataRefreshed();
        await renderSection(getActiveSection());
        if (showSuccessToast) {
            showToast('Datos actualizados', 'success');
        }
        return true;
    } catch (error) {
        if (showErrorToast) {
            showToast(
                `No se pudo actualizar datos en vivo: ${error?.message || 'error desconocido'}`,
                'warning'
            );
        }
        return false;
    }
}

async function runAdminQuickCommand(rawCommand) {
    const commandInput = document.getElementById('adminQuickCommand');
    const command = normalizeCommandText(rawCommand);
    if (!command) {
        showToast(
            'Escribe un comando. Ejemplo: "citas hoy" o "callbacks pendientes".',
            'info'
        );
        focusAdminQuickCommand();
        return false;
    }

    if (command === 'help' || command === 'ayuda') {
        showToast(
            'Comandos: citas hoy, citas por validar, callbacks pendientes, disponibilidad hoy, exportar csv.',
            'info'
        );
        return true;
    }

    if (command.includes('exportar') && command.includes('csv')) {
        await navigateToSection('appointments', { focus: false });
        exportAppointmentsCSV();
        focusSection('appointments');
        return true;
    }

    if (command.includes('dashboard') || command.includes('inicio')) {
        await navigateToSection('dashboard');
        return true;
    }

    if (
        command.includes('turnero') ||
        command.includes('cola') ||
        command.includes('consultorio')
    ) {
        await navigateToSection('queue', { focus: false });
        if (command.includes('c1') || command.includes('consultorio 1')) {
            await callNextForConsultorio(1);
        } else if (
            command.includes('c2') ||
            command.includes('consultorio 2')
        ) {
            await callNextForConsultorio(2);
        } else {
            await refreshQueueRealtime({ silent: true });
        }
        focusSection('queue');
        return true;
    }

    if (command.includes('resena') || command.includes('review')) {
        await navigateToSection('reviews');
        return true;
    }

    if (command.includes('callback')) {
        await navigateToCallbacksWithQuickFilter(
            command.includes('hoy')
                ? 'today'
                : command.includes('contactado')
                  ? 'contacted'
                  : 'pending'
        );
        return true;
    }

    if (command.includes('cita') || command.includes('agenda')) {
        const quickFilter = command.includes('hoy')
            ? 'today'
            : command.includes('validar') ||
                command.includes('transferencia') ||
                command.includes('por validar')
              ? 'pending_transfer'
              : command.includes('no show') || command.includes('no asistio')
                ? 'no_show'
                : 'all';
        await navigateToAppointmentsWithQuickFilter(quickFilter);
        if (command.includes('limpiar')) {
            resetAppointmentFilters();
        }
        return true;
    }

    if (
        command.includes('disponibilidad') ||
        command.includes('horario') ||
        command.includes('calendario')
    ) {
        await navigateToSection('availability', { focus: false });
        if (command.includes('hoy')) {
            jumpAvailabilityToToday();
        } else if (command.includes('siguiente')) {
            jumpAvailabilityToNextWithSlots();
        } else if (
            command.includes('agregar') ||
            command.includes('nuevo horario')
        ) {
            focusAvailabilityTimeInput();
        }
        focusSection('availability');
        return true;
    }

    if (
        command.includes('actualizar') ||
        command.includes('refrescar') ||
        command === 'refresh'
    ) {
        await refreshAdminDataAndRender({ showSuccessToast: true });
        return true;
    }

    showToast(
        'Comando no reconocido. Usa "ayuda" para ver ejemplos disponibles.',
        'warning'
    );
    if (commandInput instanceof HTMLInputElement) {
        commandInput.focus({ preventScroll: true });
        commandInput.select();
    }
    return false;
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
        queue: 'Turnero Sala',
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[section] || 'Dashboard';
    renderAdminContextActions(section);

    document
        .querySelectorAll('.admin-section')
        .forEach((s) => s.classList.remove('active'));
    const sectionEl = document.getElementById(section);
    if (sectionEl) sectionEl.classList.add('active');

    if (section !== 'queue') {
        stopQueueRealtimeSync({ reason: 'paused' });
    }

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
        case 'queue': {
            loadQueueSection();
            startQueueRealtimeSync({ immediate: true });
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
    stopQueueRealtimeSync({ reason: 'paused' });
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
    const preferredSection = resolvePreferredSection();
    setNavActive(preferredSection);
    syncHash(preferredSection);
    syncSidebarLayoutMode();
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
            showToast('Bienvenido al panel de administración', 'success');
            await showDashboard();
        } catch {
            showToast('Código incorrecto o sesión expirada', 'error');
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
            showToast('Ingresa tu código 2FA', 'info');
            return;
        }

        if (loginResult.csrfToken) setCsrfToken(loginResult.csrfToken);
        showToast('Bienvenido al panel de administración', 'success');
        await showDashboard();
    } catch {
        showToast('Contraseña incorrecta', 'error');
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
        markAdminDataRefreshed();
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
        queue_tickets: currentQueueTickets,
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
            queue_tickets: Array.isArray(data.queue_tickets)
                ? data.queue_tickets
                : [],
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
        markAdminDataRefreshed();
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

        if (action === 'toggle-sidebar-collapse') {
            event.preventDefault();
            if (isCompactAdminViewport()) {
                setSidebarOpen(!isSidebarOpen());
                return;
            }
            setSidebarCollapsed(!isSidebarCollapsed());
            return;
        }

        if (action === 'run-admin-command') {
            event.preventDefault();
            const commandInput = document.getElementById('adminQuickCommand');
            await runAdminQuickCommand(
                commandInput instanceof HTMLInputElement
                    ? commandInput.value
                    : ''
            );
            return;
        }

        if (action === 'refresh-admin-data') {
            event.preventDefault();
            await refreshAdminDataAndRender({ showSuccessToast: true });
            return;
        }

        if (action === 'context-open-dashboard') {
            event.preventDefault();
            await navigateToSection('dashboard');
            return;
        }

        if (action === 'context-open-appointments-today') {
            event.preventDefault();
            await navigateToAppointmentsWithQuickFilter('today');
            return;
        }

        if (action === 'context-open-appointments-transfer') {
            event.preventDefault();
            await navigateToAppointmentsWithQuickFilter('pending_transfer');
            return;
        }

        if (action === 'context-open-callbacks-pending') {
            event.preventDefault();
            await navigateToCallbacksWithQuickFilter('pending');
            return;
        }

        if (action === 'context-open-callbacks-next') {
            event.preventDefault();
            await navigateToCallbacksWithQuickFilter('pending');
            focusNextPendingCallback();
            return;
        }

        if (action === 'queue-refresh-state') {
            event.preventDefault();
            await refreshQueueRealtime({ silent: false });
            return;
        }

        if (action === 'queue-call-next') {
            event.preventDefault();
            await callNextForConsultorio(
                Number(actionEl.dataset.queueConsultorio || 0)
            );
            return;
        }

        if (action === 'context-focus-slot-input') {
            event.preventDefault();
            await navigateToSection('availability', { focus: false });
            focusAvailabilityTimeInput();
            return;
        }

        if (action === 'context-availability-today') {
            event.preventDefault();
            await navigateToSection('availability', { focus: false });
            jumpAvailabilityToToday();
            return;
        }

        if (action === 'context-availability-next') {
            event.preventDefault();
            await navigateToSection('availability', { focus: false });
            jumpAvailabilityToNextWithSlots();
            return;
        }

        if (action === 'context-copy-availability-day') {
            event.preventDefault();
            await navigateToSection('availability', { focus: false });
            copyAvailabilityDay();
            return;
        }

        try {
            if (action === 'export-csv') {
                event.preventDefault();
                exportAppointmentsCSV();
                return;
            }
            if (action === 'appointment-quick-filter') {
                event.preventDefault();
                applyAppointmentQuickFilter(
                    actionEl.dataset.filterValue || 'all'
                );
                return;
            }
            if (action === 'callback-quick-filter') {
                event.preventDefault();
                applyCallbackQuickFilter(actionEl.dataset.filterValue || 'all');
                return;
            }
            if (action === 'callbacks-triage-next') {
                event.preventDefault();
                await navigateToCallbacksWithQuickFilter('pending');
                focusNextPendingCallback();
                return;
            }
            if (action === 'clear-appointment-filters') {
                event.preventDefault();
                resetAppointmentFilters();
                return;
            }
            if (action === 'clear-callback-filters') {
                event.preventDefault();
                resetCallbackFilters();
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
            if (action === 'availability-next-with-slots') {
                event.preventDefault();
                jumpAvailabilityToNextWithSlots();
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
            if (action === 'duplicate-availability-next-week') {
                event.preventDefault();
                await duplicateAvailabilityDayToNextWeek();
                return;
            }
            if (action === 'clear-availability-day') {
                event.preventDefault();
                await clearAvailabilityDay();
                return;
            }
            if (action === 'clear-availability-week') {
                event.preventDefault();
                await clearAvailabilityWeek();
                return;
            }
            if (action === 'save-availability-draft') {
                event.preventDefault();
                await saveAvailabilityDraft();
                return;
            }
            if (action === 'discard-availability-draft') {
                event.preventDefault();
                discardAvailabilityDraft();
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
                return;
            }
            if (action === 'queue-ticket-action') {
                event.preventDefault();
                await applyQueueTicketAction(
                    Number(actionEl.dataset.queueId || 0),
                    actionEl.dataset.queueAction || '',
                    Number(actionEl.dataset.queueConsultorio || 0)
                );
                return;
            }
            if (action === 'queue-reprint-ticket') {
                event.preventDefault();
                await reprintQueueTicket(Number(actionEl.dataset.queueId || 0));
                return;
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

    const callbackSearchInput = document.getElementById('searchCallbacks');
    if (callbackSearchInput) {
        callbackSearchInput.addEventListener('input', searchCallbacks);
    }

    const quickCommandInput = document.getElementById('adminQuickCommand');
    if (quickCommandInput instanceof HTMLInputElement) {
        quickCommandInput.addEventListener('keydown', async (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            await runAdminQuickCommand(quickCommandInput.value);
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initAdminThemeMode();
    attachGlobalListeners();
    initAppointmentsToolbarPreferences();
    ensureAdminRefreshStatusTicker();
    updateAdminRefreshStatus();
    renderAdminContextActions(resolvePreferredSection());
    syncSidebarLayoutMode();

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
            if (isCompactAdminViewport()) {
                setSidebarOpen(!isSidebarOpen());
                return;
            }
            setSidebarCollapsed(!isSidebarCollapsed());
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
        syncSidebarLayoutMode();
        syncSidebarOverlayA11yState(isSidebarOpen());
    });
    window.addEventListener('hashchange', async () => {
        const dashboard = document.getElementById('adminDashboard');
        if (!dashboard || dashboard.classList.contains('is-hidden')) return;
        await navigateToSection(getSectionFromHash({ fallback: 'dashboard' }), {
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

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopQueueRealtimeSync({ reason: 'hidden' });
            return;
        }
        if (getActiveSection() === 'queue') {
            startQueueRealtimeSync({ immediate: true });
        }
    });

    window.addEventListener('online', async () => {
        const refreshed = await refreshAdminDataAndRender({
            showSuccessToast: false,
            showErrorToast: false,
        });
        if (getActiveSection() === 'queue') {
            startQueueRealtimeSync({ immediate: true });
        }
        if (refreshed) {
            showToast('Conexion restaurada. Datos actualizados.', 'success');
            return;
        }
        showToast(
            'Conexion restaurada, pero no se pudieron refrescar datos.',
            'warning'
        );
    });

    window.addEventListener('offline', () => {
        if (getActiveSection() === 'queue') {
            stopQueueRealtimeSync({ reason: 'offline' });
        }
    });

    syncSidebarOverlayA11yState(false);
    syncSidebarCollapseButtonState(isSidebarCollapsed());
    await checkAuthAndBoot();
});
