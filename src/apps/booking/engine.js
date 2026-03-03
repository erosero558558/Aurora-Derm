// build-sync: 20260219-sync1
let deps = null;
let initialized = false;
let listenersBound = false;
let isPaymentProcessing = false;
let paymentConfig = {
    enabled: false,
    provider: 'stripe',
    publishableKey: '',
    currency: 'USD',
};
let stripeClient = null;
let stripeElements = null;
let stripeCardElement = null;
let stripeMounted = false;

function getBookingFormElement() {
    return (
        document.getElementById('v5-booking-form') ||
        document.getElementById('appointmentForm')
    );
}

function getPaymentModalElement() {
    return (
        document.getElementById('v5-payment-modal') ||
        document.getElementById('paymentModal')
    );
}

function getPaymentTotalElement() {
    return (
        document.getElementById('v5-payment-total') ||
        document.getElementById('paymentTotal')
    );
}

/**
 * Initializes the Booking Engine with necessary dependencies.
 * Also sets up payment listeners if the DOM is ready or when it becomes ready.
 *
 * @param {Object} inputDeps - The dependencies required by the engine.
 * @param {Function} inputDeps.getCurrentLang - Function to get the current language code.
 * @param {Function} inputDeps.getCurrentAppointment - Function to get the current appointment object.
 * @param {Function} inputDeps.setCurrentAppointment - Function to set the current appointment object.
 * @param {Function} inputDeps.setCheckoutSessionActive - Function to set the checkout session active state.
 * @param {Function} inputDeps.setCheckoutStep - Function to track checkout steps.
 * @param {Function} inputDeps.showToast - Function to display toast notifications.
 * @param {Function} inputDeps.trackEvent - Function to track analytics events.
 * @param {Function} inputDeps.normalizeAnalyticsLabel - Function to normalize analytics labels.
 * @param {Function} inputDeps.debugLog - Function for debug logging.
 * @param {Function} inputDeps.getCaptchaToken - Function to retrieve a CAPTCHA token.
 * @param {Function} inputDeps.loadPaymentConfig - Function to load payment configuration.
 * @param {Function} inputDeps.loadStripeSdk - Function to load the Stripe SDK.
 * @param {Function} inputDeps.getCheckoutSession - Function to get the current checkout session.
 * @param {Function} inputDeps.startCheckoutSession - Function to start a checkout session.
 * @param {Function} inputDeps.maybeTrackCheckoutAbandon - Function to track checkout abandonment.
 * @param {Function} inputDeps.buildAppointmentPayload - Function to build the appointment payload.
 * @param {Function} inputDeps.stripTransientAppointmentFields - Function to remove transient fields from the appointment.
 * @param {Function} inputDeps.createPaymentIntent - Function to create a payment intent.
 * @param {Function} inputDeps.verifyPaymentIntent - Function to verify a payment intent.
 * @param {Function} inputDeps.createAppointmentRecord - Function to create the appointment record.
 * @param {Function} inputDeps.uploadTransferProof - Function to upload transfer proof.
 * @param {Function} inputDeps.completeCheckoutSession - Function to mark the checkout session as complete.
 * @param {Function} inputDeps.showSuccessModal - Function to show the success modal.
 * @returns {Object} The API object exposed by the engine.
 */
function init(inputDeps) {
    if (initialized) {
        return api;
    }
    deps = inputDeps || {};
    initialized = true;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindPaymentListeners, {
            once: true,
        });
    } else {
        bindPaymentListeners();
    }

    return api;
}

function requireFn(name) {
    const fn = deps ? deps[name] : null;
    if (typeof fn !== 'function') {
        throw new Error(`BookingEngine dependency missing: ${name}`);
    }
    return fn;
}

function _getCurrentLang() {
    try {
        return requireFn('getCurrentLang')() || 'es';
    } catch (_) {
        return 'es';
    }
}

function getCurrentAppointment() {
    return requireFn('getCurrentAppointment')();
}

function setCurrentAppointment(appointment) {
    requireFn('setCurrentAppointment')(appointment);
}

function setCheckoutSessionActive(active) {
    requireFn('setCheckoutSessionActive')(active === true);
}

function setCheckoutStep(step, payload = {}) {
    try {
        requireFn('setCheckoutStep')(step, payload || {});
    } catch (_) {
        // noop when analytics step tracking is unavailable
    }
}

function showToast(message, type) {
    requireFn('showToast')(message, type);
}

function trackEvent(eventName, payload) {
    requireFn('trackEvent')(eventName, payload || {});
}

