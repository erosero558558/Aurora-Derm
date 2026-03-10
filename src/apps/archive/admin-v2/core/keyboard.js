import { hasFocusedInput } from '../ui/render.js';
import { getState } from './store.js';

const SECTION_SHORTCUTS = {
    digit1: 'dashboard',
    digit2: 'appointments',
    digit3: 'callbacks',
    digit4: 'reviews',
    digit5: 'availability',
    digit6: 'queue',
};

export function attachKeyboardShortcuts(options) {
    const {
        navigateToSection,
        focusQuickCommand,
        focusCurrentSearch,
        runQuickAction,
        closeSidebar,
        toggleMenu,
        dismissQueueSensitiveDialog,
        toggleQueueHelp,
        queueNumpadAction,
    } = options;

    window.addEventListener('keydown', (event) => {
        const key = String(event.key || '').toLowerCase();
        const code = String(event.code || '').toLowerCase();

        if (event.key === 'Escape') {
            if (
                typeof dismissQueueSensitiveDialog === 'function' &&
                dismissQueueSensitiveDialog()
            ) {
                return;
            }
            closeSidebar();
            return;
        }

        if (event.ctrlKey && !event.shiftKey && !event.altKey && key === 'k') {
            event.preventDefault();
            focusQuickCommand();
            return;
        }

        if (!event.ctrlKey && !event.metaKey && !event.altKey && key === '/') {
            event.preventDefault();
            focusCurrentSearch();
            return;
        }

        if (
            event.altKey &&
            event.shiftKey &&
            !event.ctrlKey &&
            !event.metaKey
        ) {
            const normalized = code || key;

            if (normalized === 'keym') {
                event.preventDefault();
                toggleMenu();
                return;
            }

            if (normalized === 'digit0') {
                event.preventDefault();
                toggleQueueHelp();
                return;
            }

            if (SECTION_SHORTCUTS[normalized]) {
                if (hasFocusedInput()) return;
                event.preventDefault();
                navigateToSection(SECTION_SHORTCUTS[normalized]);
                return;
            }

            const quickActions = {
                keyt: 'appointments_pending_transfer',
                keya: 'appointments_all',
                keyn: 'appointments_no_show',
                keyp: 'callbacks_pending',
                keyc: 'callbacks_contacted',
                keyu: 'callbacks_sla_urgent',
                keyw: 'queue_sla_risk',
                keyl: 'queue_call_next',
            };

            const activeSection = getState().ui.activeSection;
            if (activeSection === 'queue') {
                Object.assign(quickActions, {
                    keyw: 'queue_waiting',
                    keyc: 'queue_called',
                    keya: 'queue_all',
                    keyo: 'queue_all',
                    keyl: 'queue_sla_risk',
                });
            }

            if (quickActions[normalized]) {
                if (hasFocusedInput()) return;
                event.preventDefault();
                runQuickAction(quickActions[normalized]);
                return;
            }
        }

        const queueState = getState().queue;
        const isCaptureMode = Boolean(queueState.captureCallKeyMode);
        const customCallKey = queueState.customCallKey;
        const matchesCustomCallKey =
            customCallKey &&
            typeof customCallKey === 'object' &&
            String(customCallKey.key || '') === String(event.key || '') &&
            String(customCallKey.code || '').toLowerCase() === code &&
            Number(customCallKey.location || 0) === Number(event.location || 0);
        const isNumpad =
            code.startsWith('numpad') ||
            event.location === 3 ||
            ['kpenter', 'kpadd', 'kpsubtract', 'kpdecimal'].includes(code);

        if (isNumpad || isCaptureMode || matchesCustomCallKey) {
            if (hasFocusedInput()) return;
            Promise.resolve(
                queueNumpadAction({
                    key: event.key,
                    code: event.code,
                    location: event.location,
                })
            ).catch(() => {
                // handled by queue module toasts/activity when relevant
            });
        }
    });
}
