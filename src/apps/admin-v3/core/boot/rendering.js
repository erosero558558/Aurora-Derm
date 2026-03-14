import { getState } from '../../shared/core/store.js';
import { renderAgentPanel } from '../../shared/modules/agent.js';
import { createToast, setText } from '../../shared/ui/render.js';
import {
    refreshAdminData,
    refreshStatusLabel,
} from '../../shared/modules/data.js';
import { renderAppointmentsSection } from '../../sections/appointments.js';
import { renderCallbacksSection } from '../../sections/callbacks.js';
import { renderClinicalHistorySection } from '../../sections/clinical-history.js';
import {
    renderAvailabilitySection,
    syncAvailabilityFromData,
} from '../../sections/availability.js';
import { renderDashboard } from '../../sections/dashboard.js';
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
    renderAvailabilitySection();
    refreshHeaderStatus();
    renderAgentPanel();
}

export async function refreshDataAndRender(showToast = false) {
    const result = await refreshAdminData();
    const ok = Boolean(result?.ok);
    syncAvailabilityFromData();
    renderAllSections();
    if (showToast) {
        createToast(
            ok ? 'Datos actualizados' : 'Datos cargados desde cache local',
            ok ? 'success' : 'warning'
        );
    }
    return ok;
}
