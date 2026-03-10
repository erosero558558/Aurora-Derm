export function getEventKeyData(event) {
    return {
        key: String(event.key || '').toLowerCase(),
        code: String(event.code || '').toLowerCase(),
    };
}

export function isAltShiftShortcut(event) {
    return event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey;
}

export function resolveNormalizedShortcut({ key, code }) {
    return code || key;
}

export function isNumpadEvent(event, code) {
    return (
        code.startsWith('numpad') ||
        event.location === 3 ||
        ['kpenter', 'kpadd', 'kpsubtract', 'kpdecimal'].includes(code)
    );
}

export function matchesCustomCallKey(queueState, event, code) {
    const customCallKey = queueState.customCallKey;
    return Boolean(
        customCallKey &&
        typeof customCallKey === 'object' &&
        String(customCallKey.key || '') === String(event.key || '') &&
        String(customCallKey.code || '').toLowerCase() === code &&
        Number(customCallKey.location || 0) === Number(event.location || 0)
    );
}
