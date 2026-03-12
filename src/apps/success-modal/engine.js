'use strict';
// build-sync: 20260219-sync1

let deps = null;
let activeIcsUrl = '';

function getLang() {
    return deps && typeof deps.getCurrentLang === 'function' ? deps.getCurrentLang() : 'es';
}

function getAppointment() {
    if (deps && typeof deps.getCurrentAppointment === 'function') {
        return deps.getCurrentAppointment() || {};
    }
    return {};
}

function getClinicAddress() {
    if (deps && typeof deps.getClinicAddress === 'function') {
        return String(deps.getClinicAddress() || '');
    }
    return '';
}

function escapeHtml(value) {
    if (deps && typeof deps.escapeHtml === 'function') {
        return deps.escapeHtml(String(value || ''));
    }
    const div = document.createElement('div');
    div.textContent = String(value || '');
    return div.innerHTML;
}

function getDoctorName(doctor) {
    const names = {
        rosero: 'Dr. Javier Rosero',
        narvaez: 'Dra. Carolina Narvaez',
        indiferente: 'Cualquiera disponible'
    };
    return names[doctor] || doctor || '-';
}

function getPaymentMethodLabel(method) {
    const lang = getLang();
    const map = {
        card: lang === 'es' ? 'Tarjeta' : 'Card',
        transfer: lang === 'es' ? 'Transferencia' : 'Transfer',
        cash: lang === 'es' ? 'Efectivo' : 'Cash',
        unpaid: lang === 'es' ? 'Pendiente' : 'Pending'
    };
    const key = String(method || '').toLowerCase();
    return map[key] || (method || map.unpaid);
}

function getPaymentStatusLabel(status) {
    const es = {
        paid: 'Pagado',
        pending_cash: 'Pago en consultorio',
        pending_transfer_review: 'Comprobante en validacion',
        pending_transfer: 'Transferencia pendiente',
        pending_gateway: 'Procesando pago',
        pending: 'Pendiente',
        failed: 'Fallido'
    };
    const en = {
        paid: 'Paid',
        pending_cash: 'Pay at clinic',
        pending_transfer_review: 'Proof under review',
        pending_transfer: 'Transfer pending',
        pending_gateway: 'Processing payment',
        pending: 'Pending',
        failed: 'Failed'
    };
    const key = String(status || '').toLowerCase();
    const map = getLang() === 'es' ? es : en;
    return map[key] || (status || map.pending);
}

function getServiceName(service) {
    const names = {
        consulta: 'Consulta Dermatologica',
        telefono: 'Consulta Telefónica',
        video: 'Video Consulta',
        laser: 'Tratamiento Láser',
        rejuvenecimiento: 'Rejuvenecimiento'
    };
    return names[service] || service || '-';
}

function formatDateForGoogle(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function formatDateForIcs(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0];
}

function generateGoogleCalendarUrl(appointment, startDate, endDate) {
    const title = encodeURIComponent('Cita - Aurora Derm');
    const details = encodeURIComponent(
        `Servicio: ${getServiceName(appointment.service)}\nDoctor: ${getDoctorName(appointment.doctor)}\nPrecio: ${appointment.price || ''}`
    );
    const location = encodeURIComponent(getClinicAddress());

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}&details=${details}&location=${location}`;
}

function generateIcs(appointment, startDate, endDate) {
    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Aurora Derm//Consulta//ES
BEGIN:VEVENT
DTSTART:${formatDateForIcs(startDate)}
DTEND:${formatDateForIcs(endDate)}
SUMMARY:Cita - Aurora Derm
DESCRIPTION:Servicio: ${getServiceName(appointment.service)}\\nDoctor: ${getDoctorName(appointment.doctor)}\\nPrecio: ${appointment.price || ''}
LOCATION:${getClinicAddress()}
END:VEVENT
END:VCALENDAR`;
}

function cleanupIcsUrl() {
    if (activeIcsUrl) {
        URL.revokeObjectURL(activeIcsUrl);
        activeIcsUrl = '';
    }
}

function showSuccessModal(emailSent) {
    const modal = document.getElementById('successModal');
    if (!modal) return;

    const appointment = getAppointment();
    const detailsDiv = document.getElementById('appointmentDetails');
    const successDesc = modal.querySelector('[data-i18n="success_desc"]');
    const lang = getLang();

    if (successDesc) {
        if (emailSent) {
            successDesc.textContent = lang === 'es'
                ? 'Enviamos un correo de confirmacion con los detalles de tu cita.'
                : 'A confirmation email with your appointment details was sent.';
        } else {
            successDesc.textContent = lang === 'es'
                ? 'Tu cita fue registrada. Te contactaremos para confirmar detalles.'
                : 'Your appointment was saved. We will contact you to confirm details.';
        }
    }

    const rawStart = appointment.date && appointment.time
        ? new Date(`${appointment.date}T${appointment.time}`)
        : new Date();
    const startDate = Number.isNaN(rawStart.getTime()) ? new Date() : rawStart;
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const googleCalendarUrl = generateGoogleCalendarUrl(appointment, startDate, endDate);
    const icsContent = generateIcs(appointment, startDate, endDate);
    const icsBlob = new Blob([icsContent], { type: 'text/calendar' });

    cleanupIcsUrl();
    activeIcsUrl = URL.createObjectURL(icsBlob);

    if (detailsDiv) {
        detailsDiv.innerHTML = `
            <div class="success-details-card">
                <p class="success-details-line"><strong>${lang === 'es' ? 'Doctor:' : 'Doctor:'}</strong> ${escapeHtml(getDoctorName(appointment.doctor))}</p>
                <p class="success-details-line"><strong>${lang === 'es' ? 'Fecha:' : 'Date:'}</strong> ${escapeHtml(appointment.date || '-')}</p>
                <p class="success-details-line"><strong>${lang === 'es' ? 'Hora:' : 'Time:'}</strong> ${escapeHtml(appointment.time || '-')}</p>
                <p class="success-details-line"><strong>${lang === 'es' ? 'Pago:' : 'Payment:'}</strong> ${escapeHtml(getPaymentMethodLabel(appointment.paymentMethod))} - ${escapeHtml(getPaymentStatusLabel(appointment.paymentStatus))}</p>
                <p><strong>${lang === 'es' ? 'Total:' : 'Total:'}</strong> ${escapeHtml(appointment.price || '$0.00')}</p>
            </div>
            <div class="success-calendar-actions">
                <a href="${googleCalendarUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary success-calendar-btn">
                    <i class="fab fa-google"></i> Google Calendar
                </a>
                <a href="${activeIcsUrl}" download="cita-piel-en-armonia.ics" class="btn btn-secondary success-calendar-btn">
                    <i class="fas fa-calendar-alt"></i> Outlook/Apple
                </a>
            </div>
        `;
    }

    modal.classList.add('active');
}

function closeSuccessModal() {
    const modal = document.getElementById('successModal');
    if (modal) {
        modal.classList.remove('active');
    }
    document.body.style.overflow = '';
    cleanupIcsUrl();
}

function init(inputDeps) {
    deps = inputDeps || deps;
    return window.PielSuccessModalEngine;
}

window.PielSuccessModalEngine = {
    init,
    showSuccessModal,
    closeSuccessModal
};
