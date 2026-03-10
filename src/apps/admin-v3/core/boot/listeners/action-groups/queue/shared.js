export function queueConsultorio(element, fallback = 0) {
    return Number(element?.dataset?.queueConsultorio || fallback);
}

export function queueId(element, fallback = 0) {
    return Number(element?.dataset?.queueId || fallback);
}

export function queueActionName(element, fallback = '') {
    return String(element?.dataset?.queueAction || fallback);
}
