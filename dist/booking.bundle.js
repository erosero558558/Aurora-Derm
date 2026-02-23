class BookingEngine {
    constructor() {
        this.deps = null;
        this.initialized = false;
        this.listenersBound = false;
        this.isPaymentProcessing = false;
        this.paymentConfig = { enabled: false, provider: 'stripe', publishableKey: '', currency: 'USD' };
        this.stripeClient = null;
        this.stripeElements = null;
        this.stripeCardElement = null;
        this.stripeMounted = false;
    }

    init(inputDeps = {}) {
        if (this.initialized) {
            return this;
        }
        this.deps = inputDeps || {};
        this.initialized = true;

        if (typeof document !== 'undefined') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.bindPaymentListeners(), { once: true });
            } else {
                this.bindPaymentListeners();
            }
        }

        return this;
    }

    requireFn(name) {
        const fn = this.deps ? this.deps[name] : null;
        if (typeof fn !== 'function') {
            throw new Error(`BookingEngine dependency missing: ${name}`);
        }
        return fn;
    }

    getCurrentLang() {
        try {
            return this.requireFn('getCurrentLang')() || 'es';
        } catch (_) {
            return 'es';
        }
    }

    getCurrentAppointment() {
        return this.requireFn('getCurrentAppointment')();
    }

    setCurrentAppointment(appointment) {
        this.requireFn('setCurrentAppointment')(appointment);
    }

    setCheckoutSessionActive(active) {
        this.requireFn('setCheckoutSessionActive')(active === true);
    }

    setCheckoutStep(step, payload = {}) {
        try {
            this.requireFn('setCheckoutStep')(step, payload || {});
        } catch (_) {
            // noop when analytics step tracking is unavailable
        }
    }

    showToast(message, type) {
        this.requireFn('showToast')(message, type);
    }

    trackEvent(eventName, payload) {
        this.requireFn('trackEvent')(eventName, payload || {});
    }

    normalizeAnalyticsLabel(value, fallback) {
        return this.requireFn('normalizeAnalyticsLabel')(value, fallback);
    }

    debugLog(message, context) {
        const logger = this.deps && typeof this.deps.debugLog === 'function'
            ? this.deps.debugLog
            : null;
        if (!logger) return;
        logger(message, context);
    }

    sanitizeBookingSubmissionError(rawMessage) {
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
            /mb_strlen/i
        ];

        if (technicalPatterns.some((pattern) => pattern.test(message))) {
            return 'Hubo un problema tecnico temporal al registrar la cita. Intenta nuevamente.';
        }

        return message;
    }

    clearPaymentError() {
        this.setPaymentError('');
    }

    setPaymentError(message) {
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

    resetTransferProofState() {
        const refInput = document.getElementById('transferReference');
        if (refInput) refInput.value = '';

        const proofInput = document.getElementById('transferProofFile');
        if (proofInput) proofInput.value = '';

        const fileNameEl = document.getElementById('transferProofFileName');
        if (fileNameEl) fileNameEl.textContent = '';
    }

    updateTransferProofFileName() {
        const input = document.getElementById('transferProofFile');
        const fileNameEl = document.getElementById('transferProofFileName');
        if (!input || !fileNameEl) return;
        const file = input.files && input.files[0] ? input.files[0] : null;
        fileNameEl.textContent = file ? file.name : '';
    }

    getCaptchaToken(action) {
        try {
            return this.requireFn('getCaptchaToken')(action);
        } catch (e) {
            this.debugLog('Captcha token not available', e);
            return Promise.resolve(null);
        }
    }

    getActivePaymentMethod() {
        const activeMethod = document.querySelector('.payment-method.active');
        return activeMethod && activeMethod.dataset ? activeMethod.dataset.method || 'cash' : 'cash';
    }

    syncPaymentForms(activeMethod) {
        const methodType = String(activeMethod || this.getActivePaymentMethod() || 'cash');
        const paymentForms = document.querySelectorAll('.payment-form');
        paymentForms.forEach((form) => {
            form.classList.add('is-hidden');
        });
        const target = document.querySelector(`.${methodType}-form`);
        if (target) {
            target.classList.remove('is-hidden');
        }
    }

    setCardMethodEnabled(enabled) {
        const cardMethod = document.querySelector('.payment-method[data-method="card"]');
        if (!cardMethod) return;

        cardMethod.classList.toggle('disabled', !enabled);
        cardMethod.setAttribute('aria-disabled', enabled ? 'false' : 'true');
        cardMethod.title = enabled
            ? ''
            : 'Pago con tarjeta temporalmente no disponible';

        if (!enabled && cardMethod.classList.contains('active')) {
            const transferMethod = document.querySelector('.payment-method[data-method="transfer"]');
            const cashMethod = document.querySelector('.payment-method[data-method="cash"]');
            const fallback = transferMethod || cashMethod;
            if (fallback) {
                fallback.click();
            }
        }
    }

    async refreshCardPaymentAvailability() {
        this.paymentConfig = await this.requireFn('loadPaymentConfig')();
        const gatewayEnabled = this.paymentConfig.enabled === true && String(this.paymentConfig.provider || '').toLowerCase() === 'stripe';
        if (!gatewayEnabled) {
            this.setCardMethodEnabled(false);
            return false;
        }

        try {
            await this.requireFn('loadStripeSdk')();
        } catch (_) {
            this.setCardMethodEnabled(false);
            return false;
        }

        const enabled = typeof window.Stripe === 'function';
        this.setCardMethodEnabled(enabled);
        if (!enabled) {
            return false;
        }

        await this.mountStripeCardElement();
        return true;
    }

    async mountStripeCardElement() {
        if (!this.paymentConfig.enabled || typeof window.Stripe !== 'function') {
            return;
        }
        if (!this.paymentConfig.publishableKey) {
            return;
        }

        if (!this.stripeClient) {
            this.stripeClient = window.Stripe(this.paymentConfig.publishableKey);
            this.stripeElements = this.stripeClient.elements();
        }

        if (!this.stripeElements) {
            throw new Error('No se pudo inicializar el formulario de tarjeta');
        }

        if (!this.stripeCardElement) {
            this.stripeCardElement = this.stripeElements.create('card', {
                hidePostalCode: true,
                style: {
                    base: {
                        color: '#1d1d1f',
                        fontFamily: '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif',
                        fontSize: '16px',
                        '::placeholder': {
                            color: '#9aa6b2'
                        }
                    },
                    invalid: {
                        color: '#d14343'
                    }
                }
            });
        }

        if (!this.stripeMounted) {
            this.stripeCardElement.mount('#stripeCardElement');
            this.stripeMounted = true;
        }
    }

    openPaymentModal(appointmentData) {
        const modal = document.getElementById('paymentModal');
        if (!modal) return;

        if (appointmentData) {
            this.setCurrentAppointment(appointmentData);
        }

        const appointment = this.getCurrentAppointment() || {};
        const checkout = this.requireFn('getCheckoutSession')();
        const checkoutEntry = (checkout && checkout.entry) || appointment.checkoutEntry || 'unknown';
        let checkoutStartedNow = false;
        if (!checkout || !checkout.active || !checkout.startedAt) {
            this.requireFn('startCheckoutSession')(appointment, {
                checkoutEntry: checkoutEntry === 'unknown' ? 'web_form' : checkoutEntry,
                step: 'payment_modal_open'
            });
            checkoutStartedNow = true;
        }

        if (checkoutStartedNow) {
            this.trackEvent('start_checkout', {
                service: appointment.service || '',
                doctor: appointment.doctor || '',
                checkout_entry: checkoutEntry === 'unknown' ? 'web_form' : checkoutEntry
            });
        }

        this.setCheckoutStep('payment_modal_open', {
            checkoutEntry: checkoutEntry === 'unknown' ? 'web_form' : checkoutEntry,
            service: appointment.service || '',
            doctor: appointment.doctor || ''
        });

        const paymentTotal = document.getElementById('paymentTotal');
        if (paymentTotal) {
            paymentTotal.textContent = appointment.price || '$0.00';
        }

        this.clearPaymentError();
        this.resetTransferProofState();

        const cardNameInput = document.getElementById('cardholderName');
        if (cardNameInput && appointment.name) {
            cardNameInput.value = appointment.name;
        }

        if (this.stripeCardElement && typeof this.stripeCardElement.clear === 'function') {
            this.stripeCardElement.clear();
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        this.syncPaymentForms(this.getActivePaymentMethod());

        this.bindPaymentListeners();
        this.refreshCardPaymentAvailability().catch(() => undefined);
    }

    closePaymentModal(options = {}) {
        const skipAbandonTrack = options && options.skipAbandonTrack === true;
        const abandonReason = options && typeof options.reason === 'string' ? options.reason : 'modal_close';
        const modal = document.getElementById('paymentModal');

        if (!skipAbandonTrack) {
            this.setCheckoutStep('payment_modal_closed');
            this.requireFn('maybeTrackCheckoutAbandon')(abandonReason);
        }

        this.setCheckoutSessionActive(false);

        if (modal) {
            modal.classList.remove('active');
        }

        document.body.style.overflow = '';
        this.clearPaymentError();
    }

    async processCardPaymentFlow() {
        const cardAvailable = await this.refreshCardPaymentAvailability();
        if (!cardAvailable) {
            throw new Error('Pago con tarjeta no disponible en este momento.');
        }
        if (!this.stripeClient || !this.stripeCardElement) {
            throw new Error('No se pudo inicializar el formulario de tarjeta.');
        }

        const cardholderName = (document.getElementById('cardholderName')?.value || '').trim();
        if (cardholderName.length < 3) {
            throw new Error('Ingresa el nombre del titular de la tarjeta.');
        }

        const appointment = this.getCurrentAppointment();
        const appointmentPayload = await this.requireFn('buildAppointmentPayload')(appointment);

        const captchaToken1 = await this.getCaptchaToken('payment_intent');
        const intentPayload = this.requireFn('stripTransientAppointmentFields')(appointment);
        intentPayload.captchaToken = captchaToken1;

        const intent = await this.requireFn('createPaymentIntent')(intentPayload);
        if (!intent.clientSecret || !intent.paymentIntentId) {
            throw new Error('No se pudo iniciar el cobro con tarjeta.');
        }

        const result = await this.stripeClient.confirmCardPayment(intent.clientSecret, {
            payment_method: {
                card: this.stripeCardElement,
                billing_details: {
                    name: cardholderName,
                    email: appointment?.email || undefined,
                    phone: appointment?.phone || undefined
                }
            }
        });

        if (result.error) {
            throw new Error(result.error.message || 'No se pudo completar el pago con tarjeta.');
        }

        const paymentIntent = result.paymentIntent;
        if (!paymentIntent || paymentIntent.status !== 'succeeded') {
            throw new Error('El pago no fue confirmado por la pasarela.');
        }

        const verification = await this.requireFn('verifyPaymentIntent')(paymentIntent.id);
        if (!verification.paid) {
            throw new Error('No pudimos verificar el pago. Intenta nuevamente.');
        }

        this.trackEvent('payment_success', {
            payment_method: 'card',
            payment_provider: 'stripe',
            payment_intent_id: paymentIntent.id
        });

        const captchaToken2 = await this.getCaptchaToken('appointment_submit');
        const payload = {
            ...appointmentPayload,
            paymentMethod: 'card',
            paymentStatus: 'paid',
            paymentProvider: 'stripe',
            paymentIntentId: paymentIntent.id,
            status: 'confirmed',
            captchaToken: captchaToken2
        };

        return this.requireFn('createAppointmentRecord')(payload, { allowLocalFallback: false });
    }

    async processTransferPaymentFlow() {
        const transferReference = (document.getElementById('transferReference')?.value || '').trim();
        if (transferReference.length < 3) {
            throw new Error('Ingresa el numero de referencia de la transferencia.');
        }

        const proofInput = document.getElementById('transferProofFile');
        const proofFile = proofInput?.files && proofInput.files[0] ? proofInput.files[0] : null;
        if (!proofFile) {
            throw new Error('Adjunta el comprobante de transferencia.');
        }
        if (proofFile.size > 5 * 1024 * 1024) {
            throw new Error('El comprobante supera el limite de 5 MB.');
        }

        const upload = await this.requireFn('uploadTransferProof')(proofFile, { retries: 2 });
        const appointmentPayload = await this.requireFn('buildAppointmentPayload')(this.getCurrentAppointment());

        const captchaToken = await this.getCaptchaToken('appointment_submit');

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
            captchaToken
        };

        return this.requireFn('createAppointmentRecord')(payload, { allowLocalFallback: false });
    }

    async processCashPaymentFlow() {
        const appointmentPayload = await this.requireFn('buildAppointmentPayload')(this.getCurrentAppointment());
        const captchaToken = await this.getCaptchaToken('appointment_submit');
        const payload = {
            ...appointmentPayload,
            paymentMethod: 'cash',
            paymentStatus: 'pending_cash',
            status: 'confirmed',
            captchaToken
        };

        return this.requireFn('createAppointmentRecord')(payload, { allowLocalFallback: false });
    }

    async processPayment() {
        if (this.isPaymentProcessing) return;
        this.isPaymentProcessing = true;

        const btn = document.querySelector('#paymentModal .btn-primary');
        if (!btn) {
            this.isPaymentProcessing = false;
            return;
        }

        const originalContent = btn.innerHTML;
        let paymentMethodUsed = 'cash';

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

        try {
            if (!this.getCurrentAppointment()) {
                this.showToast('Primero completa el formulario de cita.', 'warning');
                return;
            }

            const paymentMethod = this.getActivePaymentMethod();
            paymentMethodUsed = paymentMethod;
            this.clearPaymentError();
            this.trackEvent('payment_method_selected', {
                payment_method: paymentMethod || 'unknown',
                selection_source: 'submit'
            });
            this.setCheckoutStep('payment_method_selected', {
                paymentMethod: paymentMethod || 'unknown'
            });
            this.setCheckoutStep('payment_processing', {
                paymentMethod: paymentMethod || 'unknown'
            });

            let result;
            if (paymentMethod === 'card') {
                result = await this.processCardPaymentFlow();
            } else if (paymentMethod === 'transfer') {
                result = await this.processTransferPaymentFlow();
            } else {
                result = await this.processCashPaymentFlow();
            }

            this.setCurrentAppointment(result.appointment);

            this.setCheckoutStep('booking_confirmed', {
                paymentMethod: paymentMethod || 'unknown'
            });
            this.requireFn('completeCheckoutSession')(paymentMethod);
            this.closePaymentModal({ skipAbandonTrack: true });
            this.requireFn('showSuccessModal')(result.emailSent === true);
            this.showToast(
                paymentMethod === 'card'
                    ? 'Pago aprobado y cita registrada.'
                    : 'Cita registrada correctamente.',
                'success'
            );

            const form = document.getElementById('appointmentForm');
            if (form) form.reset();

            const summary = document.getElementById('priceSummary');
            if (summary) summary.classList.add('is-hidden');
        } catch (error) {
            const rawMessage = error?.message || '';
            let message = this.sanitizeBookingSubmissionError(rawMessage);
            if (
                paymentMethodUsed === 'card'
                && /horario ya fue reservado/i.test(rawMessage)
            ) {
                message = 'El pago fue aprobado, pero el horario acaba de ocuparse. Escribenos por WhatsApp para resolverlo de inmediato: 098 245 3672.';
            }

            this.trackEvent('checkout_error', {
                stage: 'payment_submit',
                payment_method: paymentMethodUsed || this.getActivePaymentMethod(),
                error_code: this.normalizeAnalyticsLabel(error?.code || message, 'payment_failed')
            });
            this.setCheckoutStep('payment_error', {
                paymentMethod: paymentMethodUsed || this.getActivePaymentMethod() || 'unknown'
            });

            this.setPaymentError(message);
            this.showToast(message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            this.isPaymentProcessing = false;
        }
    }

    bindPaymentListeners() {
        if (this.listenersBound) return;
        this.listenersBound = true;

        document.addEventListener('click', (e) => {
            const method = e.target.closest('.payment-method');
            if (!method) return;

            if (method.classList.contains('disabled')) {
                this.showToast('Pago con tarjeta no disponible por el momento.', 'warning');
                return;
            }

            document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('active'));
            method.classList.add('active');

            const methodType = method.dataset.method;
            this.syncPaymentForms(methodType);

            this.clearPaymentError();
            this.trackEvent('payment_method_selected', {
                payment_method: methodType || 'unknown'
            });

            if (methodType === 'card') {
                this.refreshCardPaymentAvailability().catch(error => {
                    this.setPaymentError(error?.message || 'No se pudo cargar el formulario de tarjeta');
                });
            }
        });

        document.addEventListener('change', (e) => {
            if (e.target && e.target.id === 'transferProofFile') {
                this.updateTransferProofFileName();
            }
        });
    }
}

export { BookingEngine };
