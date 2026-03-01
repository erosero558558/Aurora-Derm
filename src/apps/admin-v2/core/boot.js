import { attachKeyboardShortcuts } from './keyboard.js';
import { readThemeMode, persistThemeMode, applyTheme } from './flags.js';
import { getStorageItem, setStorageItem } from './persistence.js';
import {
    normalizeSection,
    readSectionFromHash,
    setSectionHash,
} from './router.js';
import { getState, updateState } from './store.js';
import { createToast, qs, setText } from '../ui/render.js';
import {
    checkAuthStatus,
    loginWith2FA,
    loginWithPassword,
    logoutSession,
} from '../modules/auth.js';
import {
    renderV2Shell,
    setActiveSection,
    setSidebarState,
    setLogin2FAVisibility,
    showDashboardView,
    showLoginView,
} from '../modules/shell.js';
import { refreshAdminData, refreshStatusLabel } from '../modules/data.js';
import {
    renderAppointmentsSection,
    setAppointmentDensity,
    setAppointmentFilter,
    setAppointmentSearch,
    setAppointmentSort,
    clearAppointmentFilters,
    approveTransfer,
    rejectTransfer,
    markNoShow,
    cancelAppointment,
    exportAppointmentsCsv,
    hydrateAppointmentPreferences,
} from '../modules/appointments.js';
import {
    renderCallbacksSection,
    setCallbacksFilter,
    setCallbacksSearch,
    clearCallbacksFilters,
    markCallbackContacted,
    selectVisibleCallbacks,
    markSelectedCallbacksContacted,
    focusNextPendingCallback,
} from '../modules/callbacks.js';
import {
    renderAvailabilitySection,
    syncAvailabilityFromData,
    hasPendingAvailabilityChanges,
    selectAvailabilityDate,
    changeAvailabilityMonth,
    jumpAvailabilityToday,
    jumpAvailabilityNextWithSlots,
    prefillAvailabilityTime,
    addAvailabilitySlot,
    removeAvailabilitySlot,
    copyAvailabilityDay,
    pasteAvailabilityDay,
    duplicateAvailabilityDay,
    clearAvailabilityDay,
    clearAvailabilityWeek,
    saveAvailabilityDraft,
    discardAvailabilityDraft,
} from '../modules/availability.js';
import {
    renderQueueSection,
    hydrateQueueFromData,
    refreshQueueState,
    setQueueFilter,
    setQueueSearch,
    clearQueueSearch,
    callNextForConsultorio,
    runQueueTicketAction,
    runQueueBulkAction,
    runQueueBulkReprint,
    reprintQueueTicket,
    toggleQueueHelpPanel,
    toggleQueueOneTap,
    setQueuePracticeMode,
    setQueueStationLock,
    setQueueStationMode,
    queueNumpadAction,
    confirmQueueSensitiveAction,
    cancelQueueSensitiveAction,
    applyQueueRuntimeDefaults,
    shouldRefreshQueueOnSectionEnter,
    beginQueueCallKeyCapture,
    clearQueueCallKeyBinding,
    dismissQueueSensitiveDialog,
} from '../modules/queue.js';
import { renderDashboard } from '../modules/dashboard.js';
import { renderReviewsSection } from '../modules/reviews.js';
import { initPushModule } from '../modules/push.js';

const ADMIN_LAST_SECTION_STORAGE_KEY = 'adminLastSection';
const ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY = 'adminSidebarCollapsed';

function getThemeButtons() {
    return Array.from(
        document.querySelectorAll('.admin-theme-btn[data-theme-mode]')
    );
}

function setThemeMode(mode, { persist = false } = {}) {
    const resolvedTheme = applyTheme(mode);

    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            themeMode: mode,
            theme: resolvedTheme,
        },
    }));

    if (persist) {
        persistThemeMode(mode);
    }

    getThemeButtons().forEach((button) => {
        const active = button.dataset.themeMode === mode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

function restoreUiPrefs() {
    const lastSection = normalizeSection(
        getStorageItem(ADMIN_LAST_SECTION_STORAGE_KEY, 'dashboard')
    );
    const collapsed =
        getStorageItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY, '0') === '1';

    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            activeSection: lastSection,
            sidebarCollapsed: collapsed,
            sidebarOpen: false,
        },
    }));

    setActiveSection(lastSection);
    setSectionHash(lastSection);
    setSidebarState({
        open: false,
        collapsed,
    });
}

function persistUiPrefs() {
    const state = getState();
    setStorageItem(ADMIN_LAST_SECTION_STORAGE_KEY, state.ui.activeSection);
    setStorageItem(
        ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY,
        state.ui.sidebarCollapsed ? '1' : '0'
    );
}

