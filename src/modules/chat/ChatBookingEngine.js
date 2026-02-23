
const CHAT_SERVICES = [
    { key: 'consulta', label: 'Consulta Presencial', price: '$46.00' },
    { key: 'telefono', label: 'Consulta Telefónica', price: '$28.75' },
    { key: 'video', label: 'Video Consulta', price: '$34.50' },
    { key: 'laser', label: 'Tratamiento Láser', price: '$172.50' },
    {
        key: 'rejuvenecimiento',
        label: 'Rejuvenecimiento',
        price: '$138.00',
    },
];
const CHAT_DOCTORS = [
    { key: 'rosero', label: 'Dr. Javier Rosero' },
    { key: 'narvaez', label: 'Dra. Carolina Narvaez' },
    { key: 'indiferente', label: 'Cualquiera disponible' },
];

export class ChatBookingEngine {
    constructor() {
        this.deps = null;
        this.chatBooking = null;
    }

    init(inputDeps = {}) {
        this.deps = inputDeps || {};
        return this;
    }

    isActive() {
        return this.chatBooking !== null;
    }

    getLang() {
        return this.deps && typeof this.deps.getCurrentLang === 'function'
            ? this.deps.getCurrentLang()
            : 'es';
    }

    t(esText, enText) {
        return this.getLang() === 'en' ? enText : esText;
    }

    escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    sanitizeBookingRegistrationError(rawMessage) {
        const message = String(rawMessage || '').trim();
        if (!message) {
            return this.t(
                'Hubo un problema tecnico temporal al registrar la cita',
                'There was a temporary technical issue while registering your appointment'
            );
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
            return this.t(
                'Hubo un problema tecnico temporal al registrar la cita',
                'There was a temporary technical issue while registering your appointment'
            );
        }

        return message;
    }

