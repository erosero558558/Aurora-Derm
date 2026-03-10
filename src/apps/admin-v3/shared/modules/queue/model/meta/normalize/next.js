import { asArray } from '../../../helpers.js';
import { normalizeMetaTicket } from '../../normalizers.js';

export function normalizeNextTickets(meta) {
    return asArray(meta.nextTickets)
        .concat(asArray(meta.next_tickets))
        .map((item, index) =>
            normalizeMetaTicket(
                {
                    ...item,
                    status: item?.status || 'waiting',
                    assignedConsultorio: null,
                },
                index
            )
        );
}