function refreshHeaderStatus() {
    setText('#adminRefreshStatus', refreshStatusLabel());
}

function renderAllSections() {
    renderDashboard(getState());
    renderAppointmentsSection();
    renderCallbacksSection();
    renderReviewsSection();
    renderAvailabilitySection();
    renderQueueSection();
    refreshHeaderStatus();
}

function showSection(section) {
    const normalized = normalizeSection(section, 'dashboard');
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            activeSection: normalized,
        },
    }));
    setActiveSection(normalized);
    setSectionHash(normalized);
    persistUiPrefs();
}

async function navigateToSection(section, options = {}) {
    const normalized = normalizeSection(section, 'dashboard');
    const { force = false } = options;
    const previousSection = getState().ui.activeSection;

    if (
        !force &&
        getState().ui.activeSection === 'availability' &&
        normalized !== 'availability'
    ) {
        if (hasPendingAvailabilityChanges()) {
            const confirmed = window.confirm(
                'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
            );
            if (!confirmed) return;
        }
    }

    showSection(normalized);
    if (
        normalized === 'queue' &&
        previousSection !== 'queue' &&
        shouldRefreshQueueOnSectionEnter()
    ) {
        await refreshQueueState();
    }
}

function toggleSidebarCollapsed() {
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            sidebarCollapsed: !state.ui.sidebarCollapsed,
            sidebarOpen: state.ui.sidebarOpen,
        },
    }));

    const state = getState();
    setSidebarState({
        open: state.ui.sidebarOpen,
        collapsed: state.ui.sidebarCollapsed,
    });
    persistUiPrefs();
}

function toggleSidebarOpen() {
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            sidebarOpen: !state.ui.sidebarOpen,
        },
    }));

    const state = getState();
    setSidebarState({
        open: state.ui.sidebarOpen,
        collapsed: state.ui.sidebarCollapsed,
    });
}

function closeSidebar() {
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            sidebarOpen: false,
        },
    }));

    const state = getState();
    setSidebarState({
        open: false,
        collapsed: state.ui.sidebarCollapsed,
    });
}

function focusQuickCommand() {
    const input = document.getElementById('adminQuickCommand');
    if (input instanceof HTMLInputElement) input.focus();
}

function focusCurrentSearch() {
    const section = getState().ui.activeSection;
    if (section === 'appointments') {
        const input = document.getElementById('searchAppointments');
        if (input instanceof HTMLInputElement) input.focus();
        return;
    }
    if (section === 'callbacks') {
        const input = document.getElementById('searchCallbacks');
        if (input instanceof HTMLInputElement) input.focus();
        return;
    }
    if (section === 'queue') {
        const input = document.getElementById('queueSearchInput');
        if (input instanceof HTMLInputElement) input.focus();
    }
}

async function runQuickAction(action) {
    switch (action) {
        case 'appointments_pending_transfer':
            await navigateToSection('appointments');
            setAppointmentFilter('pending_transfer');
            break;
        case 'appointments_all':
            await navigateToSection('appointments');
            setAppointmentFilter('all');
            break;
        case 'appointments_no_show':
            await navigateToSection('appointments');
            setAppointmentFilter('no_show');
            break;
        case 'callbacks_pending':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            break;
        case 'callbacks_contacted':
            await navigateToSection('callbacks');
            setCallbacksFilter('contacted');
            break;
        case 'queue_sla_risk':
            await navigateToSection('queue');
            setQueueFilter('sla_risk');
            break;
        case 'queue_waiting':
            await navigateToSection('queue');
            setQueueFilter('waiting');
            break;
        case 'queue_called':
            await navigateToSection('queue');
            setQueueFilter('called');
            break;
        case 'queue_no_show':
            await navigateToSection('queue');
            setQueueFilter('no_show');
            break;
        case 'queue_all':
            await navigateToSection('queue');
            setQueueFilter('all');
            break;
        case 'queue_call_next':
            await navigateToSection('queue');
            await callNextForConsultorio(getState().queue.stationConsultorio);
            break;
        default:
            break;
    }
}

async function refreshDataAndRender(showToast = false) {
    const ok = await refreshAdminData();
    syncAvailabilityFromData();
    await hydrateQueueFromData();
    renderAllSections();
    if (showToast) {
        createToast(
            ok ? 'Datos actualizados' : 'Datos cargados desde cache local',
            ok ? 'success' : 'warning'
        );
    }
}