    isCalendarUnavailableError(error) {
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

    isSlotUnavailableError(error) {
        if (!error) return false;
        const code = String(error.code || '').toLowerCase();
        const message = String(error.message || '').toLowerCase();
        return (
            code === 'slot_conflict' ||
            code === 'slot_unavailable' ||
            code === 'booking_slot_not_available' ||
            message.includes('no hay agenda disponible') ||
            message.includes('ese horario no esta disponible') ||
            message.includes('slot_conflict')
        );
    }

    buildChatDateInput() {
        const today = new Date().toISOString().split('T')[0];
        return `<input type="date" id="chatDateInput" min="${today}" data-action="chat-date-select" class="chat-date-input">`;
    }

    addBotMessage(html) {
        if (this.deps && typeof this.deps.addBotMessage === 'function') {
            this.deps.addBotMessage(html);
        }
    }

    addUserMessage(text) {
        if (this.deps && typeof this.deps.addUserMessage === 'function') {
            this.deps.addUserMessage(text);
        }
    }

    normalizeSelectionLabel(rawValue) {
        const value = String(rawValue || '');
        const service = CHAT_SERVICES.find((item) => item.key === value);
        if (service) return service.label;
        const doctor = CHAT_DOCTORS.find((item) => item.key === value);
        if (doctor) return doctor.label;
        if (value === 'efectivo' || value === 'cash') return 'Efectivo';
        if (value === 'tarjeta' || value === 'card') return 'Tarjeta';
        if (value === 'transferencia' || value === 'transfer')
            return 'Transferencia';
        return value;
    }

    trackChatBookingStep(step, payload = {}, options = {}) {
        if (
            !this.deps ||
            typeof this.deps.trackEvent !== 'function' ||
            !this.chatBooking ||
            !step
        ) {
            return;
        }

        const once = options && options.once !== false;
        if (once) {
            if (!this.chatBooking.completedSteps) {
                this.chatBooking.completedSteps = {};
            }
            if (this.chatBooking.completedSteps[step]) {
                return;
            }
            this.chatBooking.completedSteps[step] = true;
        }

        this.deps.trackEvent('booking_step_completed', {
            step,
            source: 'chatbot',
            ...payload,
        });
    }

    startChatBooking() {
        this.chatBooking = { step: 'service', completedSteps: {} };
        if (this.deps && typeof this.deps.trackEvent === 'function') {
            this.deps.trackEvent('booking_step_completed', {
                step: 'chat_booking_started',
                source: 'chatbot',
            });
        }
        let msg = this.t(
            'Vamos a agendar tu cita paso a paso.<br><br><strong>Paso 1/7:</strong> ¿Que servicio necesitas?<br><br>',
            'Let us schedule your appointment step by step.<br><br><strong>Step 1/7:</strong> Which service do you need?<br><br>'
        );
        msg += '<div class="chat-suggestions">';
        CHAT_SERVICES.forEach((service) => {
            msg += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${service.key}">${this.escapeHtml(service.label)} (${service.price})</button>`;
        });
        msg += '</div>';
        this.addBotMessage(msg);
    }

    cancelChatBooking(silent = false) {
        if (this.chatBooking && this.deps && typeof this.deps.trackEvent === 'function') {
            this.deps.trackEvent('checkout_abandon', {
                source: 'chatbot',
                reason: 'chat_cancel',
                step: this.chatBooking.step || 'unknown',
            });
        }
        this.chatBooking = null;
        if (!silent) {
            this.addBotMessage(
                this.t(
                    'Reserva cancelada. Si necesitas algo mas, estoy aqui para ayudarte.',
                    'Booking cancelled. If you need anything else, I am here to help.'
                )
            );
        }
    }

    isGeneralIntent(text) {
        const normalized = String(text || '').toLowerCase();
        return /(precio|costo|cuanto|doctor|humano|ayuda|hablar|contactar|ubicacion|donde|horario|telefono|whatsapp)/.test(
            normalized
        );
    }

    handleChatBookingSelection(value) {
        const cleanValue = String(value || '').trim();
        if (!cleanValue) {
            return;
        }
        this.addUserMessage(this.normalizeSelectionLabel(cleanValue));
        this.processChatBookingStep(cleanValue);
    }

    handleChatDateSelect(value) {
        const cleanValue = String(value || '').trim();
        if (!cleanValue) {
            return;
        }
        this.addUserMessage(cleanValue);
        this.processChatBookingStep(cleanValue);
    }

    async processChatBookingStep(userInput) {
        if (!this.chatBooking) return false;
        const input = String(userInput || '').trim();

        if (/cancelar|salir|no quiero|cancel|exit/i.test(input)) {
            this.cancelChatBooking();
            return true;
        }

        switch (this.chatBooking.step) {
            case 'service': {
                const service = CHAT_SERVICES.find(
                    (item) =>
                        item.key === input ||
                        item.label.toLowerCase() === input.toLowerCase()
                );
                if (!service) {
                    if (this.isGeneralIntent(input)) {
                        this.cancelChatBooking(true);
                        return false;
                    }
                    this.addBotMessage(
                        this.t(
                            'Por favor selecciona un servicio valido de las opciones.',
                            'Please choose a valid service from the options.'
                        )
                    );
                    return true;
                }
                this.chatBooking.service = service.key;
                this.chatBooking.serviceLabel = service.label;
                this.chatBooking.price = service.price;
                this.chatBooking.step = 'doctor';
                this.trackChatBookingStep('service_selected', {
                    service: service.key,
                });

                let msg = `${this.t('Servicio', 'Service')}: <strong>${this.escapeHtml(service.label)}</strong> (${service.price})<br><br>`;
                msg += this.t(
                    '<strong>Paso 2/7:</strong> ¿Con que doctor prefieres?<br><br>',
                    '<strong>Step 2/7:</strong> Which doctor do you prefer?<br><br>'
                );
                msg += '<div class="chat-suggestions">';
                CHAT_DOCTORS.forEach((doctor) => {
                    msg += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${doctor.key}">${this.escapeHtml(doctor.label)}</button>`;
                });
                msg += '</div>';
                this.addBotMessage(msg);
                break;
            }

            case 'doctor': {
                const doctor = CHAT_DOCTORS.find(
                    (item) =>
                        item.key === input ||
                        item.label.toLowerCase() === input.toLowerCase()
                );
                if (!doctor) {
                    if (this.isGeneralIntent(input)) {
                        this.cancelChatBooking(true);
                        return false;
                    }
                    this.addBotMessage(
                        this.t(
                            'Por favor selecciona un doctor de las opciones.',
                            'Please choose a doctor from the options.'
                        )
                    );
                    return true;
                }
                this.chatBooking.doctor = doctor.key;
                this.chatBooking.doctorLabel = doctor.label;
                this.chatBooking.step = 'date';
                this.trackChatBookingStep('doctor_selected', {
                    doctor: doctor.key,
                });

                const today = new Date().toISOString().split('T')[0];
                let msg = `${this.t('Doctor', 'Doctor')}: <strong>${this.escapeHtml(doctor.label)}</strong><br><br>`;
                msg += this.t(
                    '<strong>Paso 3/7:</strong> ¿Que fecha prefieres?<br><br>',
                    '<strong>Step 3/7:</strong> Which date do you prefer?<br><br>'
                );
                msg += `<input type="date" id="chatDateInput" min="${today}" `;
                msg += 'data-action="chat-date-select" ';
                msg += 'class="chat-date-input">';
                this.addBotMessage(msg);
                break;
            }

            case 'date': {
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(input)) {
                    this.addBotMessage(
                        this.t(
                            'Por favor selecciona una fecha valida (usa el calendario).',
                            'Please select a valid date (use the date picker).'
                        )
                    );
                    return true;
                }

                const selectedDate = new Date(`${input}T12:00:00`);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (selectedDate < today) {
                    this.addBotMessage(
                        this.t(
                            'La fecha debe ser hoy o en el futuro. Selecciona otra fecha.',
                            'Date must be today or in the future. Please choose another date.'
                        )
                    );
                    return true;
                }

                this.chatBooking.date = input;
                this.chatBooking.step = 'time';
                this.trackChatBookingStep('date_selected', {
                    date: input,
                });

                if (this.deps && typeof this.deps.showTypingIndicator === 'function') {
                    this.deps.showTypingIndicator();
                }

                try {
                    const availability =
                        this.deps && typeof this.deps.loadAvailabilityData === 'function'
                            ? await this.deps.loadAvailabilityData({
                                  doctor: this.chatBooking.doctor || 'indiferente',
                                  service: this.chatBooking.service || 'consulta',
                                  strict: true,
                              })
                            : {};
                    const booked =
                        this.deps && typeof this.deps.getBookedSlots === 'function'
                            ? await this.deps.getBookedSlots(
                                  input,
                                  this.chatBooking.doctor || '',
                                  this.chatBooking.service || 'consulta'
                              )
                            : [];
                    const allSlots =
                        Array.isArray(availability[input]) &&
                        availability[input].length > 0
                            ? availability[input]
                            : [];
                    const isToday =
                        input === new Date().toISOString().split('T')[0];
                    const nowMinutes = isToday
                        ? new Date().getHours() * 60 + new Date().getMinutes()
                        : -1;
                    const freeSlots = allSlots
                        .filter((slot) => {
                            if (booked.includes(slot)) return false;
                            if (isToday) {
                                const [h, m] = slot.split(':').map(Number);
                                if (h * 60 + m <= nowMinutes + 60) return false;
                            }
                            return true;
                        })
                        .sort();

                    if (
                        this.deps &&
                        typeof this.deps.removeTypingIndicator === 'function'
                    ) {
                        this.deps.removeTypingIndicator();
                    }

                    if (freeSlots.length === 0) {
                        this.addBotMessage(
                            this.t(
                                'No hay horarios disponibles para esa fecha. Por favor elige otra.<br><br>',
                                'No times are available for that date. Please choose another one.<br><br>'
                            ) +
                                `<input type="date" id="chatDateInput" min="${new Date().toISOString().split('T')[0]}" data-action="chat-date-select" class="chat-date-input">`
                        );
                        this.chatBooking.step = 'date';
                        return true;
                    }

                    const locale = this.getLang() === 'en' ? 'en-US' : 'es-EC';
                    const dateLabel = selectedDate.toLocaleDateString(locale, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                    });
                    let msg = `${this.t('Fecha', 'Date')}: <strong>${this.escapeHtml(dateLabel)}</strong><br><br>`;
                    msg += this.t(
                        '<strong>Paso 4/7:</strong> Horarios disponibles:<br><br>',
                        '<strong>Step 4/7:</strong> Available times:<br><br>'
                    );
                    msg += '<div class="chat-suggestions">';
                    freeSlots.forEach((time) => {
                        msg += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${time}">${time}</button>`;
                    });
                    msg += '</div>';
                    this.addBotMessage(msg);
                } catch (error) {
                    const isCalendarUnavailable = this.isCalendarUnavailableError(error);
                    if (
                        this.deps &&
                        typeof this.deps.removeTypingIndicator === 'function'
                    ) {
                        this.deps.removeTypingIndicator();
                    }
                    this.addBotMessage(
                        isCalendarUnavailable
                            ? this.t(
                                  'La agenda esta temporalmente no disponible. Intenta de nuevo en unos minutos.',
                                  'The schedule is temporarily unavailable. Please try again in a few minutes.'
                              )
                            : this.t(
                                  'No pude consultar los horarios. Intenta de nuevo.',
                                  'I could not load the schedule. Please try again.'
                              )
                    );
                    this.chatBooking.step = 'date';
                }
                break;
            }

            case 'time': {
                if (!/^\d{2}:\d{2}$/.test(input)) {
                    this.addBotMessage(
                        this.t(
                            'Por favor selecciona un horario valido de las opciones.',
                            'Please choose a valid time from the options.'
                        )
                    );
                    return true;
                }
                this.chatBooking.time = input;
                this.chatBooking.step = 'name';
                this.trackChatBookingStep('time_selected', {
                    time: input,
                });
                this.addBotMessage(
                    `${this.t('Hora', 'Time')}: <strong>${this.escapeHtml(input)}</strong><br><br>${this.t('<strong>Paso 5/7:</strong> ¿Cual es tu nombre completo?', '<strong>Step 5/7:</strong> What is your full name?')}`
                );
                break;
            }

            case 'name': {
                if (input.length < 2) {
                    this.addBotMessage(
                        this.t(
                            'El nombre debe tener al menos 2 caracteres.',
                            'Name must be at least 2 characters long.'
                        )
                    );
                    return true;
                }
                this.chatBooking.name = input;
                this.chatBooking.step = 'email';
                this.trackChatBookingStep('name_added');
                this.addBotMessage(
                    `${this.t('Nombre', 'Name')}: <strong>${this.escapeHtml(input)}</strong><br><br>${this.t('<strong>Paso 6/7:</strong> ¿Cual es tu email?', '<strong>Step 6/7:</strong> What is your email?')}`
                );
                break;
            }

            case 'email': {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(input)) {
                    this.addBotMessage(
                        this.t(
                            'El formato del email no es valido. Ejemplo: nombre@correo.com',
                            'Invalid email format. Example: name@example.com'
                        )
                    );
                    return true;
                }
                this.chatBooking.email = input;
                this.chatBooking.step = 'phone';
                this.trackChatBookingStep('email_added');
                this.addBotMessage(
                    `${this.t('Email', 'Email')}: <strong>${this.escapeHtml(input)}</strong><br><br>${this.t('<strong>Paso 7/7:</strong> ¿Cual es tu numero de telefono?', '<strong>Step 7/7:</strong> What is your phone number?')}`
                );
                break;
            }

