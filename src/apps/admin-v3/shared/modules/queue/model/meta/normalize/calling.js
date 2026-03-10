import { normalizeMetaTicket } from '../../normalizers.js';

function resolveCallingTicket(callingByConsultorio, callingNowList, slot) {
    return (
        callingByConsultorio[String(slot)] ||
        callingByConsultorio[slot] ||
        callingNowList.find(
            (item) =>
                Number(
                    item?.assignedConsultorio || item?.assigned_consultorio || 0
                ) === slot
        ) ||
        null
    );
}

function normalizeCallingTicket(rawTicket, index, assignedConsultorio) {
    return rawTicket
        ? normalizeMetaTicket(rawTicket, index, {
              status: 'called',
              assignedConsultorio,
          })
        : null;
}

export function resolveCallingSlots(callingByConsultorio, callingNowList) {
    const c1 = normalizeCallingTicket(
        resolveCallingTicket(callingByConsultorio, callingNowList, 1),
        0,
        1
    );
    const c2 = normalizeCallingTicket(
        resolveCallingTicket(callingByConsultorio, callingNowList, 2),
        1,
        2
    );

    return { c1, c2 };
}
