export const SECTION_SHORTCUTS = Object.freeze({
    digit1: 'dashboard',
    digit2: 'appointments',
    digit3: 'callbacks',
    digit4: 'reviews',
    digit5: 'availability',
    digit6: 'queue',
});

export const DEFAULT_QUICK_ACTIONS = Object.freeze({
    keyt: 'appointments_pending_transfer',
    keya: 'appointments_all',
    keyn: 'appointments_no_show',
    keyp: 'callbacks_pending',
    keyc: 'callbacks_contacted',
    keyu: 'callbacks_sla_urgent',
    keyw: 'queue_sla_risk',
    keyl: 'queue_call_next',
});

export const QUEUE_QUICK_ACTION_OVERRIDES = Object.freeze({
    keyw: 'queue_waiting',
    keyc: 'queue_called',
    keya: 'queue_all',
    keyo: 'queue_all',
    keyl: 'queue_sla_risk',
});