function parseQuickCommand(value) {
    const command = String(value || '')
        .trim()
        .toLowerCase();
    if (!command) return null;
    if (command.includes('callbacks') && command.includes('pend')) {
        return 'callbacks_pending';
    }
    if (command.includes('citas') && command.includes('transfer')) {
        return 'appointments_pending_transfer';
    }
    if (command.includes('queue') || command.includes('cola')) {
        return 'queue_sla_risk';
    }
    if (command.includes('no show')) {
        return 'appointments_no_show';
    }
    return null;
}

function attachInputListeners() {
    const appointmentFilter = document.getElementById('appointmentFilter');
    if (appointmentFilter instanceof HTMLSelectElement) {
        appointmentFilter.addEventListener('change', () => {
            setAppointmentFilter(appointmentFilter.value);
        });
    }

    const appointmentSort = document.getElementById('appointmentSort');
    if (appointmentSort instanceof HTMLSelectElement) {
        appointmentSort.addEventListener('change', () => {
            setAppointmentSort(appointmentSort.value);
        });
    }

    const searchAppointments = document.getElementById('searchAppointments');
    if (searchAppointments instanceof HTMLInputElement) {
        searchAppointments.addEventListener('input', () => {
            setAppointmentSearch(searchAppointments.value);
        });
    }

    const callbackFilter = document.getElementById('callbackFilter');
    if (callbackFilter instanceof HTMLSelectElement) {
        callbackFilter.addEventListener('change', () => {
            setCallbacksFilter(callbackFilter.value);
        });
    }

    const searchCallbacks = document.getElementById('searchCallbacks');
    if (searchCallbacks instanceof HTMLInputElement) {
        searchCallbacks.addEventListener('input', () => {
            setCallbacksSearch(searchCallbacks.value);
        });
    }

    const searchQueue = document.getElementById('queueSearchInput');
    if (searchQueue instanceof HTMLInputElement) {
        searchQueue.addEventListener('input', () => {
            setQueueSearch(searchQueue.value);
        });
    }

    const quickCommand = document.getElementById('adminQuickCommand');
    if (quickCommand instanceof HTMLInputElement) {
        quickCommand.addEventListener('keydown', async (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            const action = parseQuickCommand(quickCommand.value);
            if (action) {
                await runQuickAction(action);
            }
        });
    }
}