function normalizeAnalyticsLabel(value, fallback) {
    return requireFn('normalizeAnalyticsLabel')(value, fallback);
}

function debugLog(message, context) {
    const logger =
        deps && typeof deps.debugLog === 'function' ? deps.debugLog : null;
    if (!logger) return;
    logger(message, context);
}

function sanitizeBookingSubmissionError(rawMessage) {
    const message = String(rawMessage || '').trim();
    if (!message) {
        return 'Hubo un problema tecnico temporal al registrar la cita. Intenta nuevamente.';
    }

    const technicalPatterns = [
        /call to undefined function/i,
        /fatal error/i,
        /uncaught/i,
        /stack trace/i,
        /syntax error/i,
        /on line \d+/i,
        /in \/.+\.php/i,
        /mb_strlen/i,
    ];

    if (technicalPatterns.some((pattern) => pattern.test(message))) {
        return 'Hubo un problema tecnico temporal al registrar la cita. Intenta nuevamente.';
    }

    return message;
}

function clearPaymentError() {
    setPaymentError('');
}

function setPaymentError(message) {
    const errorEl = document.getElementById('paymentError');
    if (!errorEl) return;
    if (!message) {
        errorEl.textContent = '';
        errorEl.classList.add('is-hidden');
        return;
    }
    errorEl.textContent = message;
    errorEl.classList.remove('is-hidden');
}

function resetTransferProofState() {
    const refInput = document.getElementById('transferReference');
    if (refInput) refInput.value = '';

    const proofInput = document.getElementById('transferProofFile');
    if (proofInput) proofInput.value = '';

    const fileNameEl = document.getElementById('transferProofFileName');
    if (fileNameEl) fileNameEl.textContent = '';
}

function updateTransferProofFileName() {
    const input = document.getElementById('transferProofFile');
    const fileNameEl = document.getElementById('transferProofFileName');
    if (!input || !fileNameEl) return;
    const file = input.files && input.files[0] ? input.files[0] : null;
    fileNameEl.textContent = file ? file.name : '';
}

function getCaptchaToken(action) {
    try {
        return requireFn('getCaptchaToken')(action);
    } catch (e) {
        debugLog('Captcha token not available', e);
        return Promise.resolve(null);
    }
}

function getActivePaymentMethod() {
    const activeMethod = document.querySelector('.payment-method.active');
    return activeMethod && activeMethod.dataset
        ? activeMethod.dataset.method || 'cash'
        : 'cash';
}

function syncPaymentForms(activeMethod) {
    const methodType = String(
        activeMethod || getActivePaymentMethod() || 'cash'
    );
    const paymentForms = document.querySelectorAll('.payment-form');
    paymentForms.forEach((form) => {
        form.classList.add('is-hidden');
    });
    const target = document.querySelector(`.${methodType}-form`);
    if (target) {
        target.classList.remove('is-hidden');
    }
}

function setCardMethodEnabled(enabled) {
    const cardMethod = document.querySelector(
        '.payment-method[data-method="card"]'
    );
    if (!cardMethod) return;

    cardMethod.classList.toggle('disabled', !enabled);
    cardMethod.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    cardMethod.title = enabled
        ? ''
        : 'Pago con tarjeta temporalmente no disponible';

    if (!enabled && cardMethod.classList.contains('active')) {
        const transferMethod = document.querySelector(
            '.payment-method[data-method="transfer"]'
        );
        const cashMethod = document.querySelector(
            '.payment-method[data-method="cash"]'
        );
        const fallback = transferMethod || cashMethod;
        if (fallback) {
            fallback.click();
        }
    }
}

async function refreshCardPaymentAvailability() {
    paymentConfig = await requireFn('loadPaymentConfig')();
    const gatewayEnabled =
        paymentConfig.enabled === true &&
        String(paymentConfig.provider || '').toLowerCase() === 'stripe';
    if (!gatewayEnabled) {
        setCardMethodEnabled(false);
        return false;
    }

    try {
        await requireFn('loadStripeSdk')();
    } catch (_) {
        setCardMethodEnabled(false);
        return false;
    }

    const enabled = typeof window.Stripe === 'function';
    setCardMethodEnabled(enabled);
    if (!enabled) {
        return false;
    }

    await mountStripeCardElement();
    return true;
}

