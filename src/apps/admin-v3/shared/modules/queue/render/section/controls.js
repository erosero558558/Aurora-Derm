import { setText } from '../../../../ui/render.js';
import { getCalledTicketForConsultorio } from '../../selectors.js';

export function syncQueueSelectionControls({
    visibleCount,
    selectedCount,
    bulkTargetCount,
}) {
    setText('#queueSelectedCount', selectedCount);

    const selectionChip = document.getElementById('queueSelectionChip');
    if (selectionChip instanceof HTMLElement) {
        selectionChip.classList.toggle('is-hidden', selectedCount === 0);
    }

    const selectVisibleBtn = document.getElementById('queueSelectVisibleBtn');
    if (selectVisibleBtn instanceof HTMLButtonElement) {
        selectVisibleBtn.disabled = visibleCount === 0;
    }

    const clearSelectionBtn = document.getElementById('queueClearSelectionBtn');
    if (clearSelectionBtn instanceof HTMLButtonElement) {
        clearSelectionBtn.disabled = selectedCount === 0;
    }

    document
        .querySelectorAll(
            '[data-action="queue-bulk-action"], [data-action="queue-bulk-reprint"]'
        )
        .forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) return;
            button.disabled = bulkTargetCount === 0;
        });
}

export function syncQueueStationControls(state, activeStationTicket) {
    setText(
        '#queueStationBadge',
        `Estación C${state.queue.stationConsultorio}`
    );
    setText(
        '#queueStationModeBadge',
        state.queue.stationMode === 'locked' ? 'Bloqueado' : 'Libre'
    );

    document
        .querySelectorAll(
            '[data-action="queue-call-next"][data-queue-consultorio]'
        )
        .forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) return;
            const target =
                Number(button.dataset.queueConsultorio || 1) === 2 ? 2 : 1;
            button.disabled =
                state.queue.stationMode === 'locked' &&
                target !== Number(state.queue.stationConsultorio || 1);
        });

    const releaseStationButtons = document.querySelectorAll(
        '[data-action="queue-release-station"][data-queue-consultorio]'
    );
    releaseStationButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const target =
            Number(button.dataset.queueConsultorio || 1) === 2 ? 2 : 1;
        const calledTicket =
            target === Number(state.queue.stationConsultorio || 1)
                ? activeStationTicket
                : getCalledTicketForConsultorio(target);
        button.disabled = !calledTicket;
        if (
            state.queue.stationMode === 'locked' &&
            target !== Number(state.queue.stationConsultorio || 1)
        ) {
            button.disabled = true;
        }
    });
}

export function syncQueueToggleControls(state) {
    const practiceBadge = document.getElementById('queuePracticeModeBadge');
    if (practiceBadge instanceof HTMLElement) {
        practiceBadge.hidden = !state.queue.practiceMode;
    }

    const shortcutPanel = document.getElementById('queueShortcutPanel');
    if (shortcutPanel instanceof HTMLElement) {
        shortcutPanel.hidden = !state.queue.helpOpen;
    }

    const clearKeyBtn = document.querySelector(
        '[data-action="queue-clear-call-key"]'
    );
    if (clearKeyBtn instanceof HTMLElement) {
        clearKeyBtn.hidden = !state.queue.customCallKey;
    }

    const oneTapBtn = document.querySelector(
        '[data-action="queue-toggle-one-tap"]'
    );
    if (oneTapBtn instanceof HTMLElement) {
        oneTapBtn.setAttribute(
            'aria-pressed',
            String(Boolean(state.queue.oneTap))
        );
        oneTapBtn.textContent = state.queue.oneTap
            ? '1 tecla ON'
            : '1 tecla OFF';
    }
}