async function handleAction(action, element) {
    switch (action) {
        case 'close-toast':
            element.closest('.toast')?.remove();
            return;
        case 'set-admin-theme':
            setThemeMode(String(element.dataset.themeMode || 'system'), {
                persist: true,
            });
            return;
        case 'toggle-sidebar-collapse':
            toggleSidebarCollapsed();
            return;
        case 'refresh-admin-data':
            await refreshDataAndRender(true);
            return;
        case 'run-admin-command': {
            const input = document.getElementById('adminQuickCommand');
            if (input instanceof HTMLInputElement) {
                const parsed = parseQuickCommand(input.value);
                if (parsed) {
                    await runQuickAction(parsed);
                }
            }
            return;
        }
        case 'logout':
            await logoutSession();
            showLoginView();
            createToast('Sesion cerrada', 'info');
            return;
        case 'appointment-quick-filter':
            setAppointmentFilter(String(element.dataset.filterValue || 'all'));
            return;
        case 'clear-appointment-filters':
            clearAppointmentFilters();
            return;
        case 'appointment-density':
            setAppointmentDensity(
                String(element.dataset.density || 'comfortable')
            );
            return;
        case 'approve-transfer':
            await approveTransfer(Number(element.dataset.id || 0));
            createToast('Transferencia aprobada', 'success');
            return;
        case 'reject-transfer':
            await rejectTransfer(Number(element.dataset.id || 0));
            createToast('Transferencia rechazada', 'warning');
            return;
        case 'mark-no-show':
            await markNoShow(Number(element.dataset.id || 0));
            createToast('Marcado como no show', 'warning');
            return;
        case 'cancel-appointment':
            await cancelAppointment(Number(element.dataset.id || 0));
            createToast('Cita cancelada', 'warning');
            return;
        case 'export-csv':
            exportAppointmentsCsv();
            return;
        case 'callback-quick-filter':
            setCallbacksFilter(String(element.dataset.filterValue || 'all'));
            return;
        case 'clear-callback-filters':
            clearCallbacksFilters();
            return;
        case 'callbacks-triage-next':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            focusNextPendingCallback();
            return;
        case 'mark-contacted':
            await markCallbackContacted(
                Number(element.dataset.callbackId || 0),
                String(element.dataset.callbackDate || '')
            );
            createToast('Callback actualizado', 'success');
            return;
        case 'change-month':
            changeAvailabilityMonth(Number(element.dataset.delta || 0));
            return;
        case 'availability-today':
        case 'context-availability-today':
            jumpAvailabilityToday();
            return;
        case 'availability-next-with-slots':
        case 'context-availability-next':
            jumpAvailabilityNextWithSlots();
            return;
        case 'select-availability-day':
            selectAvailabilityDate(String(element.dataset.date || ''));
            return;
        case 'prefill-time-slot':
            prefillAvailabilityTime(String(element.dataset.time || ''));
            return;
        case 'add-time-slot':
            addAvailabilitySlot();
            return;
        case 'remove-time-slot':
            removeAvailabilitySlot(
                decodeURIComponent(String(element.dataset.date || '')),
                decodeURIComponent(String(element.dataset.time || ''))
            );
            return;
        case 'copy-availability-day':
        case 'context-copy-availability-day':
            copyAvailabilityDay();
            return;
        case 'paste-availability-day':
            pasteAvailabilityDay();
            return;
        case 'duplicate-availability-day-next':
            duplicateAvailabilityDay(1);
            return;
        case 'duplicate-availability-next-week':
            duplicateAvailabilityDay(7);
            return;
        case 'clear-availability-day':
            clearAvailabilityDay();
            return;
        case 'clear-availability-week':
            clearAvailabilityWeek();
            return;
        case 'save-availability-draft':
            await saveAvailabilityDraft();
            createToast('Disponibilidad guardada', 'success');
            return;
        case 'discard-availability-draft':
            discardAvailabilityDraft();
            createToast('Borrador descartado', 'info');
            return;
        case 'queue-refresh-state':
            await refreshQueueState();
            return;
        case 'queue-call-next':
            await callNextForConsultorio(
                Number(element.dataset.queueConsultorio || 0)
            );
            return;
        case 'queue-ticket-action':
            await runQueueTicketAction(
                Number(element.dataset.queueId || 0),
                String(element.dataset.queueAction || ''),
                Number(element.dataset.queueConsultorio || 0)
            );
            return;
        case 'queue-reprint-ticket':
            await reprintQueueTicket(Number(element.dataset.queueId || 0));
            return;
        case 'queue-bulk-action':
            await runQueueBulkAction(
                String(element.dataset.queueAction || 'no_show')
            );
            return;
        case 'queue-bulk-reprint':
            await runQueueBulkReprint();
            return;
        case 'queue-clear-search':
            clearQueueSearch();
            return;
        case 'queue-toggle-shortcuts':
            toggleQueueHelpPanel();
            return;
        case 'queue-toggle-one-tap':
            toggleQueueOneTap();
            return;
        case 'queue-start-practice':
            setQueuePracticeMode(true);
            return;
        case 'queue-stop-practice':
            setQueuePracticeMode(false);
            return;
        case 'queue-lock-station':
            setQueueStationLock(Number(element.dataset.queueConsultorio || 1));
            return;
        case 'queue-set-station-mode':
            setQueueStationMode(String(element.dataset.queueMode || 'free'));
            return;
        case 'queue-sensitive-confirm':
            await confirmQueueSensitiveAction();
            return;
        case 'queue-sensitive-cancel':
            cancelQueueSensitiveAction();
            return;
        case 'queue-capture-call-key':
            beginQueueCallKeyCapture();
            return;
        case 'queue-clear-call-key':
            clearQueueCallKeyBinding();
            return;
        case 'callbacks-bulk-select-visible':
            selectVisibleCallbacks();
            return;
        case 'callbacks-bulk-mark':
            await markSelectedCallbacksContacted();
            return;
        case 'context-open-appointments-transfer':
            await navigateToSection('appointments');
            setAppointmentFilter('pending_transfer');
            return;
        case 'context-open-callbacks-pending':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            return;
        case 'context-open-callbacks-next':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            focusNextPendingCallback();
            return;
        case 'context-open-dashboard':
            await navigateToSection('dashboard');
            return;
        default:
            break;
    }
}

