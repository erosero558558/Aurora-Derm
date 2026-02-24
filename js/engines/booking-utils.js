(function () {
    'use strict';

    let deps$1 = null;
    let rescheduleToken = '';
    let rescheduleAppointment = null;

    function init$1(inputDeps) {
        deps$1 = inputDeps || deps$1;
        return window.PielRescheduleEngine;
    }

    function getLang() {
        return deps$1 && typeof deps$1.getCurrentLang === 'function'
            ? deps$1.getCurrentLang()
            : 'es';
    }

    function t(esText, enText) {
        return getLang() === 'es' ? esText : enText;
    }

    function safe(text) {
        if (deps$1 && typeof deps$1.escapeHtml === 'function') {
            return deps$1.escapeHtml(String(text || ''));
        }
        const div = document.createElement('div');
        div.textContent = String(text || '');
        return div.innerHTML;
    }

    function notify(message, type) {
        if (deps$1 && typeof deps$1.showToast === 'function') {
            deps$1.showToast(message, type || 'info');
        }
    }

    function isCalendarUnavailableError(error) {
        if (!error) return false;
        const code = String(error.code || '').toLowerCase();
        const message = String(error.message || '').toLowerCase();
        return (
            code === 'calendar_unreachable' ||
            code === 'calendar_auth_failed' ||
            code === 'calendar_token_rejected' ||
            message.includes('calendar_unreachable') ||
            message.includes('agenda temporalmente no disponible') ||
            message.includes('no se pudo consultar la agenda real') ||
            message.includes('google calendar no')
        );
    }

    async function checkRescheduleParam() {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('reschedule');
        if (!token) {
            return false;
        }

        rescheduleToken = token;

        try {
            const resp = await deps$1.apiRequest('reschedule', {
                query: { token: token },
            });
            if (resp && (resp.ok === undefined || resp.ok) && resp.data) {
                rescheduleAppointment = resp.data;
                openRescheduleModal(resp.data);
                return true;
            }
            notify(
                resp?.error ||
                    t(
                        'Enlace de reprogramacion invalido.',
                        'Invalid reschedule link.'
                    ),
                'error'
            );
            return false;
        } catch {
            notify(
                t(
                    'No se pudo cargar la cita. Verifica el enlace.',
                    'Unable to load appointment. Verify the link.'
                ),
                'error'
            );
            return false;
        }
    }

    function openRescheduleModal(appt) {
        const modal = document.getElementById('rescheduleModal');
        if (!modal) return;

        if (appt) {
            rescheduleAppointment = appt;
        }

        const info = document.getElementById('rescheduleInfo');
        if (info && rescheduleAppointment) {
            const doctorValue = String(rescheduleAppointment.doctor || '');
            const doctorLabel =
                doctorValue === 'rosero'
                    ? 'Dr. Javier Rosero'
                    : doctorValue === 'narvaez'
                      ? 'Dra. Carolina Narvaez'
                      : doctorValue === 'indiferente'
                        ? 'Cualquiera disponible'
                        : doctorValue;

            info.innerHTML =
                '<p><strong>' +
                t('Paciente', 'Patient') +
                ':</strong> ' +
                safe(rescheduleAppointment.name) +
                '</p>' +
                '<p><strong>' +
                t('Servicio', 'Service') +
                ':</strong> ' +
                safe(rescheduleAppointment.service) +
                '</p>' +
                '<p><strong>' +
                t('Doctor', 'Doctor') +
                ':</strong> ' +
                safe(doctorLabel) +
                '</p>' +
                '<p><strong>' +
                t('Fecha actual', 'Current date') +
                ':</strong> ' +
                safe(rescheduleAppointment.date) +
                ' ' +
                safe(rescheduleAppointment.time) +
                '</p>';
        }

        const dateInput = document.getElementById('rescheduleDate');
        if (dateInput) {
            dateInput.min = new Date().toISOString().split('T')[0];
            dateInput.value = '';
            dateInput.removeEventListener('change', loadRescheduleSlots);
            dateInput.addEventListener('change', loadRescheduleSlots);
        }

        const timeSelect = document.getElementById('rescheduleTime');
        if (timeSelect) {
            timeSelect.innerHTML =
                '<option value="">' +
                t('Selecciona un horario', 'Select a time') +
                '</option>';
        }

        const errorDiv = document.getElementById('rescheduleError');
        if (errorDiv) {
            errorDiv.classList.add('is-hidden');
        }

        modal.classList.add('active');
    }

    function closeRescheduleModal() {
        const modal = document.getElementById('rescheduleModal');
        if (modal) {
            modal.classList.remove('active');
        }

        if (window.history.replaceState) {
            const url = new URL(window.location.href);
            url.searchParams.delete('reschedule');
            window.history.replaceState({}, '', url.toString());
        }
    }

    async function loadRescheduleSlots() {
        const dateInput = document.getElementById('rescheduleDate');
        const timeSelect = document.getElementById('rescheduleTime');
        if (!dateInput || !timeSelect || !rescheduleAppointment) {
            return;
        }

        const selectedDate = dateInput.value;
        if (!selectedDate) {
            return;
        }

        timeSelect.innerHTML =
            '<option value="">' + t('Cargando...', 'Loading...') + '</option>';

        try {
            const service = String(rescheduleAppointment.service || 'consulta');
            const availability = await deps$1.loadAvailabilityData({
                doctor: String(rescheduleAppointment.doctor || 'indiferente'),
                service,
                strict: true,
            });
            const daySlots = availability[selectedDate] || [];
            const booked = await deps$1.getBookedSlots(
                selectedDate,
                rescheduleAppointment.doctor || '',
                service
            );
            const isToday =
                selectedDate === new Date().toISOString().split('T')[0];
            const nowMinutes = isToday
                ? new Date().getHours() * 60 + new Date().getMinutes()
                : -1;
            const freeSlots = daySlots.filter((slot) => {
                if (booked.includes(slot)) return false;
                if (isToday) {
                    const [h, m] = slot.split(':').map(Number);
                    if (h * 60 + m <= nowMinutes + 60) return false;
                }
                return true;
            });

            timeSelect.innerHTML =
                '<option value="">' +
                t('Selecciona un horario', 'Select a time') +
                '</option>';
            freeSlots.forEach((slot) => {
                const opt = document.createElement('option');
                opt.value = slot;
                opt.textContent = slot;
                timeSelect.appendChild(opt);
            });

            if (freeSlots.length === 0) {
                timeSelect.innerHTML =
                    '<option value="">' +
                    t('Sin horarios disponibles', 'No slots available') +
                    '</option>';
            }
        } catch (error) {
            const isCalendarUnavailable = isCalendarUnavailableError(error);
            timeSelect.innerHTML =
                '<option value="">' +
                (isCalendarUnavailable
                    ? t('Agenda temporalmente no disponible', 'Schedule temporarily unavailable')
                    : t('Error al cargar horarios', 'Error loading slots')) +
                '</option>';
        }
    }

    async function submitReschedule() {
        const dateInput = document.getElementById('rescheduleDate');
        const timeSelect = document.getElementById('rescheduleTime');
        const errorDiv = document.getElementById('rescheduleError');
        const btn = document.getElementById('rescheduleSubmitBtn');
        if (!dateInput || !timeSelect || !errorDiv || !btn) {
            return;
        }

        const newDate = dateInput.value;
        const newTime = timeSelect.value;

        errorDiv.classList.add('is-hidden');

        if (!newDate || !newTime) {
            errorDiv.textContent = t(
                'Selecciona fecha y horario.',
                'Select date and time.'
            );
            errorDiv.classList.remove('is-hidden');
            return;
        }

        btn.disabled = true;
        btn.textContent = t('Reprogramando...', 'Rescheduling...');

        try {
            const resp = await deps$1.apiRequest('reschedule', {
                method: 'PATCH',
                body: {
                    token: rescheduleToken,
                    date: newDate,
                    time: newTime,
                },
            });

            if (resp && (resp.ok === undefined || resp.ok)) {
                const oldDate = rescheduleAppointment?.date || '';
                const doctor = rescheduleAppointment?.doctor || '';
                const service = String(rescheduleAppointment?.service || 'consulta');
                deps$1.invalidateBookedSlotsCache(oldDate, doctor, service);
                deps$1.invalidateBookedSlotsCache(newDate, doctor, service);
                closeRescheduleModal();
                notify(
                    t(
                        'Cita reprogramada exitosamente.',
                        'Appointment rescheduled successfully.'
                    ),
                    'success'
                );
            } else {
                errorDiv.textContent =
                    resp?.error ||
                    t('Error al reprogramar.', 'Error while rescheduling.');
                errorDiv.classList.remove('is-hidden');
            }
        } catch {
            errorDiv.textContent = t(
                'Error de conexion. Intentalo de nuevo.',
                'Connection error. Try again.'
            );
            errorDiv.classList.remove('is-hidden');
        } finally {
            btn.disabled = false;
            btn.textContent = t(
                'Confirmar reprogramacion',
                'Confirm reschedule'
            );
        }
    }

    window.PielRescheduleEngine = {
        init: init$1,
        checkRescheduleParam,
        openRescheduleModal,
        closeRescheduleModal,
        loadRescheduleSlots,
        submitReschedule,
    };

    const DEFAULT_PAYMENT_CONFIG = {
        enabled: false,
        provider: 'stripe',
        publishableKey: '',
        currency: 'USD',
    };

    let deps = null;
    let paymentConfig = { ...DEFAULT_PAYMENT_CONFIG };
    let paymentConfigLoaded = false;
    let paymentConfigLoadedAt = 0;
    let stripeSdkPromise = null;

    function init(inputDeps) {
        deps = inputDeps || {};
        return window.PielPaymentGatewayEngine;
    }

    function getApiRequest() {
        if (deps && typeof deps.apiRequest === 'function') {
            return deps.apiRequest;
        }
        throw new Error('PaymentGatewayEngine dependency missing: apiRequest');
    }

    function normalizePaymentConfig(payload) {
        const source = payload && typeof payload === 'object' ? payload : {};
        return {
            enabled: source.enabled === true,
            provider: source.provider || 'stripe',
            publishableKey: source.publishableKey || '',
            currency: source.currency || 'USD',
        };
    }

    async function loadPaymentConfig() {
        const now = Date.now();
        if (
            paymentConfigLoaded &&
            now - paymentConfigLoadedAt < 5 * 60 * 1000
        ) {
            return paymentConfig;
        }

        try {
            const payload = await getApiRequest()('payment-config');
            paymentConfig = normalizePaymentConfig(payload);
        } catch (_) {
            paymentConfig = { ...DEFAULT_PAYMENT_CONFIG };
        }

        paymentConfigLoaded = true;
        paymentConfigLoadedAt = now;
        return paymentConfig;
    }

    async function loadStripeSdk() {
        if (typeof window.Stripe === 'function') {
            return true;
        }

        if (stripeSdkPromise) {
            return stripeSdkPromise;
        }

        stripeSdkPromise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector(
                'script[data-stripe-sdk="true"]'
            );
            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(true), {
                    once: true,
                });
                existingScript.addEventListener(
                    'error',
                    () => reject(new Error('No se pudo cargar Stripe SDK')),
                    { once: true }
                );
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.async = true;
            script.defer = true;
            script.dataset.stripeSdk = 'true';
            script.onload = () => resolve(true);
            script.onerror = () =>
                reject(new Error('No se pudo cargar Stripe SDK'));
            document.head.appendChild(script);
        }).catch((error) => {
            stripeSdkPromise = null;
            throw error;
        });

        return stripeSdkPromise;
    }

    async function createPaymentIntent(appointment) {
        return getApiRequest()('payment-intent', {
            method: 'POST',
            body: appointment,
        });
    }

    async function verifyPaymentIntent(paymentIntentId) {
        return getApiRequest()('payment-verify', {
            method: 'POST',
            body: { paymentIntentId },
        });
    }

    async function uploadTransferProof(file) {
        const formData = new FormData();
        formData.append('proof', file);

        const query = new URLSearchParams({ resource: 'transfer-proof' });
        const controller = new AbortController();
        const timeoutMs = (deps && deps.apiRequestTimeoutMs) || 9000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const apiEndpoint = (deps && deps.apiEndpoint) || '/api.php';

        let response;
        let text = '';
        try {
            response = await fetch(`${apiEndpoint}?${query.toString()}`, {
                method: 'POST',
                credentials: 'same-origin',
                body: formData,
                signal: controller.signal
            });
            text = await response.text();
        } catch (error) {
            if (error && error.name === 'AbortError') {
                const lang = deps && typeof deps.getCurrentLang === 'function' ? deps.getCurrentLang() : 'es';
                throw new Error(
                    lang === 'es'
                        ? 'Tiempo de espera agotado al subir el comprobante'
                        : 'Upload timed out while sending proof file'
                );
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }

        let payload = {};
        try {
            payload = text ? JSON.parse(text) : {};
        } catch (error) {
            throw new Error('No se pudo interpretar la respuesta de subida');
        }

        if (!response.ok || payload.ok === false) {
            throw new Error(payload.error || `HTTP ${response.status}`);
        }

        return payload.data || {};
    }

    window.PielPaymentGatewayEngine = {
        init,
        loadPaymentConfig,
        loadStripeSdk,
        createPaymentIntent,
        verifyPaymentIntent,
        uploadTransferProof,
    };

    /**
     * Piel en Armonia - Booking Calendar Logic
     * Extracted for lazy loading.
     */

    function initCalendar() {
        // This function satisfies the explicit user request example.
        // In our architecture, the logic is mainly in updateAvailableTimes which is called by UI events.
        if (window.debugLog) {
            window.debugLog('Booking calendar module loaded lazy.');
        }
    }

    async function updateAvailableTimes(deps, elements) {
        const { dateInput, timeSelect, doctorSelect, serviceSelect, t } = elements;

        const selectedDate = dateInput ? dateInput.value : '';
        if (!selectedDate || !timeSelect) return;

        const selectedDoctor = doctorSelect ? doctorSelect.value : '';
        const selectedService = serviceSelect ? serviceSelect.value : 'consulta';
        const availability = await deps.loadAvailabilityData({
            doctor: selectedDoctor || 'indiferente',
            service: selectedService || 'consulta',
            strict: true,
        });
        const bookedSlots = await deps.getBookedSlots(
            selectedDate,
            selectedDoctor,
            selectedService
        );
        const availableSlots = availability[selectedDate] || [];
        const isToday = selectedDate === new Date().toISOString().split('T')[0];
        const nowMinutes = isToday
            ? new Date().getHours() * 60 + new Date().getMinutes()
            : -1;
        const freeSlots = availableSlots.filter((slot) => {
            if (bookedSlots.includes(slot)) return false;
            if (isToday) {
                const [h, m] = slot.split(':').map(Number);
                if (h * 60 + m <= nowMinutes + 60) return false;
            }
            return true;
        });

        const currentValue = timeSelect.value;
        timeSelect.innerHTML = '<option value="">Hora</option>';

        if (freeSlots.length === 0) {
            timeSelect.innerHTML +=
                '<option value="" disabled>No hay horarios disponibles</option>';
            deps.showToast(
                t(
                    'No hay horarios disponibles para esta fecha',
                    'No slots available for this date'
                ),
                'warning'
            );
            return;
        }

        freeSlots.forEach((time) => {
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            if (time === currentValue) option.selected = true;
            timeSelect.appendChild(option);
        });
    }

    window.Piel = window.Piel || {};
    window.Piel.BookingCalendarEngine = {
        initCalendar,
        updateAvailableTimes
    };

    // Legacy support
    window.PielBookingCalendarEngine = window.Piel.BookingCalendarEngine;

})();
