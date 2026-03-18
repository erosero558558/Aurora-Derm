import {
    humanizeToken,
    normalize,
    normalizeAppointmentStatus,
    normalizePaymentStatus,
} from './core.js';

const PAYMENT_METHOD_LABELS = Object.freeze({
    transfer: 'Transferencia',
    cash: 'Consultorio',
    card: 'Tarjeta',
    gateway: 'Pasarela',
});

const PAYMENT_LABELS = Object.freeze({
    pending_transfer_review: 'Validar pago',
    pending_transfer: 'Transferencia',
    pending_cash: 'Pago en consultorio',
    pending_gateway: 'Pago en proceso',
    paid: 'Pagado',
    failed: 'Fallido',
});

const STATUS_LABELS = Object.freeze({
    confirmed: 'Confirmada',
    pending: 'Pendiente',
    completed: 'Completada',
    cancelled: 'Cancelada',
    no_show: 'No show',
});

const PAYMENT_TONES = Object.freeze({
    paid: 'success',
    failed: 'danger',
    pending_cash: 'neutral',
});

const STATUS_TONES = Object.freeze({
    completed: 'success',
    cancelled: 'danger',
    no_show: 'danger',
    pending: 'warning',
});

function labelOrHumanized(labels, value, fallback) {
    return labels[normalize(value)] || humanizeToken(value, fallback);
}

export function paymentMethodLabel(method) {
    return labelOrHumanized(PAYMENT_METHOD_LABELS, method, 'Metodo pendiente');
}

export function paymentLabel(status) {
    return labelOrHumanized(PAYMENT_LABELS, status, 'Pendiente');
}

export function statusLabel(status) {
    return labelOrHumanized(STATUS_LABELS, status, 'Pendiente');
}

export function paymentTone(status) {
    return PAYMENT_TONES[normalize(status)] || 'warning';
}

export function statusTone(status) {
    return STATUS_TONES[normalize(status)] || 'neutral';
}

export function isTriageAttention(item) {
    const paymentStatus = normalizePaymentStatus(item);
    const appointmentStatus = normalizeAppointmentStatus(item.status);

    return (
        paymentStatus === 'pending_transfer_review' ||
        paymentStatus === 'pending_transfer' ||
        appointmentStatus === 'no_show' ||
        appointmentStatus === 'cancelled'
    );
}
