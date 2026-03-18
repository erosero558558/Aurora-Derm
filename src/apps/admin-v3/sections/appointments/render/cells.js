import { escapeHtml } from '../../../shared/ui/render.js';
import { appointmentPriority } from '../selectors.js';
import {
    humanizeToken,
    normalizeAppointmentStatus,
    normalizePaymentStatus,
    paymentLabel,
    paymentMethodLabel,
    paymentTone,
    statusLabel,
    statusTone,
    whatsappLink,
} from '../utils.js';

const TRANSFER_REVIEW_PAYMENT_STATUSES = new Set([
    'pending_transfer_review',
    'pending_transfer',
]);

function buildStatusNotes(status, paymentStatus, priorityNote) {
    if (paymentStatus === 'pending_transfer_review') {
        return 'Transferencia por validar';
    }
    if (status === 'no_show') {
        return 'Paciente ausente';
    }
    if (status === 'cancelled') {
        return 'Cita cerrada';
    }

    return priorityNote;
}

function buildAppointmentPillStack(className, tone, label, detailsHtml) {
    return `
        <div class="${escapeHtml(className)}">
            <span class="appointment-pill" data-tone="${escapeHtml(tone)}">${escapeHtml(label)}</span>
            ${detailsHtml}
        </div>
    `;
}

function buildActionLink(href, label, itemName) {
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" aria-label="WhatsApp de ${escapeHtml(itemName || 'Paciente')}" title="WhatsApp para seguimiento">${escapeHtml(label)}</a>`;
}

function buildActionButton(label, action, id) {
    return `<button type="button" data-action="${escapeHtml(action)}" data-id="${id}">${escapeHtml(label)}</button>`;
}

function buildRowActions(item, paymentStatus, phoneHref) {
    const id = Number(item.id || 0);
    const actions = [];

    if (phoneHref) {
        actions.push(buildActionLink(phoneHref, 'WhatsApp', item.name));
    }

    if (TRANSFER_REVIEW_PAYMENT_STATUSES.has(paymentStatus)) {
        actions.push(buildActionButton('Aprobar', 'approve-transfer', id));
        actions.push(buildActionButton('Rechazar', 'reject-transfer', id));
    }

    actions.push(buildActionButton('No show', 'mark-no-show', id));
    actions.push(buildActionButton('Cancelar', 'cancel-appointment', id));

    return actions.join('');
}

export function paymentCell(item) {
    const paymentStatus = item.paymentStatus || item.payment_status || '';
    const proofUrl = String(
        item.transferProofUrl ||
            item.transferProofURL ||
            item.transfer_proof_url ||
            ''
    ).trim();

    return buildAppointmentPillStack(
        'appointment-payment-stack',
        paymentTone(paymentStatus),
        paymentLabel(paymentStatus),
        `
            <small>Metodo: ${escapeHtml(paymentMethodLabel(item.paymentMethod || item.payment_method || ''))}</small>
            ${
                proofUrl
                    ? `<a href="${escapeHtml(proofUrl)}" target="_blank" rel="noopener">Ver comprobante</a>`
                    : '<small>Sin comprobante adjunto</small>'
            }
        `
    );
}

export function statusCell(item) {
    const status = normalizeAppointmentStatus(item.status);
    const paymentStatus = normalizePaymentStatus(item);
    const priority = appointmentPriority(item);
    const note = buildStatusNotes(status, paymentStatus, priority.note);

    return buildAppointmentPillStack(
        'appointment-status-stack',
        statusTone(status),
        statusLabel(status),
        `<small>${escapeHtml(note)}</small>`
    );
}

export function rowActions(item) {
    const paymentStatus = normalizePaymentStatus(item);
    const phoneHref = whatsappLink(item.phone || '');
    return `<div class="table-actions">${buildRowActions(
        item,
        paymentStatus,
        phoneHref
    )}</div>`;
}

export function serviceCell(item) {
    const priority = appointmentPriority(item);

    return `
        <div class="appointment-service">
            <strong>${escapeHtml(humanizeToken(item.service, 'Servicio pendiente'))}</strong>
            <span>Especialista: ${escapeHtml(humanizeToken(item.doctor, 'Sin asignar'))}</span>
            <small>${escapeHtml(priority.label)} | ${escapeHtml(priority.note)}</small>
        </div>
    `;
}
