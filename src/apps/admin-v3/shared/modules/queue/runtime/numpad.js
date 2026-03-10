import { getState } from '../../../core/store.js';
import { createToast } from '../../../ui/render.js';
import {
    callNextForConsultorio,
    confirmQueueSensitiveAction,
    runQueueTicketAction,
} from '../actions.js';
import { normalize } from '../helpers.js';
import { showSensitiveConfirm } from '../render.js';
import { getActiveCalledTicketForStation } from '../selectors.js';
import { appendActivity, updateQueueUi } from '../state.js';

function eventMatchesBinding(eventInfo, binding) {
    if (!binding || typeof binding !== 'object') return false;
    return (
        normalize(binding.code) === normalize(eventInfo.code) &&
        String(binding.key || '') === String(eventInfo.key || '') &&
        Number(binding.location || 0) === Number(eventInfo.location || 0)
    );
}

function isLockedOut(target, state) {
    return (
        state.queue.stationMode === 'locked' &&
        state.queue.stationConsultorio !== target
    );
}

function notifyBlockedStationChange() {
    createToast('Cambio bloqueado por modo estación', 'warning');
    appendActivity('Cambio de estación bloqueado por lock');
}

function captureExternalCallKey(eventInfo) {
    const binding = {
        key: String(eventInfo.key || ''),
        code: String(eventInfo.code || ''),
        location: Number(eventInfo.location || 0),
    };
    updateQueueUi({
        customCallKey: binding,
        captureCallKeyMode: false,
    });
    createToast('Tecla externa guardada', 'success');
    appendActivity(`Tecla externa calibrada: ${binding.code}`);
}

function stationKeyTarget(code, key) {
    if (code === 'numpad2' || key === '2') return 2;
    if (code === 'numpad1' || key === '1') return 1;
    return 0;
}

function setStationFromNumpad(target, state) {
    if (isLockedOut(target, state)) {
        notifyBlockedStationChange();
        return true;
    }
    updateQueueUi({ stationConsultorio: target });
    appendActivity(`Numpad: estacion C${target}`);
    return true;
}

function completeActiveTicketPrompt(state) {
    const activeCalled = getActiveCalledTicketForStation();
    if (!activeCalled) return false;
    showSensitiveConfirm({
        ticketId: activeCalled.id,
        action: 'completar',
        consultorio: state.queue.stationConsultorio,
    });
    return true;
}

function noShowActiveTicketPrompt(state) {
    const activeCalled = getActiveCalledTicketForStation();
    if (!activeCalled) return false;
    showSensitiveConfirm({
        ticketId: activeCalled.id,
        action: 'no_show',
        consultorio: state.queue.stationConsultorio,
    });
    return true;
}

async function reCallActiveTicket(state) {
    const activeCalled = getActiveCalledTicketForStation();
    if (!activeCalled) return;
    await runQueueTicketAction(
        activeCalled.id,
        're-llamar',
        state.queue.stationConsultorio
    );
    appendActivity(`Re-llamar ${activeCalled.ticketCode}`);
    createToast(`Re-llamar ${activeCalled.ticketCode}`, 'info');
}

export async function queueNumpadAction(eventInfo) {
    const state = getState();

    if (state.queue.captureCallKeyMode) {
        captureExternalCallKey(eventInfo);
        return;
    }

    if (eventMatchesBinding(eventInfo, state.queue.customCallKey)) {
        await callNextForConsultorio(state.queue.stationConsultorio);
        return;
    }

    const code = normalize(eventInfo.code);
    const key = normalize(eventInfo.key);
    const isEnter =
        code === 'numpadenter' ||
        code === 'kpenter' ||
        (key === 'enter' && Number(eventInfo.location || 0) === 3);

    if (isEnter && state.queue.pendingSensitiveAction) {
        await confirmQueueSensitiveAction();
        return;
    }

    const target = stationKeyTarget(code, key);
    if (target) {
        setStationFromNumpad(target, state);
        return;
    }

    if (isEnter) {
        if (state.queue.oneTap && completeActiveTicketPrompt(state)) {
            await confirmQueueSensitiveAction();
        }
        await callNextForConsultorio(state.queue.stationConsultorio);
        return;
    }

    const isDecimal =
        code === 'numpaddecimal' ||
        code === 'kpdecimal' ||
        key === 'decimal' ||
        key === ',' ||
        key === '.';
    if (isDecimal) {
        completeActiveTicketPrompt(state);
        return;
    }

    const isSubtract =
        code === 'numpadsubtract' || code === 'kpsubtract' || key === '-';
    if (isSubtract) {
        noShowActiveTicketPrompt(state);
        return;
    }

    const isAdd = code === 'numpadadd' || code === 'kpadd' || key === '+';
    if (isAdd) {
        await reCallActiveTicket(state);
    }
}
