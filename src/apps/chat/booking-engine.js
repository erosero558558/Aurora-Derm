'use strict';

let deps = null;
let chatBooking = null;
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

function getLang() {
    return deps && typeof deps.getCurrentLang === 'function'
        ? deps.getCurrentLang()
        : 'es';
}

function t(esText, enText) {
    return getLang() === 'en' ? enText : esText;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function sanitizeBookingRegistrationError(rawMessage) {
    const message = String(rawMessage || '').trim();
    if (!message) {
        return t(
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
        return t(
            'Hubo un problema tecnico temporal al registrar la cita',
            'There was a temporary technical issue while registering your appointment'
        );
    }

    return message;
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

function isSlotUnavailableError(error) {
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

function getTodayDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildChatDateInput() {
    const today = getTodayDateKey();
    return `<input type="date" id="chatDateInput" min="${today}" data-action="chat-date-select" class="chat-date-input">`;
}

function addBotMessage(html) {
    if (deps && typeof deps.addBotMessage === 'function') {
        deps.addBotMessage(html);
    }
}

function addUserMessage(text) {
    if (deps && typeof deps.addUserMessage === 'function') {
        deps.addUserMessage(text);
    }
}

function normalizeSelectionLabel(rawValue) {
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

function trackChatBookingStep(step, payload = {}, options = {}) {
    if (
        !deps ||
        typeof deps.trackEvent !== 'function' ||
        !chatBooking ||
        !step
    ) {
        return;
    }

    const once = options && options.once !== false;
    if (once) {
        if (!chatBooking.completedSteps) {
            chatBooking.completedSteps = {};
        }
        if (chatBooking.completedSteps[step]) {
            return;
        }
        chatBooking.completedSteps[step] = true;
    }

    deps.trackEvent('booking_step_completed', {
        step,
        source: 'chatbot',
        ...payload,
    });
}

function normalizeAnalyticsErrorCode(value, fallback = 'unknown') {
    if (deps && typeof deps.normalizeAnalyticsLabel === 'function') {
        return deps.normalizeAnalyticsLabel(value, fallback);
    }

    const normalized = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);

    return normalized || fallback;
}

function trackChatCheckoutError(payload = {}) {
    if (!deps || typeof deps.trackEvent !== 'function') {
        return;
    }

    deps.trackEvent('checkout_error', {
        source: 'chatbot',
        ...payload,
    });
}

function startChatBooking() {
    chatBooking = { step: 'service', completedSteps: {} };
    if (deps && typeof deps.trackEvent === 'function') {
        deps.trackEvent('booking_step_completed', {
            step: 'chat_booking_started',
            source: 'chatbot',
        });
    }
    let msg = t(
        'Vamos a agendar tu cita paso a paso.<br><br><strong>Paso 1/7:</strong> ¿Que servicio necesitas?<br><br>',
        'Let us schedule your appointment step by step.<br><br><strong>Step 1/7:</strong> Which service do you need?<br><br>'
    );
    msg += '<div class="chat-suggestions">';
    CHAT_SERVICES.forEach((service) => {
        msg += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${service.key}">${escapeHtml(service.label)} (${service.price})</button>`;
    });
    msg += '</div>';
    addBotMessage(msg);
}

function cancelChatBooking(silent = false) {
    if (chatBooking && deps && typeof deps.trackEvent === 'function') {
        deps.trackEvent('checkout_abandon', {
            source: 'chatbot',
            reason: 'chat_cancel',
            checkout_step: chatBooking.step || 'unknown',
            payment_method: chatBooking.paymentMethod || 'unknown',
        });
    }
    chatBooking = null;
    if (!silent) {
        addBotMessage(
            t(
                'Reserva cancelada. Si necesitas algo mas, estoy aqui para ayudarte.',
                'Booking cancelled. If you need anything else, I am here to help.'
            )
        );
    }
}

function isGeneralIntent(text) {
    const normalized = String(text || '').toLowerCase();
    return /(precio|costo|cuanto|doctor|humano|ayuda|hablar|contactar|ubicacion|donde|horario|telefono|whatsapp)/.test(
        normalized
    );
}

function handleChatBookingSelection(value) {
    const cleanValue = String(value || '').trim();
    if (!cleanValue) {
        return;
    }
    addUserMessage(normalizeSelectionLabel(cleanValue));
    processChatBookingStep(cleanValue);
}

function handleChatDateSelect(value) {
    const cleanValue = String(value || '').trim();
    if (!cleanValue) {
        return;
    }
    addUserMessage(cleanValue);
    processChatBookingStep(cleanValue);
}

async function processChatBookingStep(userInput) {
    if (!chatBooking) return false;
    const input = String(userInput || '').trim();

    if (/cancelar|salir|no quiero|cancel|exit/i.test(input)) {
        cancelChatBooking();
        return true;
    }

    switch (chatBooking.step) {
        case 'service': {
            const service = CHAT_SERVICES.find(
                (item) =>
                    item.key === input ||
                    item.label.toLowerCase() === input.toLowerCase()
            );
            if (!service) {
                if (isGeneralIntent(input)) {
                    cancelChatBooking(true);
                    return false;
                }
                addBotMessage(
                    t(
                        'Por favor selecciona un servicio valido de las opciones.',
                        'Please choose a valid service from the options.'
                    )
                );
                return true;
            }
            chatBooking.service = service.key;
            chatBooking.serviceLabel = service.label;
            chatBooking.price = service.price;
            chatBooking.step = 'doctor';
            trackChatBookingStep('service_selected', {
                service: service.key,
            });

            let msg = `${t('Servicio', 'Service')}: <strong>${escapeHtml(service.label)}</strong> (${service.price})<br><br>`;
            msg += t(
                '<strong>Paso 2/7:</strong> ¿Con que doctor prefieres?<br><br>',
                '<strong>Step 2/7:</strong> Which doctor do you prefer?<br><br>'
            );
            msg += '<div class="chat-suggestions">';
            CHAT_DOCTORS.forEach((doctor) => {
                msg += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${doctor.key}">${escapeHtml(doctor.label)}</button>`;
            });
            msg += '</div>';
            addBotMessage(msg);
            break;
        }

        case 'doctor': {
            const doctor = CHAT_DOCTORS.find(
                (item) =>
                    item.key === input ||
                    item.label.toLowerCase() === input.toLowerCase()
            );
            if (!doctor) {
                if (isGeneralIntent(input)) {
                    cancelChatBooking(true);
                    return false;
                }
                addBotMessage(
                    t(
                        'Por favor selecciona un doctor de las opciones.',
                        'Please choose a doctor from the options.'
                    )
                );
                return true;
            }
            chatBooking.doctor = doctor.key;
            chatBooking.doctorLabel = doctor.label;
            chatBooking.step = 'date';
            trackChatBookingStep('doctor_selected', {
                doctor: doctor.key,
            });

            const today = getTodayDateKey();
            let msg = `${t('Doctor', 'Doctor')}: <strong>${escapeHtml(doctor.label)}</strong><br><br>`;
            msg += t(
                '<strong>Paso 3/7:</strong> ¿Que fecha prefieres?<br><br>',
                '<strong>Step 3/7:</strong> Which date do you prefer?<br><br>'
            );
            msg += `<input type="date" id="chatDateInput" min="${today}" `;
            msg += 'data-action="chat-date-select" ';
            msg += 'class="chat-date-input">';
            addBotMessage(msg);
            break;
        }

        case 'date': {
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(input)) {
                addBotMessage(
                    t(
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
                addBotMessage(
                    t(
                        'La fecha debe ser hoy o en el futuro. Selecciona otra fecha.',
                        'Date must be today or in the future. Please choose another date.'
                    )
                );
                return true;
            }

            chatBooking.date = input;
            chatBooking.step = 'time';
            trackChatBookingStep('date_selected', {
                date: input,
            });

            if (deps && typeof deps.showTypingIndicator === 'function') {
                deps.showTypingIndicator();
            }

            try {
                const availability =
                    deps && typeof deps.loadAvailabilityData === 'function'
                        ? await deps.loadAvailabilityData({
                              doctor: chatBooking.doctor || 'indiferente',
                              service: chatBooking.service || 'consulta',
                              strict: true,
                          })
                        : {};
                const booked =
                    deps && typeof deps.getBookedSlots === 'function'
                        ? await deps.getBookedSlots(
                              input,
                              chatBooking.doctor || '',
                              chatBooking.service || 'consulta'
                          )
                        : [];
                const allSlots =
                    Array.isArray(availability[input]) &&
                    availability[input].length > 0
                        ? availability[input]
                        : [];
                const isToday = input === getTodayDateKey();
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

                if (deps && typeof deps.removeTypingIndicator === 'function') {
                    deps.removeTypingIndicator();
                }

                if (freeSlots.length === 0) {
                    addBotMessage(
                        t(
                            'No hay horarios disponibles para esa fecha. Por favor elige otra.<br><br>',
                            'No times are available for that date. Please choose another one.<br><br>'
                        ) +
                            `<input type="date" id="chatDateInput" min="${getTodayDateKey()}" data-action="chat-date-select" class="chat-date-input">`
                    );
                    chatBooking.step = 'date';
                    return true;
                }

                const locale = getLang() === 'en' ? 'en-US' : 'es-EC';
                const dateLabel = selectedDate.toLocaleDateString(locale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                });
                let msg = `${t('Fecha', 'Date')}: <strong>${escapeHtml(dateLabel)}</strong><br><br>`;
                msg += t(
                    '<strong>Paso 4/7:</strong> Horarios disponibles:<br><br>',
                    '<strong>Step 4/7:</strong> Available times:<br><br>'
                );
                msg += '<div class="chat-suggestions">';
                freeSlots.forEach((time) => {
                    msg += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${time}">${time}</button>`;
                });
                msg += '</div>';
                addBotMessage(msg);
            } catch (error) {
                const isCalendarUnavailable = isCalendarUnavailableError(error);
                if (deps && typeof deps.removeTypingIndicator === 'function') {
                    deps.removeTypingIndicator();
                }
                addBotMessage(
                    isCalendarUnavailable
                        ? t(
                              'La agenda esta temporalmente no disponible. Intenta de nuevo en unos minutos.',
                              'The schedule is temporarily unavailable. Please try again in a few minutes.'
                          )
                        : t(
                              'No pude consultar los horarios. Intenta de nuevo.',
                              'I could not load the schedule. Please try again.'
                          )
                );
                trackChatCheckoutError({
                    stage: 'availability_lookup',
                    payment_method: chatBooking.paymentMethod || 'unknown',
                    error_code: isCalendarUnavailable
                        ? 'calendar_unreachable'
                        : normalizeAnalyticsErrorCode(
                              error && error.code
                                  ? error.code
                                  : 'availability_error',
                              'availability_error'
                          ),
                });
                chatBooking.step = 'date';
            }
            break;
        }

        case 'time': {
            if (!/^\d{2}:\d{2}$/.test(input)) {
                addBotMessage(
                    t(
                        'Por favor selecciona un horario valido de las opciones.',
                        'Please choose a valid time from the options.'
                    )
                );
                return true;
            }
            chatBooking.time = input;
            chatBooking.step = 'name';
            trackChatBookingStep('time_selected', {
                time: input,
            });
            addBotMessage(
                `${t('Hora', 'Time')}: <strong>${escapeHtml(input)}</strong><br><br>${t('<strong>Paso 5/7:</strong> ¿Cual es tu nombre completo?', '<strong>Step 5/7:</strong> What is your full name?')}`
            );
            break;
        }

        case 'name': {
            if (input.length < 2) {
                addBotMessage(
                    t(
                        'El nombre debe tener al menos 2 caracteres.',
                        'Name must be at least 2 characters long.'
                    )
                );
                return true;
            }
            chatBooking.name = input;
            chatBooking.step = 'email';
            trackChatBookingStep('name_added');
            addBotMessage(
                `${t('Nombre', 'Name')}: <strong>${escapeHtml(input)}</strong><br><br>${t('<strong>Paso 6/7:</strong> ¿Cual es tu email?', '<strong>Step 6/7:</strong> What is your email?')}`
            );
            break;
        }

        case 'email': {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input)) {
                addBotMessage(
                    t(
                        'El formato del email no es valido. Ejemplo: nombre@correo.com',
                        'Invalid email format. Example: name@example.com'
                    )
                );
                return true;
            }
            chatBooking.email = input;
            chatBooking.step = 'phone';
            trackChatBookingStep('email_added');
            addBotMessage(
                `${t('Email', 'Email')}: <strong>${escapeHtml(input)}</strong><br><br>${t('<strong>Paso 7/7:</strong> ¿Cual es tu numero de telefono?', '<strong>Step 7/7:</strong> What is your phone number?')}`
            );
            break;
        }

        case 'phone': {
            const digits = input.replace(/\D/g, '');
            if (digits.length < 7 || digits.length > 15) {
                addBotMessage(
                    t(
                        'El telefono debe tener entre 7 y 15 digitos.',
                        'Phone number must have between 7 and 15 digits.'
                    )
                );
                return true;
            }
            chatBooking.phone = input;
            chatBooking.step = 'payment';
            trackChatBookingStep('contact_info_completed');

            let msg = `${t('Telefono', 'Phone')}: <strong>${escapeHtml(input)}</strong><br><br>`;
            msg += `<strong>${t('Resumen de tu cita', 'Appointment summary')}:</strong><br>`;
            msg += `&bull; ${t('Servicio', 'Service')}: ${escapeHtml(chatBooking.serviceLabel)} (${chatBooking.price})<br>`;
            msg += `&bull; ${t('Doctor', 'Doctor')}: ${escapeHtml(chatBooking.doctorLabel)}<br>`;
            msg += `&bull; ${t('Fecha', 'Date')}: ${escapeHtml(chatBooking.date)}<br>`;
            msg += `&bull; ${t('Hora', 'Time')}: ${escapeHtml(chatBooking.time)}<br>`;
            msg += `&bull; ${t('Nombre', 'Name')}: ${escapeHtml(chatBooking.name)}<br>`;
            msg += `&bull; Email: ${escapeHtml(chatBooking.email)}<br>`;
            msg += `&bull; ${t('Telefono', 'Phone')}: ${escapeHtml(chatBooking.phone)}<br><br>`;
            msg += `${t('¿Como deseas pagar?', 'How would you like to pay?')}<br><br>`;
            msg += '<div class="chat-suggestions">';
            msg +=
                '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="efectivo"><i class="fas fa-money-bill-wave"></i> Efectivo</button>';
            msg +=
                '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="tarjeta"><i class="fas fa-credit-card"></i> Tarjeta</button>';
            msg +=
                '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="transferencia"><i class="fas fa-university"></i> Transferencia</button>';
            msg += '</div>';
            addBotMessage(msg);
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
                addBotMessage(
                    t(
                        'Elige un metodo de pago: Efectivo, Tarjeta o Transferencia.',
                        'Choose a payment method: Cash, Card, or Transfer.'
                    )
                );
                return true;
            }

            chatBooking.paymentMethod = method;
            chatBooking.step = 'confirm';
            trackChatBookingStep('payment_method_selected', {
                payment_method: method,
            });
            await finalizeChatBooking();
            break;
        }
    }
    return true;
}

async function finalizeChatBooking() {
    if (!chatBooking) return;

    const appointment = {
        service: chatBooking.service,
        doctor: chatBooking.doctor,
        date: chatBooking.date,
        time: chatBooking.time,
        name: chatBooking.name,
        email: chatBooking.email,
        phone: chatBooking.phone,
        privacyConsent: true,
        price: chatBooking.price,
    };

    if (deps && typeof deps.startCheckoutSession === 'function') {
        deps.startCheckoutSession(appointment, {
            checkoutEntry: 'chatbot',
            step: 'chat_booking_validated',
        });
    }
    if (deps && typeof deps.trackEvent === 'function') {
        deps.trackEvent('start_checkout', {
            service: appointment.service || '',
            doctor: appointment.doctor || '',
            checkout_entry: 'chatbot',
        });
        deps.trackEvent('payment_method_selected', {
            payment_method: chatBooking.paymentMethod || 'unknown',
        });
    }
    if (deps && typeof deps.setCheckoutStep === 'function') {
        deps.setCheckoutStep('payment_method_selected', {
            checkoutEntry: 'chatbot',
            paymentMethod: chatBooking.paymentMethod || 'unknown',
            service: appointment.service || '',
            doctor: appointment.doctor || '',
        });
    }

    if (chatBooking.paymentMethod === 'cash') {
        if (deps && typeof deps.showTypingIndicator === 'function') {
            deps.showTypingIndicator();
        }
        if (deps && typeof deps.setCheckoutStep === 'function') {
            deps.setCheckoutStep('payment_processing', {
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
                deps && typeof deps.createAppointmentRecord === 'function'
                    ? await deps.createAppointmentRecord(payload)
                    : null;
            if (!result) {
                throw new Error('Could not create appointment record');
            }

            if (deps && typeof deps.removeTypingIndicator === 'function') {
                deps.removeTypingIndicator();
            }
            if (result && typeof deps.setCurrentAppointment === 'function') {
                deps.setCurrentAppointment(result.appointment);
            }
            if (deps && typeof deps.completeCheckoutSession === 'function') {
                deps.completeCheckoutSession('cash');
            }
            if (deps && typeof deps.setCheckoutStep === 'function') {
                deps.setCheckoutStep('booking_confirmed', {
                    checkoutEntry: 'chatbot',
                    paymentMethod: 'cash',
                });
            }

            let msg = `<strong>${t('¡Cita agendada con exito!', 'Appointment booked successfully!')}</strong><br><br>`;
            msg += t(
                'Tu cita ha sido registrada. ',
                'Your appointment has been registered. '
            );
            if (result && result.emailSent) {
                msg += t(
                    'Te enviamos un correo de confirmacion.<br><br>',
                    'We sent you a confirmation email.<br><br>'
                );
            } else {
                msg += t(
                    'Te contactaremos para confirmar detalles.<br><br>',
                    'We will contact you to confirm details.<br><br>'
                );
            }
            msg += `&bull; ${t('Servicio', 'Service')}: ${escapeHtml(chatBooking.serviceLabel)}<br>`;
            msg += `&bull; ${t('Doctor', 'Doctor')}: ${escapeHtml(chatBooking.doctorLabel)}<br>`;
            msg += `&bull; ${t('Fecha', 'Date')}: ${escapeHtml(chatBooking.date)}<br>`;
            msg += `&bull; ${t('Hora', 'Time')}: ${escapeHtml(chatBooking.time)}<br>`;
            msg += `&bull; ${t('Pago', 'Payment')}: ${t('En consultorio', 'At clinic')}<br><br>`;
            msg += t(
                'Recuerda llegar 10 minutos antes de tu cita.',
                'Please arrive 10 minutes before your appointment.'
            );
            addBotMessage(msg);

            if (deps && typeof deps.showToast === 'function') {
                deps.showToast(
                    t(
                        'Cita agendada correctamente desde el asistente.',
                        'Appointment booked from chat assistant.'
                    ),
                    'success'
                );
            }

            chatBooking = null;
        } catch (error) {
            if (deps && typeof deps.removeTypingIndicator === 'function') {
                deps.removeTypingIndicator();
            }

            if (isCalendarUnavailableError(error)) {
                trackChatCheckoutError({
                    stage: 'appointment_create',
                    payment_method: 'cash',
                    error_code: 'calendar_unreachable',
                });
                addBotMessage(
                    t(
                        'La agenda esta temporalmente no disponible. Intenta de nuevo en unos minutos o agenda por WhatsApp.<br><br>',
                        'The schedule is temporarily unavailable. Please try again in a few minutes or book via WhatsApp.<br><br>'
                    ) + buildChatDateInput()
                );
                if (deps && typeof deps.setCheckoutStep === 'function') {
                    deps.setCheckoutStep('payment_error', {
                        checkoutEntry: 'chatbot',
                        paymentMethod: 'cash',
                        reason: 'calendar_unreachable',
                    });
                }
                chatBooking.step = 'date';
                return;
            }

            if (isSlotUnavailableError(error)) {
                trackChatCheckoutError({
                    stage: 'appointment_create',
                    payment_method: 'cash',
                    error_code: 'slot_conflict',
                });
                addBotMessage(
                    t(
                        'Ese horario ya no esta disponible. Elige una nueva fecha u hora para continuar.<br><br>',
                        'That slot is no longer available. Please choose a new date or time to continue.<br><br>'
                    ) + buildChatDateInput()
                );
                if (deps && typeof deps.setCheckoutStep === 'function') {
                    deps.setCheckoutStep('payment_error', {
                        checkoutEntry: 'chatbot',
                        paymentMethod: 'cash',
                        reason: 'slot_unavailable',
                    });
                }
                chatBooking.step = 'date';
                return;
            }

            const safeError = sanitizeBookingRegistrationError(
                error && error.message ? error.message : ''
            );
            addBotMessage(
                t(
                    `No se pudo registrar la cita: ${escapeHtml(safeError)}. Intenta de nuevo o agenda desde <a href="#v5-booking" data-action="minimize-chat">el formulario</a>.`,
                    `Could not register your appointment: ${escapeHtml(safeError)}. Try again or use the <a href="#v5-booking" data-action="minimize-chat">booking form</a>.`
                )
            );
            trackChatCheckoutError({
                stage: 'appointment_create',
                payment_method: 'cash',
                error_code: normalizeAnalyticsErrorCode(
                    error && error.code ? error.code : safeError,
                    'appointment_create_failed'
                ),
            });
            if (deps && typeof deps.setCheckoutStep === 'function') {
                deps.setCheckoutStep('payment_error', {
                    checkoutEntry: 'chatbot',
                    paymentMethod: 'cash',
                });
            }
            chatBooking.step = 'payment';
        }
        return;
    }

    if (typeof deps.setCurrentAppointment === 'function') {
        deps.setCurrentAppointment(appointment);
    }
    const method = chatBooking.paymentMethod;
    chatBooking = null;

    addBotMessage(
        t(
            `Abriendo el modulo de pago por <strong>${method === 'card' ? 'tarjeta' : 'transferencia'}</strong>...<br>Completa el pago en la ventana que se abrira.`,
            `Opening payment module for <strong>${method === 'card' ? 'card' : 'transfer'}</strong>...<br>Please complete payment in the modal window.`
        )
    );

    setTimeout(() => {
        if (deps && typeof deps.minimizeChatbot === 'function') {
            deps.minimizeChatbot();
        }
        if (deps && typeof deps.openPaymentModal === 'function') {
            deps.openPaymentModal(appointment);
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

function init(inputDeps) {
    deps = inputDeps || deps;
    return window.Piel && window.Piel.ChatBookingEngine;
}

function isActive() {
    return chatBooking !== null;
}

window.Piel = window.Piel || {};
window.Piel.ChatBookingEngine = {
    init,
    isActive,
    startChatBooking,
    cancelChatBooking,
    handleChatBookingSelection,
    handleChatDateSelect,
    processChatBookingStep,
    finalizeChatBooking,
};