            case 'phone': {
                const digits = input.replace(/\D/g, '');
                if (digits.length < 7 || digits.length > 15) {
                    this.addBotMessage(
                        this.t(
                            'El telefono debe tener entre 7 y 15 digitos.',
                            'Phone number must have between 7 and 15 digits.'
                        )
                    );
                    return true;
                }
                this.chatBooking.phone = input;
                this.chatBooking.step = 'payment';
                this.trackChatBookingStep('contact_info_completed');

                let msg = `${this.t('Telefono', 'Phone')}: <strong>${this.escapeHtml(input)}</strong><br><br>`;
                msg += `<strong>${this.t('Resumen de tu cita', 'Appointment summary')}:</strong><br>`;
                msg += `&bull; ${this.t('Servicio', 'Service')}: ${this.escapeHtml(this.chatBooking.serviceLabel)} (${this.chatBooking.price})<br>`;
                msg += `&bull; ${this.t('Doctor', 'Doctor')}: ${this.escapeHtml(this.chatBooking.doctorLabel)}<br>`;
                msg += `&bull; ${this.t('Fecha', 'Date')}: ${this.escapeHtml(this.chatBooking.date)}<br>`;
                msg += `&bull; ${this.t('Hora', 'Time')}: ${this.escapeHtml(this.chatBooking.time)}<br>`;
                msg += `&bull; ${this.t('Nombre', 'Name')}: ${this.escapeHtml(this.chatBooking.name)}<br>`;
                msg += `&bull; Email: ${this.escapeHtml(this.chatBooking.email)}<br>`;
                msg += `&bull; ${this.t('Telefono', 'Phone')}: ${this.escapeHtml(this.chatBooking.phone)}<br><br>`;
                msg += `${this.t('¿Como deseas pagar?', 'How would you like to pay?')}<br><br>`;
                msg += '<div class="chat-suggestions">';
                msg +=
                    '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="efectivo"><i class="fas fa-money-bill-wave"></i> Efectivo</button>';
                msg +=
                    '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="tarjeta"><i class="fas fa-credit-card"></i> Tarjeta</button>';
                msg +=
                    '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="transferencia"><i class="fas fa-university"></i> Transferencia</button>';
                msg += '</div>';
                this.addBotMessage(msg);
                break;
            }

