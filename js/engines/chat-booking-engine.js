!(function () {
    'use strict';
    let e = null,
        t = null;
    const o = [
            { key: 'consulta', label: 'Consulta Presencial', price: '$46.00' },
            { key: 'telefono', label: 'Consulta Telefónica', price: '$28.75' },
            { key: 'video', label: 'Video Consulta', price: '$34.50' },
            { key: 'laser', label: 'Tratamiento Láser', price: '$172.50' },
            {
                key: 'rejuvenecimiento',
                label: 'Rejuvenecimiento',
                price: '$138.00',
            },
        ],
        a = [
            { key: 'rosero', label: 'Dr. Javier Rosero' },
            { key: 'narvaez', label: 'Dra. Carolina Narvaez' },
            { key: 'indiferente', label: 'Cualquiera disponible' },
        ];
    function n() {
        return e && 'function' == typeof e.getCurrentLang
            ? e.getCurrentLang()
            : 'es';
    }
    function r(e, t) {
        return 'en' === n() ? t : e;
    }
    function i(e) {
        return String(e || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    function c(e) {
        if (!e) return !1;
        const t = String(e.code || '').toLowerCase(),
            o = String(e.message || '').toLowerCase();
        return (
            'calendar_unreachable' === t ||
            'calendar_auth_failed' === t ||
            'calendar_token_rejected' === t ||
            o.includes('calendar_unreachable') ||
            o.includes('agenda temporalmente no disponible') ||
            o.includes('no se pudo consultar la agenda real') ||
            o.includes('google calendar no')
        );
    }
    function s() {
        const e = new Date();
        return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
    }
    function l() {
        return `<input type="date" id="chatDateInput" min="${s()}" data-action="chat-date-select" class="chat-date-input">`;
    }
    function u(t) {
        e && 'function' == typeof e.addBotMessage && e.addBotMessage(t);
    }
    function d(t) {
        e && 'function' == typeof e.addUserMessage && e.addUserMessage(t);
    }
    function p(o, a = {}, n = {}) {
        if (e && 'function' == typeof e.trackEvent && t && o) {
            if (n && !1 !== n.once) {
                if (
                    (t.completedSteps || (t.completedSteps = {}),
                    t.completedSteps[o])
                )
                    return;
                t.completedSteps[o] = !0;
            }
            e.trackEvent('booking_step_completed', {
                step: o,
                source: 'chatbot',
                ...a,
            });
        }
    }
    function m(t, o = 'unknown') {
        return e && 'function' == typeof e.normalizeAnalyticsLabel
            ? e.normalizeAnalyticsLabel(t, o)
            : String(t || '')
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '_')
                  .replace(/^_+|_+$/g, '')
                  .slice(0, 64) || o;
    }
    function h(t = {}) {
        e &&
            'function' == typeof e.trackEvent &&
            e.trackEvent('checkout_error', { source: 'chatbot', ...t });
    }
    function b(o = !1) {
        (t &&
            e &&
            'function' == typeof e.trackEvent &&
            e.trackEvent('checkout_abandon', {
                source: 'chatbot',
                reason: 'chat_cancel',
                checkout_step: t.step || 'unknown',
                payment_method: t.paymentMethod || 'unknown',
            }),
            (t = null),
            o ||
                u(
                    r(
                        'Reserva cancelada. Si necesitas algo mas, estoy aqui para ayudarte.',
                        'Booking cancelled. If you need anything else, I am here to help.'
                    )
                ));
    }
    function f(e) {
        const t = String(e || '').toLowerCase();
        return /(precio|costo|cuanto|doctor|humano|ayuda|hablar|contactar|ubicacion|donde|horario|telefono|whatsapp)/.test(
            t
        );
    }
    async function g(l) {
        if (!t) return !1;
        const d = String(l || '').trim();
        if (/cancelar|salir|no quiero|cancel|exit/i.test(d)) return (b(), !0);
        switch (t.step) {
            case 'service': {
                const e = o.find(
                    (e) =>
                        e.key === d || e.label.toLowerCase() === d.toLowerCase()
                );
                if (!e)
                    return f(d)
                        ? (b(!0), !1)
                        : (u(
                              r(
                                  'Por favor selecciona un servicio valido de las opciones.',
                                  'Please choose a valid service from the options.'
                              )
                          ),
                          !0);
                ((t.service = e.key),
                    (t.serviceLabel = e.label),
                    (t.price = e.price),
                    (t.step = 'doctor'),
                    p('service_selected', { service: e.key }));
                let n = `${r('Servicio', 'Service')}: <strong>${i(e.label)}</strong> (${e.price})<br><br>`;
                ((n += r(
                    '<strong>Paso 2/7:</strong> ¿Con que doctor prefieres?<br><br>',
                    '<strong>Step 2/7:</strong> Which doctor do you prefer?<br><br>'
                )),
                    (n += '<div class="chat-suggestions">'),
                    a.forEach((e) => {
                        n += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${e.key}">${i(e.label)}</button>`;
                    }),
                    (n += '</div>'),
                    u(n));
                break;
            }
            case 'doctor': {
                const e = a.find(
                    (e) =>
                        e.key === d || e.label.toLowerCase() === d.toLowerCase()
                );
                if (!e)
                    return f(d)
                        ? (b(!0), !1)
                        : (u(
                              r(
                                  'Por favor selecciona un doctor de las opciones.',
                                  'Please choose a doctor from the options.'
                              )
                          ),
                          !0);
                ((t.doctor = e.key),
                    (t.doctorLabel = e.label),
                    (t.step = 'date'),
                    p('doctor_selected', { doctor: e.key }));
                const o = s();
                let n = `${r('Doctor', 'Doctor')}: <strong>${i(e.label)}</strong><br><br>`;
                ((n += r(
                    '<strong>Paso 3/7:</strong> ¿Que fecha prefieres?<br><br>',
                    '<strong>Step 3/7:</strong> Which date do you prefer?<br><br>'
                )),
                    (n += `<input type="date" id="chatDateInput" min="${o}" `),
                    (n += 'data-action="chat-date-select" '),
                    (n += 'class="chat-date-input">'),
                    u(n));
                break;
            }
            case 'date': {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
                    return (
                        u(
                            r(
                                'Por favor selecciona una fecha valida (usa el calendario).',
                                'Please select a valid date (use the date picker).'
                            )
                        ),
                        !0
                    );
                const o = new Date(`${d}T12:00:00`),
                    a = new Date();
                if ((a.setHours(0, 0, 0, 0), o < a))
                    return (
                        u(
                            r(
                                'La fecha debe ser hoy o en el futuro. Selecciona otra fecha.',
                                'Date must be today or in the future. Please choose another date.'
                            )
                        ),
                        !0
                    );
                ((t.date = d),
                    (t.step = 'time'),
                    p('date_selected', { date: d }),
                    e &&
                        'function' == typeof e.showTypingIndicator &&
                        e.showTypingIndicator());
                try {
                    const a =
                            e && 'function' == typeof e.loadAvailabilityData
                                ? await e.loadAvailabilityData({
                                      doctor: t.doctor || 'indiferente',
                                      service: t.service || 'consulta',
                                      strict: !0,
                                  })
                                : {},
                        c =
                            e && 'function' == typeof e.getBookedSlots
                                ? await e.getBookedSlots(
                                      d,
                                      t.doctor || '',
                                      t.service || 'consulta'
                                  )
                                : [],
                        l = Array.isArray(a[d]) && a[d].length > 0 ? a[d] : [],
                        p = d === s(),
                        m = p
                            ? 60 * new Date().getHours() +
                              new Date().getMinutes()
                            : -1,
                        h = l
                            .filter((e) => {
                                if (c.includes(e)) return !1;
                                if (p) {
                                    const [t, o] = e.split(':').map(Number);
                                    if (60 * t + o <= m + 60) return !1;
                                }
                                return !0;
                            })
                            .sort();
                    if (
                        (e &&
                            'function' == typeof e.removeTypingIndicator &&
                            e.removeTypingIndicator(),
                        0 === h.length)
                    )
                        return (
                            u(
                                r(
                                    'No hay horarios disponibles para esa fecha. Por favor elige otra.<br><br>',
                                    'No times are available for that date. Please choose another one.<br><br>'
                                ) +
                                    `<input type="date" id="chatDateInput" min="${s()}" data-action="chat-date-select" class="chat-date-input">`
                            ),
                            (t.step = 'date'),
                            !0
                        );
                    const b = 'en' === n() ? 'en-US' : 'es-EC',
                        f = o.toLocaleDateString(b, {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                        });
                    let g = `${r('Fecha', 'Date')}: <strong>${i(f)}</strong><br><br>`;
                    ((g += r(
                        '<strong>Paso 4/7:</strong> Horarios disponibles:<br><br>',
                        '<strong>Step 4/7:</strong> Available times:<br><br>'
                    )),
                        (g += '<div class="chat-suggestions">'),
                        h.forEach((e) => {
                            g += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${e}">${e}</button>`;
                        }),
                        (g += '</div>'),
                        u(g));
                } catch (o) {
                    const a = c(o);
                    (e &&
                        'function' == typeof e.removeTypingIndicator &&
                        e.removeTypingIndicator(),
                        u(
                            a
                                ? r(
                                      'La agenda esta temporalmente no disponible. Intenta de nuevo en unos minutos.',
                                      'The schedule is temporarily unavailable. Please try again in a few minutes.'
                                  )
                                : r(
                                      'No pude consultar los horarios. Intenta de nuevo.',
                                      'I could not load the schedule. Please try again.'
                                  )
                        ),
                        h({
                            stage: 'availability_lookup',
                            payment_method: t.paymentMethod || 'unknown',
                            error_code: a
                                ? 'calendar_unreachable'
                                : m(
                                      o && o.code
                                          ? o.code
                                          : 'availability_error',
                                      'availability_error'
                                  ),
                        }),
                        (t.step = 'date'));
                }
                break;
            }
            case 'time':
                if (!/^\d{2}:\d{2}$/.test(d))
                    return (
                        u(
                            r(
                                'Por favor selecciona un horario valido de las opciones.',
                                'Please choose a valid time from the options.'
                            )
                        ),
                        !0
                    );
                ((t.time = d),
                    (t.step = 'name'),
                    p('time_selected', { time: d }),
                    u(
                        `${r('Hora', 'Time')}: <strong>${i(d)}</strong><br><br>${r('<strong>Paso 5/7:</strong> ¿Cual es tu nombre completo?', '<strong>Step 5/7:</strong> What is your full name?')}`
                    ));
                break;
            case 'name':
                if (d.length < 2)
                    return (
                        u(
                            r(
                                'El nombre debe tener al menos 2 caracteres.',
                                'Name must be at least 2 characters long.'
                            )
                        ),
                        !0
                    );
                ((t.name = d),
                    (t.step = 'email'),
                    p('name_added'),
                    u(
                        `${r('Nombre', 'Name')}: <strong>${i(d)}</strong><br><br>${r('<strong>Paso 6/7:</strong> ¿Cual es tu email?', '<strong>Step 6/7:</strong> What is your email?')}`
                    ));
                break;
            case 'email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d))
                    return (
                        u(
                            r(
                                'El formato del email no es valido. Ejemplo: nombre@correo.com',
                                'Invalid email format. Example: name@example.com'
                            )
                        ),
                        !0
                    );
                ((t.email = d),
                    (t.step = 'phone'),
                    p('email_added'),
                    u(
                        `${r('Email', 'Email')}: <strong>${i(d)}</strong><br><br>${r('<strong>Paso 7/7:</strong> ¿Cual es tu numero de telefono?', '<strong>Step 7/7:</strong> What is your phone number?')}`
                    ));
                break;
            case 'phone': {
                const e = d.replace(/\D/g, '');
                if (e.length < 7 || e.length > 15)
                    return (
                        u(
                            r(
                                'El telefono debe tener entre 7 y 15 digitos.',
                                'Phone number must have between 7 and 15 digits.'
                            )
                        ),
                        !0
                    );
                ((t.phone = d),
                    (t.step = 'payment'),
                    p('contact_info_completed'));
                let o = `${r('Telefono', 'Phone')}: <strong>${i(d)}</strong><br><br>`;
                ((o += `<strong>${r('Resumen de tu cita', 'Appointment summary')}:</strong><br>`),
                    (o += `&bull; ${r('Servicio', 'Service')}: ${i(t.serviceLabel)} (${t.price})<br>`),
                    (o += `&bull; ${r('Doctor', 'Doctor')}: ${i(t.doctorLabel)}<br>`),
                    (o += `&bull; ${r('Fecha', 'Date')}: ${i(t.date)}<br>`),
                    (o += `&bull; ${r('Hora', 'Time')}: ${i(t.time)}<br>`),
                    (o += `&bull; ${r('Nombre', 'Name')}: ${i(t.name)}<br>`),
                    (o += `&bull; Email: ${i(t.email)}<br>`),
                    (o += `&bull; ${r('Telefono', 'Phone')}: ${i(t.phone)}<br><br>`),
                    (o += `${r('¿Como deseas pagar?', 'How would you like to pay?')}<br><br>`),
                    (o += '<div class="chat-suggestions">'),
                    (o +=
                        '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="efectivo"><i class="fas fa-money-bill-wave"></i> Efectivo</button>'),
                    (o +=
                        '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="tarjeta"><i class="fas fa-credit-card"></i> Tarjeta</button>'),
                    (o +=
                        '<button class="chat-suggestion-btn" data-action="chat-booking" data-value="transferencia"><i class="fas fa-university"></i> Transferencia</button>'),
                    (o += '</div>'),
                    u(o));
                break;
            }
            case 'payment': {
                const e = {
                    efectivo: 'cash',
                    cash: 'cash',
                    tarjeta: 'card',
                    card: 'card',
                    transferencia: 'transfer',
                    transfer: 'transfer',
                }[d.toLowerCase()];
                if (!e)
                    return (
                        u(
                            r(
                                'Elige un metodo de pago: Efectivo, Tarjeta o Transferencia.',
                                'Choose a payment method: Cash, Card, or Transfer.'
                            )
                        ),
                        !0
                    );
                ((t.paymentMethod = e),
                    (t.step = 'confirm'),
                    p('payment_method_selected', { payment_method: e }),
                    await y());
                break;
            }
        }
        return !0;
    }
    async function y() {
        if (!t) return;
        const o = {
            service: t.service,
            doctor: t.doctor,
            date: t.date,
            time: t.time,
            name: t.name,
            email: t.email,
            phone: t.phone,
            privacyConsent: !0,
            price: t.price,
        };
        if (
            (e &&
                'function' == typeof e.startCheckoutSession &&
                e.startCheckoutSession(o, {
                    checkoutEntry: 'chatbot',
                    step: 'chat_booking_validated',
                }),
            e &&
                'function' == typeof e.trackEvent &&
                (e.trackEvent('start_checkout', {
                    service: o.service || '',
                    doctor: o.doctor || '',
                    checkout_entry: 'chatbot',
                }),
                e.trackEvent('payment_method_selected', {
                    payment_method: t.paymentMethod || 'unknown',
                })),
            e &&
                'function' == typeof e.setCheckoutStep &&
                e.setCheckoutStep('payment_method_selected', {
                    checkoutEntry: 'chatbot',
                    paymentMethod: t.paymentMethod || 'unknown',
                    service: o.service || '',
                    doctor: o.doctor || '',
                }),
            'cash' === t.paymentMethod)
        ) {
            (e &&
                'function' == typeof e.showTypingIndicator &&
                e.showTypingIndicator(),
                e &&
                    'function' == typeof e.setCheckoutStep &&
                    e.setCheckoutStep('payment_processing', {
                        checkoutEntry: 'chatbot',
                        paymentMethod: 'cash',
                    }));
            try {
                const a = {
                        ...o,
                        paymentMethod: 'cash',
                        paymentStatus: 'pending_cash',
                        status: 'confirmed',
                    },
                    n =
                        e && 'function' == typeof e.createAppointmentRecord
                            ? await e.createAppointmentRecord(a)
                            : null;
                if (!n) throw new Error('Could not create appointment record');
                (e &&
                    'function' == typeof e.removeTypingIndicator &&
                    e.removeTypingIndicator(),
                    n &&
                        'function' == typeof e.setCurrentAppointment &&
                        e.setCurrentAppointment(n.appointment),
                    e &&
                        'function' == typeof e.completeCheckoutSession &&
                        e.completeCheckoutSession('cash'),
                    e &&
                        'function' == typeof e.setCheckoutStep &&
                        e.setCheckoutStep('booking_confirmed', {
                            checkoutEntry: 'chatbot',
                            paymentMethod: 'cash',
                        }));
                let c = `<strong>${r('¡Cita agendada con exito!', 'Appointment booked successfully!')}</strong><br><br>`;
                ((c += r(
                    'Tu cita ha sido registrada. ',
                    'Your appointment has been registered. '
                )),
                    n && n.emailSent
                        ? (c += r(
                              'Te enviamos un correo de confirmacion.<br><br>',
                              'We sent you a confirmation email.<br><br>'
                          ))
                        : (c += r(
                              'Te contactaremos para confirmar detalles.<br><br>',
                              'We will contact you to confirm details.<br><br>'
                          )),
                    (c += `&bull; ${r('Servicio', 'Service')}: ${i(t.serviceLabel)}<br>`),
                    (c += `&bull; ${r('Doctor', 'Doctor')}: ${i(t.doctorLabel)}<br>`),
                    (c += `&bull; ${r('Fecha', 'Date')}: ${i(t.date)}<br>`),
                    (c += `&bull; ${r('Hora', 'Time')}: ${i(t.time)}<br>`),
                    (c += `&bull; ${r('Pago', 'Payment')}: ${r('En consultorio', 'At clinic')}<br><br>`),
                    (c += r(
                        'Recuerda llegar 10 minutos antes de tu cita.',
                        'Please arrive 10 minutes before your appointment.'
                    )),
                    u(c),
                    e &&
                        'function' == typeof e.showToast &&
                        e.showToast(
                            r(
                                'Cita agendada correctamente desde el asistente.',
                                'Appointment booked from chat assistant.'
                            ),
                            'success'
                        ),
                    (t = null));
            } catch (o) {
                if (
                    (e &&
                        'function' == typeof e.removeTypingIndicator &&
                        e.removeTypingIndicator(),
                    c(o))
                )
                    return (
                        h({
                            stage: 'appointment_create',
                            payment_method: 'cash',
                            error_code: 'calendar_unreachable',
                        }),
                        u(
                            r(
                                'La agenda esta temporalmente no disponible. Intenta de nuevo en unos minutos o agenda por WhatsApp.<br><br>',
                                'The schedule is temporarily unavailable. Please try again in a few minutes or book via WhatsApp.<br><br>'
                            ) + l()
                        ),
                        e &&
                            'function' == typeof e.setCheckoutStep &&
                            e.setCheckoutStep('payment_error', {
                                checkoutEntry: 'chatbot',
                                paymentMethod: 'cash',
                                reason: 'calendar_unreachable',
                            }),
                        void (t.step = 'date')
                    );
                if (
                    (function (e) {
                        if (!e) return !1;
                        const t = String(e.code || '').toLowerCase(),
                            o = String(e.message || '').toLowerCase();
                        return (
                            'slot_conflict' === t ||
                            'slot_unavailable' === t ||
                            'booking_slot_not_available' === t ||
                            o.includes('no hay agenda disponible') ||
                            o.includes('ese horario no esta disponible') ||
                            o.includes('slot_conflict')
                        );
                    })(o)
                )
                    return (
                        h({
                            stage: 'appointment_create',
                            payment_method: 'cash',
                            error_code: 'slot_conflict',
                        }),
                        u(
                            r(
                                'Ese horario ya no esta disponible. Elige una nueva fecha u hora para continuar.<br><br>',
                                'That slot is no longer available. Please choose a new date or time to continue.<br><br>'
                            ) + l()
                        ),
                        e &&
                            'function' == typeof e.setCheckoutStep &&
                            e.setCheckoutStep('payment_error', {
                                checkoutEntry: 'chatbot',
                                paymentMethod: 'cash',
                                reason: 'slot_unavailable',
                            }),
                        void (t.step = 'date')
                    );
                const a = (function (e) {
                    const t = String(e || '').trim();
                    return t
                        ? [
                              /call to undefined function/i,
                              /fatal error/i,
                              /uncaught/i,
                              /stack trace/i,
                              /syntax error/i,
                              /on line \d+/i,
                              /in \/.+\.php/i,
                              /mb_strlen/i,
                          ].some((e) => e.test(t))
                            ? r(
                                  'Hubo un problema tecnico temporal al registrar la cita',
                                  'There was a temporary technical issue while registering your appointment'
                              )
                            : t
                        : r(
                              'Hubo un problema tecnico temporal al registrar la cita',
                              'There was a temporary technical issue while registering your appointment'
                          );
                })(o && o.message ? o.message : '');
                (u(
                    r(
                        `No se pudo registrar la cita: ${i(a)}. Intenta de nuevo o agenda desde <a href="#v5-booking" data-action="minimize-chat">el formulario</a>.`,
                        `Could not register your appointment: ${i(a)}. Try again or use the <a href="#v5-booking" data-action="minimize-chat">booking form</a>.`
                    )
                ),
                    h({
                        stage: 'appointment_create',
                        payment_method: 'cash',
                        error_code: m(
                            o && o.code ? o.code : a,
                            'appointment_create_failed'
                        ),
                    }),
                    e &&
                        'function' == typeof e.setCheckoutStep &&
                        e.setCheckoutStep('payment_error', {
                            checkoutEntry: 'chatbot',
                            paymentMethod: 'cash',
                        }),
                    (t.step = 'payment'));
            }
            return;
        }
        'function' == typeof e.setCurrentAppointment &&
            e.setCurrentAppointment(o);
        const a = t.paymentMethod;
        ((t = null),
            u(
                r(
                    `Abriendo el modulo de pago por <strong>${'card' === a ? 'tarjeta' : 'transferencia'}</strong>...<br>Completa el pago en la ventana que se abrira.`,
                    `Opening payment module for <strong>${'card' === a ? 'card' : 'transfer'}</strong>...<br>Please complete payment in the modal window.`
                )
            ),
            setTimeout(() => {
                (e &&
                    'function' == typeof e.minimizeChatbot &&
                    e.minimizeChatbot(),
                    e &&
                        'function' == typeof e.openPaymentModal &&
                        e.openPaymentModal(o),
                    setTimeout(() => {
                        const e = document.querySelector(
                            `.payment-method[data-method="${a}"]`
                        );
                        e && !e.classList.contains('disabled') && e.click();
                    }, 300));
            }, 800));
    }
    ((window.Piel = window.Piel || {}),
        (window.Piel.ChatBookingEngine = {
            init: function (t) {
                return (
                    (e = t || e),
                    window.Piel && window.Piel.ChatBookingEngine
                );
            },
            isActive: function () {
                return null !== t;
            },
            startChatBooking: function () {
                ((t = { step: 'service', completedSteps: {} }),
                    e &&
                        'function' == typeof e.trackEvent &&
                        e.trackEvent('booking_step_completed', {
                            step: 'chat_booking_started',
                            source: 'chatbot',
                        }));
                let a = r(
                    'Vamos a agendar tu cita paso a paso.<br><br><strong>Paso 1/7:</strong> ¿Que servicio necesitas?<br><br>',
                    'Let us schedule your appointment step by step.<br><br><strong>Step 1/7:</strong> Which service do you need?<br><br>'
                );
                ((a += '<div class="chat-suggestions">'),
                    o.forEach((e) => {
                        a += `<button class="chat-suggestion-btn" data-action="chat-booking" data-value="${e.key}">${i(e.label)} (${e.price})</button>`;
                    }),
                    (a += '</div>'),
                    u(a));
            },
            cancelChatBooking: b,
            handleChatBookingSelection: function (e) {
                const t = String(e || '').trim();
                t &&
                    (d(
                        (function (e) {
                            const t = String(e || ''),
                                n = o.find((e) => e.key === t);
                            if (n) return n.label;
                            const r = a.find((e) => e.key === t);
                            return r
                                ? r.label
                                : 'efectivo' === t || 'cash' === t
                                  ? 'Efectivo'
                                  : 'tarjeta' === t || 'card' === t
                                    ? 'Tarjeta'
                                    : 'transferencia' === t || 'transfer' === t
                                      ? 'Transferencia'
                                      : t;
                        })(t)
                    ),
                    g(t));
            },
            handleChatDateSelect: function (e) {
                const t = String(e || '').trim();
                t && (d(t), g(t));
            },
            processChatBookingStep: g,
            finalizeChatBooking: y,
        }));
})();
