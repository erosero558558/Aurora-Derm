import {
    normalizeSection,
    setSectionHash,
} from '../../../shared/core/router.js';
import { getState, updateState } from '../../../shared/core/store.js';
import { renderAdminChrome, setActiveSection } from '../../../ui/frame.js';
import { hasPendingAvailabilityChanges } from '../../../sections/availability.js';
import {
    refreshQueueState,
    syncQueueAutoRefresh,
    shouldRefreshQueueOnSectionEnter,
} from '../../../shared/modules/queue.js';
import { persistUiPrefs } from '../ui-prefs.js';

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
    syncQueueAutoRefresh({
        immediate: normalized === 'queue',
        reason: normalized === 'queue' ? 'section-enter' : 'section-exit',
    });
    if (
        normalized === 'queue' &&
        previousSection !== 'queue' &&
        shouldRefreshQueueOnSectionEnter()
    ) {
        await refreshQueueState();
    }

    return true;
}
