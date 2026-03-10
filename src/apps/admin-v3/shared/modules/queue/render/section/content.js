import { escapeHtml, setHtml } from '../../../../ui/render.js';
import { asArray } from '../../helpers.js';
import { queueRow } from '../rows.js';

export function renderQueueTableBody(visible) {
    setHtml(
        '#queueTableBody',
        visible.length
            ? visible.map(queueRow).join('')
            : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
    );
}

export function renderQueueNextAdminList(queueMeta, fallbackPartial) {
    const nextTickets = asArray(queueMeta.nextTickets);
    const waitingCount = Number(
        queueMeta.waitingCount || queueMeta.counts?.waiting || 0
    );
    const nextSummary =
        fallbackPartial &&
        nextTickets.length &&
        waitingCount > nextTickets.length
            ? `<li><span>-</span><strong>Mostrando primeros ${nextTickets.length} de ${waitingCount} en espera</strong></li>`
            : '';

    setHtml(
        '#queueNextAdminList',
        nextTickets.length
            ? `${nextSummary}${nextTickets
                  .map(
                      (ticket) =>
                          `<li><span>${escapeHtml(ticket.ticketCode || ticket.ticket_code || '--')}</span><strong>${escapeHtml(
                              ticket.patientInitials ||
                                  ticket.patient_initials ||
                                  '--'
                          )}</strong></li>`
                  )
                  .join('')}`
            : '<li><span>-</span><strong>Sin siguientes</strong></li>'
    );
}
