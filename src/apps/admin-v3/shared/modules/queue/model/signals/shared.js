export function hasOwnField(record, field) {
    return Object.prototype.hasOwnProperty.call(record || {}, field);
}

export function getQueueSignalCounts(queueState) {
    return queueState?.counts && typeof queueState.counts === 'object'
        ? queueState.counts
        : null;
}

export function getCallingNowByConsultorio(queueState) {
    if (
        queueState?.callingNowByConsultorio &&
        typeof queueState.callingNowByConsultorio === 'object'
    ) {
        return queueState.callingNowByConsultorio;
    }
    if (
        queueState?.calling_now_by_consultorio &&
        typeof queueState.calling_now_by_consultorio === 'object'
    ) {
        return queueState.calling_now_by_consultorio;
    }
    return null;
}