async function mountStripeCardElement() {
    if (!paymentConfig.enabled || typeof window.Stripe !== 'function') {
        return;
    }
    if (!paymentConfig.publishableKey) {
        return;
    }

    if (!stripeClient) {
        stripeClient = window.Stripe(paymentConfig.publishableKey);
        stripeElements = stripeClient.elements();
    }

    if (!stripeElements) {
        throw new Error('No se pudo inicializar el formulario de tarjeta');
    }

    if (!stripeCardElement) {
        stripeCardElement = stripeElements.create('card', {
            hidePostalCode: true,
            style: {
                base: {
                    color: '#1d1d1f',
                    fontFamily:
                        '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif',
                    fontSize: '16px',
                    '::placeholder': {
                        color: '#9aa6b2',
                    },
                },
                invalid: {
                    color: '#d14343',
                },
            },
        });
    }

    if (!stripeMounted) {
        stripeCardElement.mount('#stripeCardElement');
        stripeMounted = true;
    }
}

/**
 * Opens the payment modal and prepares the payment interface.
 * Initializes the checkout session if needed.
 *
 * @param {Object} [appointmentData] - Optional appointment data to update current state.
 */
function openPaymentModal(appointmentData) {
    const modal = getPaymentModalElement();
    if (!modal) return;

    if (appointmentData) {
        setCurrentAppointment(appointmentData);
    }

    const appointment = getCurrentAppointment() || {};
    const checkout = requireFn('getCheckoutSession')();
    const checkoutEntry =
        (checkout && checkout.entry) || appointment.checkoutEntry || 'unknown';
    let checkoutStartedNow = false;
    if (!checkout || !checkout.active || !checkout.startedAt) {
        requireFn('startCheckoutSession')(appointment, {
            checkoutEntry:
                checkoutEntry === 'unknown' ? 'web_form' : checkoutEntry,
            step: 'payment_modal_open',
        });
        checkoutStartedNow = true;
    }

    if (checkoutStartedNow) {
        trackEvent('start_checkout', {
            service: appointment.service || '',
            doctor: appointment.doctor || '',
            checkout_entry:
                checkoutEntry === 'unknown' ? 'web_form' : checkoutEntry,
        });
    }

    setCheckoutStep('payment_modal_open', {
        checkoutEntry: checkoutEntry === 'unknown' ? 'web_form' : checkoutEntry,
        service: appointment.service || '',
        doctor: appointment.doctor || '',
    });

    const paymentTotal = getPaymentTotalElement();
    if (paymentTotal) {
        paymentTotal.textContent = appointment.price || '$0.00';
    }

    clearPaymentError();
    resetTransferProofState();

    const cardNameInput = document.getElementById('cardholderName');
    if (cardNameInput && appointment.name) {
        cardNameInput.value = appointment.name;
    }

    if (stripeCardElement && typeof stripeCardElement.clear === 'function') {
        stripeCardElement.clear();
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    syncPaymentForms(getActivePaymentMethod());

    bindPaymentListeners();
    refreshCardPaymentAvailability().catch(() => undefined);
}

/**
 * Closes the payment modal and cleans up the UI.
 *
 * @param {Object} [options={}] - Options for closing.
 * @param {boolean} [options.skipAbandonTrack=false] - If true, skips tracking abandonment.
 * @param {string} [options.reason='modal_close'] - Reason for closing the modal.
 */
function closePaymentModal(options = {}) {
    const skipAbandonTrack = options && options.skipAbandonTrack === true;
    const abandonReason =
        options && typeof options.reason === 'string'
            ? options.reason
            : 'modal_close';
    const modal = getPaymentModalElement();

    if (!skipAbandonTrack) {
        setCheckoutStep('payment_modal_closed');
        requireFn('maybeTrackCheckoutAbandon')(abandonReason);
    }

    setCheckoutSessionActive(false);

    if (modal) {
        modal.classList.remove('active');
    }

    document.body.style.overflow = '';
    clearPaymentError();
}

async function processCardPaymentFlow() {
    const cardAvailable = await refreshCardPaymentAvailability();
    if (!cardAvailable) {
        throw new Error('Pago con tarjeta no disponible en este momento.');
    }
    if (!stripeClient || !stripeCardElement) {
        throw new Error('No se pudo inicializar el formulario de tarjeta.');
    }

    const cardholderName = (
        document.getElementById('cardholderName')?.value || ''
    ).trim();
    if (cardholderName.length < 3) {
        throw new Error('Ingresa el nombre del titular de la tarjeta.');
    }

    const appointment = getCurrentAppointment();
    const appointmentPayload = await requireFn('buildAppointmentPayload')(
        appointment
    );

    const captchaToken1 = await getCaptchaToken('payment_intent');
    const intentPayload = requireFn('stripTransientAppointmentFields')(
        appointment
    );
    intentPayload.captchaToken = captchaToken1;

    const intent = await requireFn('createPaymentIntent')(intentPayload);
    if (!intent.clientSecret || !intent.paymentIntentId) {
        throw new Error('No se pudo iniciar el cobro con tarjeta.');
    }

    const result = await stripeClient.confirmCardPayment(intent.clientSecret, {
        payment_method: {
            card: stripeCardElement,
            billing_details: {
                name: cardholderName,
                email: appointment?.email || undefined,
                phone: appointment?.phone || undefined,
            },
        },
    });

    if (result.error) {
        throw new Error(
            result.error.message || 'No se pudo completar el pago con tarjeta.'
        );
    }

    const paymentIntent = result.paymentIntent;
    if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        throw new Error('El pago no fue confirmado por la pasarela.');
    }

    const verification = await requireFn('verifyPaymentIntent')(
        paymentIntent.id
    );
    if (!verification.paid) {
        throw new Error('No pudimos verificar el pago. Intenta nuevamente.');
    }

    trackEvent('payment_success', {
        payment_method: 'card',
        payment_provider: 'stripe',
        payment_intent_id: paymentIntent.id,
    });

    const captchaToken2 = await getCaptchaToken('appointment_submit');
    const payload = {
        ...appointmentPayload,
        paymentMethod: 'card',
        paymentStatus: 'paid',
        paymentProvider: 'stripe',
        paymentIntentId: paymentIntent.id,
        status: 'confirmed',
        captchaToken: captchaToken2,
    };

    return requireFn('createAppointmentRecord')(payload, {
        allowLocalFallback: false,
    });
}

