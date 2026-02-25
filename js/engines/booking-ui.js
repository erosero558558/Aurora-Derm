let e = null,
    t = !1;
const n = Object.create(null),
    o = { started: !1, submitted: !1, abandonedTracked: !1, lastStep: '' };
function r(t, n) {
    return 'es' ===
        (e && 'function' == typeof e.getCurrentLang ? e.getCurrentLang() : 'es')
        ? t
        : n;
}
function a() {
    return document.getElementById('bookingInlineFeedback');
}
function i(e, t = 'info') {
    const n = a();
    if (!n) return;
    const o = 'error' === t || 'success' === t ? t : 'info';
    ((n.textContent = String(e || '').trim()),
        (n.className = `booking-inline-feedback booking-inline-feedback--${o}`),
        n.setAttribute('role', 'error' === o ? 'alert' : 'status'),
        n.setAttribute('aria-live', 'error' === o ? 'assertive' : 'polite'),
        n.classList.toggle('is-hidden', '' === n.textContent));
}
function s() {
    const e = a();
    e &&
        ((e.textContent = ''),
        (e.className = 'booking-inline-feedback is-hidden'),
        e.setAttribute('role', 'status'),
        e.setAttribute('aria-live', 'polite'));
}
function c(e, t) {
    return e && t ? e.querySelector(`[name="${t}"]`) : null;
}
function l(e) {
    return e ? e.closest('.form-group') || e.closest('.form-consent') : null;
}
function d(e) {
    if (!e) return;
    e.setAttribute('aria-invalid', 'true');
    const t = l(e);
    t && t.classList.add('has-error');
}
function u(e) {
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
function m(e) {
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
function p(e) {
    const t = (function (e) {
        return String(e || '').replace(/\D/g, '');
    })(e);
    return t.length >= 7 && t.length <= 15;
}
function f(t, r = {}, a = {}) {
    if (!e || 'function' != typeof e.trackEvent || !t) return;
    ((o.started = !0), (o.lastStep = t));
    const i = a && !1 !== a.once;
    if (i && n[t]) return;
    i && (n[t] = !0);
    const s = { step: t, source: 'booking_form', ...r };
    (e.trackEvent('booking_step_completed', s),
        'function' == typeof e.setCheckoutStep &&
            e.setCheckoutStep(t, { checkoutEntry: 'booking_form', ...r }));
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
        init: function n(g) {
            if (((e = g || e), t)) return { init: n };
            const v = document.getElementById('serviceSelect'),
                b = document.getElementById('priceSummary'),
                y = document.getElementById('subtotalPrice'),
                X = document.getElementById('ivaPrice'),
                k = document.getElementById('totalPrice'),
                _ = document.querySelector('input[name="date"]'),
                E = document.querySelector('select[name="time"]'),
                S = document.querySelector('select[name="doctor"]'),
                L = document.querySelector('input[name="phone"]'),
                w = document.getElementById('appointmentForm');
            if (!(v && b && y && X && k && w)) return { init: n };
            async function C() {
                try {
                    await e.updateAvailableTimes({
                        dateInput: _,
                        timeSelect: E,
                        doctorSelect: S,
                        serviceSelect: v,
                        t: r,
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
                            ? r(
                                  'La agenda esta temporalmente no disponible. Intenta en unos minutos.',
                                  'The schedule is temporarily unavailable. Please try again in a few minutes.'
                              )
                            : r(
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
                v.addEventListener('change', function () {
                    const e = this.options[this.selectedIndex],
                        t = parseFloat(e.dataset.price) || 0,
                        n = parseFloat(e.dataset.serviceTax) || 0,
                        o = document.getElementById('priceHint'),
                        r = t * n,
                        a = t + r;
                    ((y.textContent = `$${t.toFixed(2)}`),
                        (X.textContent = `$${r.toFixed(2)}`),
                        (k.textContent = `$${a.toFixed(2)}`),
                        t > 0
                            ? (b.classList.remove('is-hidden'),
                              o && o.classList.add('is-hidden'))
                            : (b.classList.remove('is-hidden'),
                              o && o.classList.remove('is-hidden')),
                        this.value &&
                            f('service_selected', { service: this.value }),
                        C().catch(() => {}));
                }),
                _ &&
                    ((_.min = new Date().toISOString().split('T')[0]),
                    _.addEventListener('change', () => {
                        (_.value && f('date_selected'), C().catch(() => {}));
                    })),
                S &&
                    S.addEventListener('change', () => {
                        (S.value && f('doctor_selected', { doctor: S.value }),
                            C().catch(() => {}));
                    }),
                E &&
                    E.addEventListener('change', () => {
                        E.value && f('time_selected');
                    }),
                L &&
                    ((function (e) {
                        if (!e) return;
                        const t = r('+593 9XXXXXXXX', '+593 9XXXXXXXX');
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
                            (o.textContent = r(
                                'Formato recomendado: +593 9XXXXXXXX o 09XXXXXXXX.',
                                'Recommended format: +593 9XXXXXXXX or 09XXXXXXXX.'
                            )));
                    })(L),
                    L.addEventListener('blur', () => {
                        const e = m(L.value);
                        '' !== e && (L.value = e);
                        const t = p(e);
                        (L.setCustomValidity(
                            t
                                ? ''
                                : r(
                                      'Ingresa un telefono valido (ejemplo: +593 9XXXXXXXX).',
                                      'Enter a valid phone number (example: +593 9XXXXXXXX).'
                                  )
                        ),
                            t && f('phone_added'));
                    }),
                    L.addEventListener('input', () => {
                        L.setCustomValidity('');
                    })));
            const A = w.querySelector('input[name="name"]');
            A &&
                A.addEventListener('blur', () => {
                    (A.value || '').trim().length >= 2 && f('name_added');
                });
            const I = w.querySelector('input[name="email"]');
            I &&
                I.addEventListener('blur', () => {
                    const e = (I.value || '').trim();
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && f('email_added');
                });
            const T = w.querySelector('textarea[name="reason"]'),
                x = w.querySelector('select[name="affectedArea"]'),
                q = w.querySelector('select[name="evolutionTime"]'),
                P = () => {
                    const e = T ? (T.value || '').trim() : '',
                        t = x ? (x.value || '').trim() : '',
                        n = q ? (q.value || '').trim() : '';
                    (e || t || n) && f('clinical_context_added');
                };
            (T && T.addEventListener('blur', P),
                x && x.addEventListener('change', P),
                q && q.addEventListener('change', P));
            const $ = w.querySelector('input[name="privacyConsent"]');
            return (
                $ &&
                    $.addEventListener('change', () => {
                        $.checked && f('privacy_consent_checked');
                    }),
                (function (t) {
                    if (!t) return;
                    if (t.querySelector('.booking-policy-note')) return;
                    const n = document.createElement('p');
                    ((n.className = 'form-help booking-policy-note'),
                        (n.innerHTML = `${r('Reprogramacion o cancelacion sin costo hasta 24 horas antes.', 'Free rescheduling or cancellation up to 24 hours before.')} <a href="terminos.html#cancelaciones" target="_blank" rel="noopener noreferrer">${r('Ver politica', 'View policy')}</a>`));
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
                    const a = t.querySelector('.form-consent');
                    a && a.parentNode
                        ? a.insertAdjacentElement('afterend', n)
                        : t.appendChild(n);
                })(w),
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
                            const t = l(e);
                            t && t.classList.remove('has-error');
                        })(n);
                        const o = a();
                        o &&
                            o.classList.contains(
                                'booking-inline-feedback--error'
                            ) &&
                            s();
                    };
                    (e.addEventListener('input', t),
                        e.addEventListener('change', t),
                        (e.dataset.bookingInlineResetBound = 'true'));
                })(w),
                v.value && v.dispatchEvent(new Event('change')),
                w.addEventListener('submit', async function (t) {
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
                            e && (d(e), u(e)),
                            void i(
                                r(
                                    'Revisa los campos obligatorios antes de continuar.',
                                    'Please review the required fields before continuing.'
                                ),
                                'error'
                            )
                        );
                    }
                    const n = this.querySelector('button[type="submit"]'),
                        a = n ? n.innerHTML : '';
                    (n &&
                        ((n.disabled = !0),
                        (n.dataset.loading = 'true'),
                        (n.innerHTML =
                            '<i class="fas fa-spinner fa-spin"></i> Validando agenda...')),
                        this.setAttribute('aria-busy', 'true'),
                        i(
                            r(
                                'Validando disponibilidad en tiempo real. Esto toma unos segundos.',
                                'Checking real-time availability. This takes a few seconds.'
                            ),
                            'info'
                        ));
                    try {
                        const t = new FormData(this),
                            n = e.getCasePhotoFiles(this);
                        e.validateCasePhotoFiles(n);
                        const a = 'on' === t.get('privacyConsent');
                        if (!a) {
                            const e = new Error(
                                r(
                                    'Debes aceptar el tratamiento de datos para continuar.',
                                    'You must accept data processing to continue.'
                                )
                            );
                            throw ((e.fieldName = 'privacyConsent'), e);
                        }
                        const s = m(t.get('phone'));
                        if (!p(s)) {
                            const e = new Error(
                                r(
                                    'Ingresa un telefono valido (ejemplo: +593 9XXXXXXXX).',
                                    'Enter a valid phone number (example: +593 9XXXXXXXX).'
                                )
                            );
                            throw ((e.fieldName = 'phone'), e);
                        }
                        const l = {
                            service: t.get('service'),
                            doctor: t.get('doctor'),
                            date: t.get('date'),
                            time: t.get('time'),
                            name: t.get('name'),
                            email: t.get('email'),
                            phone: s,
                            reason: t.get('reason') || '',
                            affectedArea: t.get('affectedArea') || '',
                            evolutionTime: t.get('evolutionTime') || '',
                            privacyConsent: a,
                            casePhotoFiles: n,
                            casePhotoUploads: [],
                            checkoutEntry: 'booking_form',
                            price: k.textContent,
                        };
                        if (
                            (f('form_submitted', {}, { once: !1 }),
                            l.service &&
                                f('service_selected', { service: l.service }),
                            l.doctor &&
                                f('doctor_selected', { doctor: l.doctor }),
                            l.date && f('date_selected'),
                            l.time && f('time_selected'),
                            (l.name || '').trim().length >= 2 &&
                                f('name_added'),
                            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                                (l.email || '').trim()
                            ) && f('email_added'),
                            (l.phone || '').replace(/\D/g, '').length >= 7 &&
                                f('phone_added'),
                            a && f('privacy_consent_checked'),
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
                                    l.date,
                                    l.doctor,
                                    l.service || 'consulta'
                                )
                            ).includes(l.time))
                        ) {
                            const t = r(
                                'Este horario ya fue reservado. Elige otro para continuar.',
                                'This time slot was just booked. Please choose another one.'
                            );
                            i(t, 'error');
                            const n = c(this, 'time');
                            return (
                                n && (d(n), u(n)),
                                e.showToast(t, 'error'),
                                void (await C())
                            );
                        }
                        (e.setCurrentAppointment(l),
                            e.startCheckoutSession(l, {
                                checkoutEntry: 'booking_form',
                                step: 'booking_form_validated',
                            }),
                            e.trackEvent('start_checkout', {
                                service: l.service || '',
                                doctor: l.doctor || '',
                                checkout_entry: 'booking_form',
                            }),
                            (o.submitted = !0),
                            i(
                                r(
                                    'Horario validado. Continuamos al paso de pago.',
                                    'Time slot validated. Continuing to the payment step.'
                                ),
                                'success'
                            ),
                            e.openPaymentModal(l));
                    } catch (t) {
                        const n =
                                (t && t.message) ||
                                r(
                                    'No se pudo preparar la reserva. Intenta nuevamente.',
                                    'Could not prepare booking. Please try again.'
                                ),
                            o = t && t.fieldName,
                            a = o ? c(this, o) : null;
                        (a && (d(a), u(a)),
                            e.trackEvent('booking_error', {
                                stage: 'booking_form',
                                error_code: e.normalizeAnalyticsLabel(
                                    t && (t.code || t.message),
                                    'booking_prepare_failed'
                                ),
                            }),
                            i(n, 'error'),
                            e.showToast(n, 'error'));
                    } finally {
                        (this.removeAttribute('aria-busy'),
                            n &&
                                ((n.disabled = !1),
                                delete n.dataset.loading,
                                (n.innerHTML = a)));
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
