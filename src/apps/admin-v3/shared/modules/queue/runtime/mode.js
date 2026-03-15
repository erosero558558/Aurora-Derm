import { getState } from '../../../core/store.js';
import { createToast } from '../../../ui/render.js';
import { normalize } from '../helpers.js';
import { appendActivity, updateQueueUi } from '../state.js';
import {
    notifyAdminQueuePilotBlocked,
    shouldBlockAdminQueueAction,
} from '../pilot-guard.js';

export function toggleQueueHelpPanel() {
    updateQueueUi({ helpOpen: !getState().queue.helpOpen });
}

export function toggleQueueOneTap() {
    if (shouldBlockAdminQueueAction('queue-toggle-one-tap')) {
        notifyAdminQueuePilotBlocked('queue-toggle-one-tap');
        return;
    }
    updateQueueUi({ oneTap: !getState().queue.oneTap });
}

export function setQueuePracticeMode(enabled) {
    const isPracticeEnabled = !!enabled;
    if (
        shouldBlockAdminQueueAction(
            isPracticeEnabled ? 'queue-start-practice' : 'queue-stop-practice'
        )
    ) {
        notifyAdminQueuePilotBlocked(
            isPracticeEnabled ? 'queue-start-practice' : 'queue-stop-practice'
        );
        return;
    }
    updateQueueUi({
        practiceMode: isPracticeEnabled,
        pendingSensitiveAction: null,
    });
    appendActivity(
        isPracticeEnabled ? 'Modo practica activo' : 'Modo practica desactivado'
    );
}

export function setQueueStationLock(consultorio) {
    if (shouldBlockAdminQueueAction('queue-lock-station')) {
        notifyAdminQueuePilotBlocked('queue-lock-station');
        return;
    }
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    updateQueueUi({ stationMode: 'locked', stationConsultorio: target });
    appendActivity(`Estacion bloqueada en C${target}`);
}

export function setQueueStationMode(mode) {
    if (shouldBlockAdminQueueAction('queue-set-station-mode')) {
        notifyAdminQueuePilotBlocked('queue-set-station-mode');
        return;
    }
    const normalizedMode = normalize(mode);
    if (normalizedMode === 'free') {
        updateQueueUi({ stationMode: 'free' });
        appendActivity('Estacion en modo libre');
        return;
    }
    updateQueueUi({ stationMode: 'locked' });
}

export function beginQueueCallKeyCapture() {
    if (shouldBlockAdminQueueAction('queue-capture-call-key')) {
        notifyAdminQueuePilotBlocked('queue-capture-call-key');
        return;
    }
    updateQueueUi({ captureCallKeyMode: true });
    createToast('Calibración activa: presiona la tecla externa', 'info');
}

export function clearQueueCallKeyBinding() {
    if (shouldBlockAdminQueueAction('queue-clear-call-key')) {
        notifyAdminQueuePilotBlocked('queue-clear-call-key');
        return;
    }
    const confirmed = window.confirm('¿Quitar tecla externa calibrada?');
    if (!confirmed) return;
    updateQueueUi({ customCallKey: null, captureCallKeyMode: false });
    createToast('Tecla externa eliminada', 'success');
}