async function processTransferPaymentFlow() {
    const transferReference = (
        document.getElementById('transferReference')?.value || ''
    ).trim();
    if (transferReference.length < 3) {
        throw new Error('Ingresa el numero de referencia de la transferencia.');
    }

    const proofInput = document.getElementById('transferProofFile');
    const proofFile =
        proofInput?.files && proofInput.files[0] ? proofInput.files[0] : null;
    if (!proofFile) {
        throw new Error('Adjunta el comprobante de transferencia.');
    }
    if (proofFile.size > 5 * 1024 * 1024) {
        throw new Error('El comprobante supera el limite de 5 MB.');
    }

    const upload = await requireFn('uploadTransferProof')(proofFile, {
        retries: 2,
    });
    const appointmentPayload = await requireFn('buildAppointmentPayload')(
        getCurrentAppointment()
    );

    const captchaToken = await getCaptchaToken('appointment_submit');

    const payload = {
        ...appointmentPayload,
        paymentMethod: 'transfer',
        paymentStatus: 'pending_transfer_review',
        transferReference,
        transferProofPath: upload.transferProofPath || '',
        transferProofUrl: upload.transferProofUrl || '',
        transferProofName: upload.transferProofName || '',
        transferProofMime: upload.transferProofMime || '',
        status: 'confirmed',
        captchaToken,
    };

    return requireFn('createAppointmentRecord')(payload, {
        allowLocalFallback: false,
    });
}

async function processCashPaymentFlow() {
    const appointmentPayload = await requireFn('buildAppointmentPayload')(
        getCurrentAppointment()
    );
    const captchaToken = await getCaptchaToken('appointment_submit');
    const payload = {
        ...appointmentPayload,
        paymentMethod: 'cash',
        paymentStatus: 'pending_cash',
        status: 'confirmed',
        captchaToken,
    };

    return requireFn('createAppointmentRecord')(payload, {
        allowLocalFallback: false,
    });
}

/**
 * Orchestrates the payment processing flow based on the selected method.
 * Handles validation, API calls, error handling, and success feedback.
 * @returns {Promise<void>}
 */
