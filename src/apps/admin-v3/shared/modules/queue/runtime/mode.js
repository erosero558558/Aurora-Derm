import { getState } from '../../../core/store.js';
import { createToast } from '../../../ui/render.js';
import { normalize } from '../helpers.js';
import { appendActivity, updateQueueUi } from '../state.js';

export function toggleQueueHelpPanel() {
    updateQueueUi({ helpOpen: !getState().queue.helpOpen });
}

export function toggleQueueOneTap() {
    updateQueueUi({ oneTap: !getState().queue.oneTap });
}

export function setQueuePracticeMode(enabled) {
    const practiceMode = Boolean(enabled);
    updateQueueUi({ practiceMode, pendingSensitiveAction: null });
    appendActivity(
        practiceMode ? 'Modo practica activo' : 'Modo practica desactivado'
    );
}

export function setQueueStationLock(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    updateQueueUi({ stationMode: 'locked', stationConsultorio: target });
    appendActivity(`Estacion bloqueada en C${target}`);
}

export function setQueueStationMode(mode) {
    const normalizedMode = normalize(mode);
    if (normalizedMode === 'free') {
        updateQueueUi({ stationMode: 'free' });
        appendActivity('Estacion en modo libre');
        return;
    }
    updateQueueUi({ stationMode: 'locked' });
}

export function beginQueueCallKeyCapture() {
    updateQueueUi({ captureCallKeyMode: true });
    createToast('Calibración activa: presiona la tecla externa', 'info');
}

export function clearQueueCallKeyBinding() {
    const confirmed = window.confirm('¿Quitar tecla externa calibrada?');
    if (!confirmed) return;
    updateQueueUi({ customCallKey: null, captureCallKeyMode: false });
    createToast('Tecla externa eliminada', 'success');
}
