import {
    normalizeSection,
    setSectionHash,
} from '../../../shared/core/router.js';
import { getState, updateState } from '../../../shared/core/store.js';
import {
    applyQueueRuntimeDefaults,
    hydrateQueueFromData,
    shouldRefreshQueueOnSectionEnter,
    syncQueueAutoRefresh,
} from '../../../shared/modules/queue.js';
import { renderAdminChrome, setActiveSection } from '../../../ui/frame.js';
import { hasPendingAvailabilityChanges } from '../../../sections/availability.js';
import { openClinicalHistorySession } from '../../../sections/clinical-history.js';
import {
    persistUiPrefs,
    readInitialThemeMode,
    setThemeMode,
} from '../ui-prefs.js';

function syncAdminThemeForSection(section) {
    const normalized = normalizeSection(section, 'dashboard');
    const nextTheme =
        normalized === 'queue' ? 'system' : readInitialThemeMode();
    setThemeMode(nextTheme, { persist: false });
}

export function showSection(section) {
    const normalized = normalizeSection(section, 'dashboard');
    updateState((state) => ({
        ...state,
        ui: {
            ...state.ui,
            activeSection: normalized,
        },
    }));
    setActiveSection(normalized);
    syncAdminThemeForSection(normalized);
    renderAdminChrome(getState());
    setSectionHash(normalized);
    persistUiPrefs();
}

function shouldConfirmAvailabilityExit(targetSection, force) {
    return (
        !force &&
        getState().ui.activeSection === 'availability' &&
        targetSection !== 'availability' &&
        hasPendingAvailabilityChanges()
    );
}

export async function navigateToSection(section, options = {}) {
    const normalized = normalizeSection(section, 'dashboard');
    const { force = false } = options;
    const previousSection = getState().ui.activeSection;

    if (shouldConfirmAvailabilityExit(normalized, force)) {
        const confirmed = window.confirm(
            'Hay cambios pendientes en disponibilidad. ¿Deseas salir sin guardar?'
        );
        if (!confirmed) return false;
    }

    showSection(normalized);
    if (normalized === 'clinical-history') {
        await openClinicalHistorySession();
    }
    if (normalized === 'queue') {
        applyQueueRuntimeDefaults();
        await hydrateQueueFromData();
    }

    syncQueueAutoRefresh({
        immediate: normalized === 'queue' && shouldRefreshQueueOnSectionEnter(),
        reason:
            normalized === 'queue'
                ? previousSection === 'queue'
                    ? 'queue-section-refresh'
                    : 'queue-section-enter'
                : 'queue-section-leave',
    });

    return true;
}