async function processPayment() {
    if (isPaymentProcessing) return;
    isPaymentProcessing = true;

    const modal = getPaymentModalElement();
    const btn = modal ? modal.querySelector('.btn-primary') : null;
    if (!btn) {
        isPaymentProcessing = false;
        return;
    }

    const originalContent = btn.innerHTML;
    let paymentMethodUsed = 'cash';

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        if (!getCurrentAppointment()) {
            showToast('Primero completa el formulario de cita.', 'warning');
            return;
        }

        const paymentMethod = getActivePaymentMethod();
        paymentMethodUsed = paymentMethod;
        clearPaymentError();
        trackEvent('payment_method_selected', {
            payment_method: paymentMethod || 'unknown',
            selection_source: 'submit',
        });
        setCheckoutStep('payment_method_selected', {
            paymentMethod: paymentMethod || 'unknown',
        });
        setCheckoutStep('payment_processing', {
            paymentMethod: paymentMethod || 'unknown',
        });

        let result;
        if (paymentMethod === 'card') {
            result = await processCardPaymentFlow();
        } else if (paymentMethod === 'transfer') {
            result = await processTransferPaymentFlow();
        } else {
            result = await processCashPaymentFlow();
        }

        setCurrentAppointment(result.appointment);

        setCheckoutStep('booking_confirmed', {
            paymentMethod: paymentMethod || 'unknown',
        });
        requireFn('completeCheckoutSession')(paymentMethod);
        closePaymentModal({ skipAbandonTrack: true });
        requireFn('showSuccessModal')(result.emailSent === true);
        showToast(
            paymentMethod === 'card'
                ? 'Pago aprobado y cita registrada.'
                : 'Cita registrada correctamente.',
            'success'
        );

        const form = getBookingFormElement();
        if (form) form.reset();

        const summary = document.getElementById('priceSummary');
        if (summary) summary.classList.add('is-hidden');
    } catch (error) {
        const rawMessage = error?.message || '';
        let message = sanitizeBookingSubmissionError(rawMessage);
        if (
            paymentMethodUsed === 'card' &&
            /horario ya fue reservado/i.test(rawMessage)
        ) {
            message =
                'El pago fue aprobado, pero el horario acaba de ocuparse. Escribenos por WhatsApp para resolverlo de inmediato: 098 245 3672.';
        }

        trackEvent('checkout_error', {
            stage: 'payment_submit',
            payment_method: paymentMethodUsed || getActivePaymentMethod(),
            error_code: normalizeAnalyticsLabel(
                error?.code || message,
                'payment_failed'
            ),
        });
        setCheckoutStep('payment_error', {
            paymentMethod:
                paymentMethodUsed || getActivePaymentMethod() || 'unknown',
        });

        setPaymentError(message);
        showToast(message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
        isPaymentProcessing = false;
    }
}

function bindPaymentListeners() {
    if (listenersBound) return;
    listenersBound = true;

    document.addEventListener('click', (e) => {
        const policyLink = e.target.closest(
            '[data-action="open-payment-policy"]'
        );
        if (policyLink) {
            trackEvent('booking_policy_opened', {
                source: 'payment_modal',
            });
            setCheckoutStep('payment_policy_opened', {
                source: 'payment_modal',
            });
            return;
        }

        const faqSummary = e.target.closest(
            '#v5-payment-modal .payment-faq summary, #paymentModal .payment-faq summary'
        );
        if (faqSummary) {
            const faqDetails = faqSummary.closest('details');
            if (!faqDetails) {
                return;
            }

            // Wait for the native details toggle before reading open state.
            window.requestAnimationFrame(() => {
                if (!faqDetails.open) {
                    return;
                }

                const faqItem =
                    faqSummary.getAttribute('data-i18n') ||
                    normalizeAnalyticsLabel(
                        faqSummary.textContent || 'payment_faq_unknown',
                        'payment_faq_unknown'
                    );

                trackEvent('payment_faq_interacted', {
                    source: 'payment_modal',
                    action: 'open',
                    faq_item: faqItem,
                });

                setCheckoutStep('payment_faq_opened', {
                    source: 'payment_modal',
                });
            });
            return;
        }

        const method = e.target.closest('.payment-method');
        if (!method) return;

        if (method.classList.contains('disabled')) {
            showToast(
                'Pago con tarjeta no disponible por el momento.',
                'warning'
            );
            return;
        }

        document
            .querySelectorAll('.payment-method')
            .forEach((m) => m.classList.remove('active'));
        method.classList.add('active');

        const methodType = method.dataset.method;
        syncPaymentForms(methodType);

        clearPaymentError();
        trackEvent('payment_method_selected', {
            payment_method: methodType || 'unknown',
        });

        if (methodType === 'card') {
            refreshCardPaymentAvailability().catch((error) => {
                setPaymentError(
                    error?.message ||
                        'No se pudo cargar el formulario de tarjeta'
                );
            });
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'transferProofFile') {
            updateTransferProofFileName();
        }
    });
}

const api = {
    init,
    openPaymentModal,
    closePaymentModal,
    getActivePaymentMethod,
    processPayment,
};

window.Piel = window.Piel || {};
window.Piel.BookingEngine = api;
window.PielBookingEngine = api;

export default api;
