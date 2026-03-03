let e = null,
    t = !1;
const n = Object.create(null),
    o = { started: !1, submitted: !1, abandonedTracked: !1, lastStep: '' };
function a(t, n) {
    return 'es' ===
        (e && 'function' == typeof e.getCurrentLang ? e.getCurrentLang() : 'es')
        ? t
        : n;
}
function i() {
    return (
        document.getElementById('v5-booking-feedback') ||
        document.getElementById('bookingInlineFeedback')
    );
}
function r(e, t) {
    return (
        document.getElementById(e) || (t ? document.getElementById(t) : null)
    );
}
function c(e, t = 'info') {
    const n = i();
    if (!n) return;
    const o = 'error' === t || 'success' === t ? t : 'info';
    ((n.textContent = String(e || '').trim()),
        (n.className = `booking-inline-feedback booking-inline-feedback--${o}`),
        n.setAttribute('role', 'error' === o ? 'alert' : 'status'),
        n.setAttribute('aria-live', 'error' === o ? 'assertive' : 'polite'),
        n.classList.toggle('is-hidden', '' === n.textContent));
}
function s() {
    const e = i();
    e &&
        ((e.textContent = ''),
        (e.className = 'booking-inline-feedback is-hidden'),
        e.setAttribute('role', 'status'),
        e.setAttribute('aria-live', 'polite'));
}
function l(e, t) {
    return e && t ? e.querySelector(`[name="${t}"]`) : null;
}
function d(e) {
    return e ? e.closest('.form-group') || e.closest('.form-consent') : null;
}
function u(e) {
    if (!e) return;
    e.setAttribute('aria-invalid', 'true');
    const t = d(e);
    t && t.classList.add('has-error');
}
function m(e) {
    if (e && 'function' == typeof e.focus) {
        try {
            e.focus({ preventScroll: !0 });
        } catch (t) {
            e.focus();
        }
        'function' == typeof e.scrollIntoView &&
            e.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
function p(e) {
    const t = String(e || '').trim();
    if ('' === t) return '';
    const n = t.replace(/\D/g, '');
    return n.startsWith('593') && n.length >= 12
        ? `+${n}`
        : n.startsWith('09') && 10 === n.length
          ? `+593${n.slice(1)}`
          : n.startsWith('9') && 9 === n.length
            ? `+593${n}`
            : t.startsWith('+')
              ? `+${t.slice(1).replace(/\D/g, '')}`
              : t;
}
function g(e) {
    const t = (function (e) {
        return String(e || '').replace(/\D/g, '');
    })(e);
    return t.length >= 7 && t.length <= 15;
}
function f(t, a = {}, i = {}) {
    if (!e || 'function' != typeof e.trackEvent || !t) return;
    ((o.started = !0), (o.lastStep = t));
    const r = i && !1 !== i.once;
    if (r && n[t]) return;
    r && (n[t] = !0);
    const c = { step: t, source: 'booking_form', ...a };
    (e.trackEvent('booking_step_completed', c),
        'function' == typeof e.setCheckoutStep &&
            e.setCheckoutStep(t, { checkoutEntry: 'booking_form', ...a }));
}
function h(t = 'form_exit') {
    e &&
        'function' == typeof e.trackEvent &&
        o.started &&
        !o.submitted &&
        !o.abandonedTracked &&
        ((o.abandonedTracked = !0),
        e.trackEvent('checkout_abandon', {
            checkout_entry: 'booking_form',
            checkout_step: o.lastStep || 'booking_form',
            reason: t,
        }));
}
((window.Piel = window.Piel || {}),
    (window.Piel.BookingUi = {
        init: function n(v) {
            if (((e = v || e), t)) return { init: n };
            const b = r('v5-service-select', 'serviceSelect'),
                y = document.getElementById('priceSummary'),
                X = document.getElementById('subtotalPrice'),
                k = document.getElementById('ivaPrice'),
                _ = document.getElementById('totalPrice'),
                E = document.getElementById('selectedPriceLabel'),
                S = document.getElementById('selectedPriceRule'),
                L = document.getElementById('selectedServiceMeta'),
                C = document.getElementById('selectedPriceDisclaimer'),
                w =
                    r('v5-date', 'appointmentDate') ||
                    document.querySelector('input[name="date"]'),
                I =
                    r('v5-time', 'timeSelect') ||
                    document.querySelector('select[name="time"]'),
                x =
                    r('v5-doctor-select', 'doctorSelect') ||
                    document.querySelector('select[name="doctor"]'),
                T = document.querySelector('input[name="phone"]'),
                A = r('v5-booking-form', 'appointmentForm');
            if (!(b && y && X && k && _ && A)) return { init: n };
            async function P() {
                try {
                    await e.updateAvailableTimes({
                        dateInput: w,
                        timeSelect: I,
                        doctorSelect: x,
                        serviceSelect: b,
                        t: a,
                    });
                } catch (t) {
                    e &&
                        'function' == typeof e.debugLog &&
                        e.debugLog('Failed to load booking-calendar.js', t);
                    const n = (function (e) {
                        if (!e) return !1;
                        const t = String(e.code || '').toLowerCase(),
                            n = String(e.message || '').toLowerCase();
                        return (
                            'calendar_unreachable' === t ||
                            'calendar_auth_failed' === t ||
                            'calendar_token_rejected' === t ||
                            n.includes('calendar_unreachable') ||
                            n.includes('agenda temporalmente no disponible') ||
                            n.includes('no se pudo consultar la agenda real') ||
                            n.includes('google calendar no')
                        );
                    })(t);
                    e.showToast(
                        n
                            ? a(
                                  'La agenda esta temporalmente no disponible. Intenta en unos minutos.',
                                  'The schedule is temporarily unavailable. Please try again in a few minutes.'
                              )
                            : a(
                                  'Error cargando calendario. Intenta nuevamente.',
                                  'Error loading calendar. Please try again.'
                              ),
                        'error'
                    );
                }
            }
            ((t = !0),
                (o.started = !1),
                (o.submitted = !1),
                (o.abandonedTracked = !1),
                (o.lastStep = ''),
                b.addEventListener('change', function () {
                    const e = this.options[this.selectedIndex],
                        t = parseFloat(e.dataset.price) || 0,
                        n = parseFloat(e.dataset.serviceTax) || 0,
                        o = parseFloat(e.dataset.priceTotal) || 0,
                        i = String(e.dataset.priceLabelShort || '').trim(),
                        r = String(e.dataset.priceRule || '').trim(),
                        c = String(e.dataset.priceDisclaimer || '').trim(),
                        s = String(e.dataset.serviceType || '').trim(),
                        l = Number(e.dataset.durationMin || 0),
                        d = document.getElementById('priceHint'),
                        u = t * n,
                        m = o > 0 ? o : t + u;
                    if (
                        ((X.textContent = `$${t.toFixed(2)}`),
                        (k.textContent = `$${u.toFixed(2)}`),
                        (_.textContent = `$${m.toFixed(2)}`),
                        E && (E.textContent = i || '-'),
                        S &&
                            (S.textContent =
                                'base_plus_tax' === r
                                    ? a(
                                          'Total = precio base + impuesto aplicable',
                                          'Total = base price + applicable tax'
                                      )
                                    : a(
                                          'Regla de precio según catálogo',
                                          'Pricing rule according to catalogue'
                                      )),
                        L)
                    ) {
                        const e = (function (e) {
                            const t = String(e || '')
                                .trim()
                                .toLowerCase();
                            return t
                                ? 'clinical' === t
                                    ? a('Ruta clínica', 'Clinical route')
                                    : 'telemedicine' === t
                                      ? a('Ruta remota', 'Remote-first route')
                                      : 'procedure' === t
                                        ? a(
                                              'Ruta de procedimiento',
                                              'Procedure route'
                                          )
                                        : 'aesthetic' === t
                                          ? a(
                                                'Ruta de estética médica',
                                                'Medical aesthetics route'
                                            )
                                          : a(
                                                'Ruta especializada',
                                                'Specialized route'
                                            )
                                : a(
                                      'Selecciona una ruta para ver detalles',
                                      'Select a route to see details'
                                  );
                        })(s);
                        L.textContent = l > 0 ? `${e} · ${l} min` : e;
                    }
                    (C &&
                        (C.textContent =
                            c ||
                            a(
                                'El valor final se confirma antes de autorizar el pago.',
                                'Final amount is confirmed before payment authorization.'
                            )),
                        t > 0
                            ? (y.classList.remove('is-hidden'),
                              d && d.classList.add('is-hidden'))
                            : (y.classList.add('is-hidden'),
                              d && d.classList.remove('is-hidden')),
                        this.value &&
                            f('service_selected', { service: this.value }),
                        P().catch(() => {}));
                }),
                w &&
                    ((w.min = new Date().toISOString().split('T')[0]),
                    w.addEventListener('change', () => {
                        (w.value && f('date_selected'), P().catch(() => {}));
                    })),
                x &&
                    x.addEventListener('change', () => {
                        (x.value && f('doctor_selected', { doctor: x.value }),
                            P().catch(() => {}));
                    }),
                I &&
                    I.addEventListener('change', () => {
                        I.value && f('time_selected');
                    }),
                T &&
                    ((function (e) {
                        if (!e) return;
                        const t = a('+593 9XXXXXXXX', '+593 9XXXXXXXX');
                        ((e.placeholder && '' !== e.placeholder.trim()) ||
                            (e.placeholder = t),
                            e.setAttribute('inputmode', 'tel'),
                            e.setAttribute('autocomplete', 'tel'),
                            e.setAttribute('autocapitalize', 'off'),
                            e.setAttribute('spellcheck', 'false'));
                        const n = 'bookingPhoneFormatHelp';
                        let o = document.getElementById(n);
                        (o ||
                            ((o = document.createElement('small')),
                            (o.id = n),
                            (o.className = 'form-help'),
                            e.insertAdjacentElement('afterend', o)),
                            (o.textContent = a(
                                'Formato recomendado: +593 9XXXXXXXX o 09XXXXXXXX.',
                                'Recommended format: +593 9XXXXXXXX or 09XXXXXXXX.'
                            )));
                    })(T),
                    T.addEventListener('blur', () => {
                        const e = p(T.value);
                        '' !== e && (T.value = e);
                        const t = g(e);
                        (T.setCustomValidity(
                            t
                                ? ''
                                : a(
                                      'Ingresa un telefono valido (ejemplo: +593 9XXXXXXXX).',
                                      'Enter a valid phone number (example: +593 9XXXXXXXX).'
                                  )
                        ),
                            t && f('phone_added'));
                    }),
                    T.addEventListener('input', () => {
                        T.setCustomValidity('');
                    })));
            const q = A.querySelector('input[name="name"]');
            q &&
                q.addEventListener('blur', () => {
                    (q.value || '').trim().length >= 2 && f('name_added');
                });
            const B = A.querySelector('input[name="email"]');
            B &&
                B.addEventListener('blur', () => {
                    const e = (B.value || '').trim();
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && f('email_added');
                });
            const $ = A.querySelector('textarea[name="reason"]'),
                F = A.querySelector('select[name="affectedArea"]'),
                R = A.querySelector('select[name="evolutionTime"]'),
                V = () => {
                    const e = $ ? ($.value || '').trim() : '',
                        t = F ? (F.value || '').trim() : '',
                        n = R ? (R.value || '').trim() : '';
                    (e || t || n) && f('clinical_context_added');
                };
            ($ && $.addEventListener('blur', V),
                F && F.addEventListener('change', V),
                R && R.addEventListener('change', V));
            const D = A.querySelector('input[name="privacyConsent"]');
            return (
                D &&
                    D.addEventListener('change', () => {
                        D.checked && f('privacy_consent_checked');
                    }),
                (function (t) {
                    if (!t) return;
                    if (t.querySelector('.booking-policy-note')) return;
                    const n = document.createElement('p');
                    ((n.className = 'form-help booking-policy-note'),
                        (n.innerHTML = `${a('Reprogramacion o cancelacion sin costo hasta 24 horas antes.', 'Free rescheduling or cancellation up to 24 hours before.')} <a href="terminos.html#cancelaciones" target="_blank" rel="noopener noreferrer">${a('Ver politica', 'View policy')}</a>`));
                    const o = n.querySelector('a');
                    o &&
                        o.addEventListener('click', () => {
                            (f('reschedule_policy_opened', {}, { once: !1 }),
                                e &&
                                    'function' == typeof e.trackEvent &&
                                    e.trackEvent('booking_policy_opened', {
                                        source: 'booking_form',
                                    }));
                        });
                    const i = t.querySelector('.form-consent');
                    i && i.parentNode
                        ? i.insertAdjacentElement('afterend', n)
                        : t.appendChild(n);
                })(A),
                (function (e) {
                    if (!e || 'true' === e.dataset.bookingInlineResetBound)
                        return;
                    const t = (t) => {
                        const n = t && t.target;
                        if (!(n instanceof Element)) return;
                        if (!e.contains(n)) return;
                        if (
                            !n.matches(
                                'input, select, textarea, button[type="submit"]'
                            )
                        )
                            return;
                        !(function (e) {
                            if (!e) return;
                            e.removeAttribute('aria-invalid');
                            const t = d(e);
                            t && t.classList.remove('has-error');
                        })(n);
                        const o = i();
                        o &&
                            o.classList.contains(
                                'booking-inline-feedback--error'
                            ) &&
                            s();
                    };
                    (e.addEventListener('input', t),
                        e.addEventListener('change', t),
                        (e.dataset.bookingInlineResetBound = 'true'));
                })(A),
                b.value && b.dispatchEvent(new Event('change')),
                A.addEventListener('submit', async function (t) {
                    if (
                        (t.preventDefault(),
                        s(),
                        this &&
                            (this.querySelectorAll(
                                '[aria-invalid="true"]'
                            ).forEach((e) => {
                                e.removeAttribute('aria-invalid');
                            }),
                            this.querySelectorAll('.has-error').forEach((e) => {
                                e.classList.remove('has-error');
                            })),
                        !this.checkValidity())
                    ) {
                        'function' == typeof this.reportValidity &&
                            this.reportValidity();
                        const e = this.querySelector(':invalid');
                        return (
                            e && (u(e), m(e)),
                            void c(
                                a(
                                    'Revisa los campos obligatorios antes de continuar.',
                                    'Please review the required fields before continuing.'
                                ),
                                'error'
                            )
                        );
                    }
                    const n = this.querySelector('button[type="submit"]'),
                        i = n ? n.innerHTML : '';
                    (n &&
                        ((n.disabled = !0),
                        (n.dataset.loading = 'true'),
                        (n.innerHTML =
                            '<i class="fas fa-spinner fa-spin"></i> Validando agenda...')),
                        this.setAttribute('aria-busy', 'true'),
                        c(
                            a(
                                'Validando disponibilidad en tiempo real. Esto toma unos segundos.',
                                'Checking real-time availability. This takes a few seconds.'
                            ),
                            'info'
                        ));
                    try {
                        const t = new FormData(this),
                            n = e.getCasePhotoFiles(this);
                        e.validateCasePhotoFiles(n);
                        const i = 'on' === t.get('privacyConsent');
                        if (!i) {
                            const e = new Error(
                                a(
                                    'Debes aceptar el tratamiento de datos para continuar.',
                                    'You must accept data processing to continue.'
                                )
                            );
                            throw ((e.fieldName = 'privacyConsent'), e);
                        }
                        const r = p(t.get('phone'));
                        if (!g(r)) {
                            const e = new Error(
                                a(
                                    'Ingresa un telefono valido (ejemplo: +593 9XXXXXXXX).',
                                    'Enter a valid phone number (example: +593 9XXXXXXXX).'
                                )
                            );
                            throw ((e.fieldName = 'phone'), e);
                        }
                        const s = {
                            service: t.get('service'),
                            doctor: t.get('doctor'),
                            date: t.get('date'),
                            time: t.get('time'),
                            name: t.get('name'),
                            email: t.get('email'),
                            phone: r,
                            reason: t.get('reason') || '',
                            affectedArea: t.get('affectedArea') || '',
                            evolutionTime: t.get('evolutionTime') || '',
                            privacyConsent: i,
                            casePhotoFiles: n,
                            casePhotoUploads: [],
                            checkoutEntry: 'booking_form',
                            price: _.textContent,
                        };
                        if (
                            (f('form_submitted', {}, { once: !1 }),
                            s.service &&
                                f('service_selected', { service: s.service }),
                            s.doctor &&
                                f('doctor_selected', { doctor: s.doctor }),
                            s.date && f('date_selected'),
                            s.time && f('time_selected'),
                            (s.name || '').trim().length >= 2 &&
                                f('name_added'),
                            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                                (s.email || '').trim()
                            ) && f('email_added'),
                            (s.phone || '').replace(/\D/g, '').length >= 7 &&
                                f('phone_added'),
                            i && f('privacy_consent_checked'),
                            (function (e) {
                                return !!(
                                    (e.get('reason') || '').trim() ||
                                    (e.get('affectedArea') || '').trim() ||
                                    (e.get('evolutionTime') || '').trim()
                                );
                            })(t) && f('clinical_context_added'),
                            e.markBookingViewed('form_submit'),
                            (
                                await e.getBookedSlots(
                                    s.date,
                                    s.doctor,
                                    s.service || 'consulta'
                                )
                            ).includes(s.time))
                        ) {
                            const t = a(
                                'Este horario ya fue reservado. Elige otro para continuar.',
                                'This time slot was just booked. Please choose another one.'
                            );
                            c(t, 'error');
                            const n = l(this, 'time');
                            return (
                                n && (u(n), m(n)),
                                e.showToast(t, 'error'),
                                void (await P())
                            );
                        }
                        (e.setCurrentAppointment(s),
                            e.startCheckoutSession(s, {
                                checkoutEntry: 'booking_form',
                                step: 'booking_form_validated',
                            }),
                            e.trackEvent('start_checkout', {
                                service: s.service || '',
                                doctor: s.doctor || '',
                                checkout_entry: 'booking_form',
                            }),
                            (o.submitted = !0),
                            c(
                                a(
                                    'Horario validado. Continuamos al paso de pago.',
                                    'Time slot validated. Continuing to the payment step.'
                                ),
                                'success'
                            ),
                            e.openPaymentModal(s));
                    } catch (t) {
                        const n =
                                (t && t.message) ||
                                a(
                                    'No se pudo preparar la reserva. Intenta nuevamente.',
                                    'Could not prepare booking. Please try again.'
                                ),
                            o = t && t.fieldName,
                            i = o ? l(this, o) : null;
                        (i && (u(i), m(i)),
                            e.trackEvent('booking_error', {
                                stage: 'booking_form',
                                error_code: e.normalizeAnalyticsLabel(
                                    t && (t.code || t.message),
                                    'booking_prepare_failed'
                                ),
                            }),
                            c(n, 'error'),
                            e.showToast(n, 'error'));
                    } finally {
                        (this.removeAttribute('aria-busy'),
                            n &&
                                ((n.disabled = !1),
                                delete n.dataset.loading,
                                (n.innerHTML = i)));
                    }
                }),
                document.addEventListener('visibilitychange', () => {
                    'hidden' === document.visibilityState &&
                        h('form_visibility_hidden');
                }),
                window.addEventListener('pagehide', () => {
                    h('form_page_hide');
                }),
                { init: n }
            );
        },
    }));