function attachActionListeners() {
    document.addEventListener('click', async (event) => {
        const target =
            event.target instanceof Element
                ? event.target.closest('[data-action]')
                : null;
        if (!target) return;
        const action = String(target.getAttribute('data-action') || '');
        if (!action) return;

        event.preventDefault();

        try {
            await handleAction(action, target);
        } catch (error) {
            createToast(error?.message || 'Error ejecutando accion', 'error');
        }
    });

    document.addEventListener('click', async (event) => {
        const nav =
            event.target instanceof Element
                ? event.target.closest('[data-section]')
                : null;
        if (!nav) return;

        const isQuickNav = nav.classList.contains('admin-quick-nav-item');
        const isSidebarNav = nav.classList.contains('nav-item');
        if (!isQuickNav && !isSidebarNav) return;

        event.preventDefault();
        await navigateToSection(
            String(nav.getAttribute('data-section') || 'dashboard')
        );

        if (window.matchMedia('(max-width: 1024px)').matches) {
            closeSidebar();
        }
    });

    document.addEventListener('click', (event) => {
        const queueFilterBtn =
            event.target instanceof Element
                ? event.target.closest('[data-queue-filter]')
                : null;
        if (!queueFilterBtn) return;
        event.preventDefault();
        setQueueFilter(
            String(queueFilterBtn.getAttribute('data-queue-filter') || 'all')
        );
    });

    const callbacksBulkSelect = document.getElementById(
        'callbacksBulkSelectVisibleBtn'
    );
    if (callbacksBulkSelect) {
        callbacksBulkSelect.setAttribute(
            'data-action',
            'callbacks-bulk-select-visible'
        );
    }

    const callbacksBulkMark = document.getElementById('callbacksBulkMarkBtn');
    if (callbacksBulkMark) {
        callbacksBulkMark.setAttribute('data-action', 'callbacks-bulk-mark');
    }
}

function attachLayoutListeners() {
    const menuToggle = qs('#adminMenuToggle');
    const menuClose = qs('#adminMenuClose');
    const backdrop = qs('#adminSidebarBackdrop');

    menuToggle?.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 1024px)').matches) {
            toggleSidebarOpen();
            return;
        }
        toggleSidebarCollapsed();
    });

    menuClose?.addEventListener('click', () => closeSidebar());
    backdrop?.addEventListener('click', () => closeSidebar());

    window.addEventListener('resize', () => {
        if (!window.matchMedia('(max-width: 1024px)').matches) {
            closeSidebar();
        }
    });

    window.addEventListener('hashchange', async () => {
        const section = readSectionFromHash(getState().ui.activeSection);
        await navigateToSection(section, { force: true });
    });

    window.addEventListener('storage', (event) => {
        if (event.key === 'themeMode') {
            setThemeMode(String(event.newValue || 'system'));
        }
    });
}

async function handleLoginSubmit(event) {
    event.preventDefault();

    const passwordInput = document.getElementById('adminPassword');
    const codeInput = document.getElementById('admin2FACode');

    const password =
        passwordInput instanceof HTMLInputElement ? passwordInput.value : '';
    const code = codeInput instanceof HTMLInputElement ? codeInput.value : '';

    try {
        const state = getState();
        if (state.auth.requires2FA) {
            await loginWith2FA(code);
        } else {
            const result = await loginWithPassword(password);
            if (result.requires2FA) {
                setLogin2FAVisibility(true);
                return;
            }
        }

        showDashboardView();
        setLogin2FAVisibility(false);
        await refreshDataAndRender(false);
        createToast('Sesion iniciada', 'success');
    } catch (error) {
        createToast(error?.message || 'No se pudo iniciar sesion', 'error');
    }
}

async function bootAuthenticatedUi() {
    showDashboardView();
    await refreshDataAndRender(false);
    setActiveSection(getState().ui.activeSection);
}

export async function bootAdminV2() {
    renderV2Shell();
    document.body.classList.add('admin-v2-mode');
    attachActionListeners();
    hydrateAppointmentPreferences();
    restoreUiPrefs();
    applyQueueRuntimeDefaults();

    const initialTheme = readThemeMode();
    setThemeMode(initialTheme);

    attachInputListeners();
    attachLayoutListeners();

    const loginForm = document.getElementById('loginForm');
    if (loginForm instanceof HTMLFormElement) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    attachKeyboardShortcuts({
        navigateToSection,
        focusQuickCommand,
        focusCurrentSearch,
        runQuickAction,
        closeSidebar,
        toggleMenu: () => {
            if (window.matchMedia('(max-width: 1024px)').matches) {
                toggleSidebarOpen();
                return;
            }
            toggleSidebarCollapsed();
        },
        dismissQueueSensitiveDialog,
        toggleQueueHelp: () => toggleQueueHelpPanel(),
        queueNumpadAction,
    });

    const authenticated = await checkAuthStatus();
    if (authenticated) {
        await bootAuthenticatedUi();
    } else {
        showLoginView();
    }

    initPushModule();

    window.setInterval(() => {
        refreshHeaderStatus();
    }, 30000);
}
