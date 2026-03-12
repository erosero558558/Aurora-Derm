import { attachKeyboardShortcuts } from '../shared/core/keyboard.js';
import { getState } from '../shared/core/store.js';
import { checkAuthStatus } from '../shared/modules/auth.js';
import {
    hideCommandPalette,
    renderV3Frame,
    setActiveSection,
    showLoginView,
} from '../ui/frame.js';
import { bindFrameHooks } from '../ui/dom.js';
import { hydrateAppointmentPreferences } from '../sections/appointments.js';
import { hydrateCallbacksPreferences } from '../sections/callbacks.js';
import { hydrateAvailabilityPreferences } from '../sections/availability.js';
import {
    applyQueueRuntimeDefaults,
    initQueueAutoRefresh,
    queueNumpadAction,
    toggleQueueHelpPanel,
} from '../shared/modules/queue.js';
import { initPushModule } from '../shared/modules/push.js';
import {
    bootAuthenticatedUi,
    handleLoginSubmit,
    primeLoginSurface,
} from './boot/auth.js';
import {
    attachActionListeners,
    attachExitGuards,
    attachInputListeners,
    attachLayoutListeners,
    dismissQueueSensitiveDialog,
} from './boot/listeners.js';
import {
    closeSidebar,
    focusCurrentSearch,
    focusQuickCommand,
    isCompactViewport,
    navigateToSection,
    runQuickAction,
    toggleSidebarCollapsed,
    toggleSidebarOpen,
} from './boot/navigation.js';
import { refreshHeaderStatus } from './boot/rendering.js';
import {
    readInitialThemeMode,
    restoreUiPrefs,
    setThemeMode,
} from './boot/ui-prefs.js';

export async function bootAdminV3() {
    renderV3Frame();
    bindFrameHooks();
    document.body.classList.add('admin-v3-mode');
    document.body.classList.remove('admin-v2-mode');
    attachActionListeners();
    hydrateAppointmentPreferences();
    hydrateCallbacksPreferences();
    hydrateAvailabilityPreferences();
    restoreUiPrefs();
    applyQueueRuntimeDefaults();

    const initialTheme = readInitialThemeMode();
    setThemeMode(initialTheme);
    primeLoginSurface();

    attachInputListeners();
    attachLayoutListeners();
    attachExitGuards();

    const loginForm = document.getElementById('loginForm');
    if (loginForm instanceof HTMLFormElement) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    attachKeyboardShortcuts({
        navigateToSection,
        focusQuickCommand,
        focusCurrentSearch,
        runQuickAction,
        closeSidebar: () => closeSidebar({ restoreFocus: true }),
        toggleMenu: () => {
            if (isCompactViewport()) {
                toggleSidebarOpen();
                return;
            }
            toggleSidebarCollapsed();
        },
        dismissQueueSensitiveDialog,
        toggleQueueHelp: () => toggleQueueHelpPanel(),
        queueNumpadAction,
    });

    const auth = await checkAuthStatus();
    if (auth.authenticated) {
        await bootAuthenticatedUi();
        setActiveSection(getState().ui.activeSection);
    } else {
        showLoginView();
        hideCommandPalette();
        primeLoginSurface(auth);
    }

    initQueueAutoRefresh();
    initPushModule();

    window.setInterval(() => {
        refreshHeaderStatus();
    }, 30000);
}