            case 'payment': {
                const paymentMap = {
                    efectivo: 'cash',
                    cash: 'cash',
                    tarjeta: 'card',
                    card: 'card',
                    transferencia: 'transfer',
                    transfer: 'transfer',
                };
                const method = paymentMap[input.toLowerCase()];
                if (!method) {
                    this.addBotMessage(
                        this.t(
                            'Elige un metodo de pago: Efectivo, Tarjeta o Transferencia.',
                            'Choose a payment method: Cash, Card, or Transfer.'
                        )
                    );
                    return true;
                }

                this.chatBooking.paymentMethod = method;
                this.chatBooking.step = 'confirm';
                this.trackChatBookingStep('payment_method_selected', {
                    payment_method: method,
                });
                await this.finalizeChatBooking();
                break;
            }
        }
        return true;
    }

    async finalizeChatBooking() {
        if (!this.chatBooking) return;

        const appointment = {
            service: this.chatBooking.service,
            doctor: this.chatBooking.doctor,
            date: this.chatBooking.date,
            time: this.chatBooking.time,
            name: this.chatBooking.name,
            email: this.chatBooking.email,
            phone: this.chatBooking.phone,
            privacyConsent: true,
            price: this.chatBooking.price,
        };

        if (this.deps && typeof this.deps.startCheckoutSession === 'function') {
            this.deps.startCheckoutSession(appointment, {
                checkoutEntry: 'chatbot',
                step: 'chat_booking_validated',
            });
        }
        if (this.deps && typeof this.deps.trackEvent === 'function') {
            this.deps.trackEvent('start_checkout', {
                service: appointment.service || '',
                doctor: appointment.doctor || '',
                checkout_entry: 'chatbot',
            });
            this.deps.trackEvent('payment_method_selected', {
                payment_method: this.chatBooking.paymentMethod || 'unknown',
            });
        }
        if (this.deps && typeof this.deps.setCheckoutStep === 'function') {
            this.deps.setCheckoutStep('payment_method_selected', {
                checkoutEntry: 'chatbot',
                paymentMethod: this.chatBooking.paymentMethod || 'unknown',
                service: appointment.service || '',
                doctor: appointment.doctor || '',
            });
        }

        if (this.chatBooking.paymentMethod === 'cash') {
            if (this.deps && typeof this.deps.showTypingIndicator === 'function') {
                this.deps.showTypingIndicator();
            }
            if (this.deps && typeof this.deps.setCheckoutStep === 'function') {
                this.deps.setCheckoutStep('payment_processing', {
                    checkoutEntry: 'chatbot',
                    paymentMethod: 'cash',
                });
            }

            try {
                const payload = {
                    ...appointment,
                    paymentMethod: 'cash',
                    paymentStatus: 'pending_cash',
                    status: 'confirmed',
                };
                const result =
                    this.deps && typeof this.deps.createAppointmentRecord === 'function'
                        ? await this.deps.createAppointmentRecord(payload)
                        : null;
                if (!result) {
                    throw new Error('Could not create appointment record');
                }

                if (this.deps && typeof this.deps.removeTypingIndicator === 'function') {
                    this.deps.removeTypingIndicator();
                }
                if (
                    result &&
                    typeof this.deps.setCurrentAppointment === 'function'
                ) {
                    this.deps.setCurrentAppointment(result.appointment);
                }
                if (
                    this.deps &&
                    typeof this.deps.completeCheckoutSession === 'function'
                ) {
                    this.deps.completeCheckoutSession('cash');
                }
                if (this.deps && typeof this.deps.setCheckoutStep === 'function') {
                    this.deps.setCheckoutStep('booking_confirmed', {
                        checkoutEntry: 'chatbot',
                        paymentMethod: 'cash',
                    });
                }

                let msg = `<strong>${this.t('¡Cita agendada con exito!', 'Appointment booked successfully!')}</strong><br><br>`;
                msg += this.t(
                    'Tu cita ha sido registrada. ',
                    'Your appointment has been registered. '
                );
                if (result && result.emailSent) {
                    msg += this.t(
                        'Te enviamos un correo de confirmacion.<br><br>',
                        'We sent you a confirmation email.<br><br>'
                    );
                } else {
                    msg += this.t(
                        'Te contactaremos para confirmar detalles.<br><br>',
                        'We will contact you to confirm details.<br><br>'
                    );
                }
                msg += `&bull; ${this.t('Servicio', 'Service')}: ${this.escapeHtml(this.chatBooking.serviceLabel)}<br>`;
                msg += `&bull; ${this.t('Doctor', 'Doctor')}: ${this.escapeHtml(this.chatBooking.doctorLabel)}<br>`;
                msg += `&bull; ${this.t('Fecha', 'Date')}: ${this.escapeHtml(this.chatBooking.date)}<br>`;
                msg += `&bull; ${this.t('Hora', 'Time')}: ${this.escapeHtml(this.chatBooking.time)}<br>`;
                msg += `&bull; ${this.t('Pago', 'Payment')}: ${this.t('En consultorio', 'At clinic')}<br><br>`;
                msg += this.t(
                    'Recuerda llegar 10 minutos antes de tu cita.',
                    'Please arrive 10 minutes before your appointment.'
                );
                this.addBotMessage(msg);

                if (this.deps && typeof this.deps.showToast === 'function') {
                    this.deps.showToast(
                        this.t(
                            'Cita agendada correctamente desde el asistente.',
                            'Appointment booked from chat assistant.'
                        ),
                        'success'
                    );
                }

                this.chatBooking = null;
            } catch (error) {
                if (this.deps && typeof this.deps.removeTypingIndicator === 'function') {
                    this.deps.removeTypingIndicator();
                }

                if (this.isCalendarUnavailableError(error)) {
                    this.addBotMessage(
                        this.t(
                            'La agenda esta temporalmente no disponible. Intenta de nuevo en unos minutos o agenda por WhatsApp.<br><br>',
                            'The schedule is temporarily unavailable. Please try again in a few minutes or book via WhatsApp.<br><br>'
                        ) + this.buildChatDateInput()
                    );
                    if (this.deps && typeof this.deps.setCheckoutStep === 'function') {
                        this.deps.setCheckoutStep('payment_error', {
                            checkoutEntry: 'chatbot',
                            paymentMethod: 'cash',
                            reason: 'calendar_unreachable',
                        });
                    }
                    this.chatBooking.step = 'date';
                    return;
                }

                if (this.isSlotUnavailableError(error)) {
                    this.addBotMessage(
                        this.t(
                            'Ese horario ya no esta disponible. Elige una nueva fecha u hora para continuar.<br><br>',
                            'That slot is no longer available. Please choose a new date or time to continue.<br><br>'
                        ) + this.buildChatDateInput()
                    );
                    if (this.deps && typeof this.deps.setCheckoutStep === 'function') {
                        this.deps.setCheckoutStep('payment_error', {
                            checkoutEntry: 'chatbot',
                            paymentMethod: 'cash',
                            reason: 'slot_unavailable',
                        });
                    }
                    this.chatBooking.step = 'date';
                    return;
                }

                const safeError = this.sanitizeBookingRegistrationError(
                    error && error.message ? error.message : ''
                );
                this.addBotMessage(
                    this.t(
                        `No se pudo registrar la cita: ${this.escapeHtml(safeError)}. Intenta de nuevo o agenda desde <a href="#citas" data-action="minimize-chat">el formulario</a>.`,
                        `Could not register your appointment: ${this.escapeHtml(safeError)}. Try again or use the <a href="#citas" data-action="minimize-chat">booking form</a>.`
                    )
                );
                if (this.deps && typeof this.deps.setCheckoutStep === 'function') {
                    this.deps.setCheckoutStep('payment_error', {
                        checkoutEntry: 'chatbot',
                        paymentMethod: 'cash',
                    });
                }
                this.chatBooking.step = 'payment';
            }
            return;
        }

        if (typeof this.deps.setCurrentAppointment === 'function') {
            this.deps.setCurrentAppointment(appointment);
        }
        const method = this.chatBooking.paymentMethod;
        this.chatBooking = null;

        this.addBotMessage(
            this.t(
                `Abriendo el modulo de pago por <strong>${method === 'card' ? 'tarjeta' : 'transferencia'}</strong>...<br>Completa el pago en la ventana que se abrira.`,
                `Opening payment module for <strong>${method === 'card' ? 'card' : 'transfer'}</strong>...<br>Please complete payment in the modal window.`
            )
        );

        setTimeout(() => {
            if (this.deps && typeof this.deps.minimizeChatbot === 'function') {
                this.deps.minimizeChatbot();
            }
            if (this.deps && typeof this.deps.openPaymentModal === 'function') {
                this.deps.openPaymentModal(appointment);
            }
            setTimeout(() => {
                const methodEl = document.querySelector(
                    `.payment-method[data-method="${method}"]`
                );
                if (methodEl && !methodEl.classList.contains('disabled')) {
                    methodEl.click();
                }
            }, 300);
        }, 800);
    }
}
