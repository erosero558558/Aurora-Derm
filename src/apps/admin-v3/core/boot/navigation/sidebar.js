import { getState, updateState } from '../../../shared/core/store.js';
import { qs } from '../../../shared/ui/render.js';
import { hideCommandPalette, showCommandPalette } from '../../../ui/frame.js';
import {
    isCompactViewport,
    persistUiPrefs,
    renderSidebarState,
} from '../ui-prefs.js';

function updateUiState(patch) {
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            ...patch(state.ui),
        },
    }));
}

export function toggleSidebarCollapsed() {
    updateUiState((ui) => ({
        sidebarCollapsed: !ui.sidebarCollapsed,
        sidebarOpen: ui.sidebarOpen,
    }));

    renderSidebarState();
    persistUiPrefs();
}

export function toggleSidebarOpen() {
    updateUiState((ui) => ({
        sidebarOpen: !ui.sidebarOpen,
    }));

    renderSidebarState();
}

export function closeSidebar({ restoreFocus = false } = {}) {
    updateUiState(() => ({
        sidebarOpen: false,
    }));

    renderSidebarState();
    hideCommandPalette();

    if (restoreFocus) {
        const toggle = qs('#adminMenuToggle');
        if (toggle instanceof HTMLElement) {
            toggle.focus();
        }
    }
}

export function focusQuickCommand() {
    showCommandPalette();
    const input = document.getElementById('adminQuickCommand');
    if (input instanceof HTMLInputElement) input.focus();
}

export function focusCurrentSearch() {
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

export { isCompactViewport };
