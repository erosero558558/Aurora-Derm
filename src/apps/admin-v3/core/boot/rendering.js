import { getState } from '../../shared/core/store.js';
import { renderAgentPanel } from '../../shared/modules/agent.js';
import { createToast, setText } from '../../shared/ui/render.js';
import {
    refreshAdminData,
    refreshStatusLabel,
} from '../../shared/modules/data.js';
import {
    applyQueueRuntimeDefaults,
    hydrateQueueFromData,
    initQueueAutoRefresh,
    renderQueueSection as renderQueuePilotSection,
    syncQueueAutoRefresh,
} from '../../shared/modules/queue.js';
import { appendActivity as appendQueueActivity } from '../../shared/modules/queue/state.js';
import { renderAppointmentsSection } from '../../sections/appointments.js';
import { renderCallbacksSection } from '../../sections/callbacks.js';
import { renderClinicalHistorySection } from '../../sections/clinical-history.js';
import {
    renderAvailabilitySection,
    syncAvailabilityFromData,
} from '../../sections/availability.js';
import { renderDashboard } from '../../sections/dashboard.js';
import { renderReviewsSection } from '../../sections/reviews.js';
import { renderAdminChrome } from '../../ui/frame.js';

export function refreshHeaderStatus() {
    const label = refreshStatusLabel();
    setText('#adminRefreshStatus', label);
    setText(
        '#adminSyncState',
        label === 'Datos: sin sincronizar'
            ? 'Listo para primera sincronizacion'
            : label.replace('Datos: ', 'Estado: ')
    );
}

export function renderAllSections() {
    renderAdminChrome(getState());
    renderDashboard(getState());
    renderClinicalHistorySection();
    renderAppointmentsSection();
    renderCallbacksSection();
    renderReviewsSection();
    renderAvailabilitySection();
    renderQueuePilotSection(appendQueueActivity);
    refreshHeaderStatus();
    renderAgentPanel();
}

export async function refreshDataAndRender(showToast = false) {
    const result = await refreshAdminData();
    const ok = Boolean(result?.ok);
    const queueSectionActive = getState().ui.activeSection === 'queue';
    syncAvailabilityFromData();
    if (queueSectionActive) {
        applyQueueRuntimeDefaults();
    }
    if (queueSectionActive || !result?.preservedQueueData) {
        await hydrateQueueFromData();
    }
    renderAllSections();
    initQueueAutoRefresh();
    syncQueueAutoRefresh({
        immediate: queueSectionActive,
        reason: 'admin-data-refresh',
    });
    if (showToast) {
        createToast(
            ok ? 'Datos actualizados' : 'Datos cargados desde cache local',
            ok ? 'success' : 'warning'
        );
    }
    return ok;
}
