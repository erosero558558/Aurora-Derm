let e = null,
    t = !1,
    n = !1,
    o = !1,
    a = { enabled: !1, provider: 'stripe', publishableKey: '' },
    r = null,
    i = null,
    c = null,
    s = !1;
function d() {
    return (
        document.getElementById('v5-payment-modal') ||
        document.getElementById('paymentModal')
    );
}
function l(t) {
    const n = e ? e[t] : null;
    if ('function' != typeof n)
        throw new Error(`BookingEngine dependency missing: ${t}`);
    return n;
}
function m() {
    return l('getCurrentAppointment')();
}
function u(e) {
    l('setCurrentAppointment')(e);
}
function p(e, t = {}) {
    try {
        l('setCheckoutStep')(e, t || {});
    } catch (e) {}
}
function f(e, t) {
    l('showToast')(e, t);
}
function y(e, t) {
    l('trackEvent')(e, t || {});
}
function h(e, t) {
    return l('normalizeAnalyticsLabel')(e, t);
}
function w() {
    g('');
}
function g(e) {
    const t = document.getElementById('paymentError');
    if (t) {
        if (!e)
            return ((t.textContent = ''), void t.classList.add('is-hidden'));
        ((t.textContent = e), t.classList.remove('is-hidden'));
    }
}
function b(t) {
    try {
        return l('getCaptchaToken')(t);
    } catch (t) {
        return (
            (function (t, n) {
                const o =
                    e && 'function' == typeof e.debugLog ? e.debugLog : null;
                o && o('Captcha token not available', n);
            })(0, t),
            Promise.resolve(null)
        );
    }
}
function _() {
    const e = document.querySelector('.payment-method.active');
    return (e && e.dataset && e.dataset.method) || 'cash';
}
function v(e) {
    const t = String(e || _() || 'cash');
    document.querySelectorAll('.payment-form').forEach((e) => {
        e.classList.add('is-hidden');
    });
    const n = document.querySelector(`.${t}-form`);
    n && n.classList.remove('is-hidden');
}
function k(e) {
    const t = document.querySelector('.payment-method[data-method="card"]');
    if (
        t &&
        (t.classList.toggle('disabled', !e),
        t.setAttribute('aria-disabled', e ? 'false' : 'true'),
        (t.title = e ? '' : 'Pago con tarjeta temporalmente no disponible'),
        !e && t.classList.contains('active'))
    ) {
        const e = document.querySelector(
                '.payment-method[data-method="transfer"]'
            ),
            t = document.querySelector('.payment-method[data-method="cash"]'),
            n = e || t;
        n && n.click();
    }
}
async function E() {
    if (
        ((a = await l('loadPaymentConfig')()),
        !0 !== a.enabled || 'stripe' !== String(a.provider || '').toLowerCase())
    )
        return (k(!1), !1);
    try {
        await l('loadStripeSdk')();
    } catch (e) {
        return (k(!1), !1);
    }
    const e = 'function' == typeof window.Stripe;
    return (
        k(e),
        !!e &&
            (await (async function () {
                if (
                    a.enabled &&
                    'function' == typeof window.Stripe &&
                    a.publishableKey
                ) {
                    if (
                        (r ||
                            ((r = window.Stripe(a.publishableKey)),
                            (i = r.elements())),
                        !i)
                    )
                        throw new Error(
                            'No se pudo inicializar el formulario de tarjeta'
                        );
                    (c ||
                        (c = i.create('card', {
                            hidePostalCode: !0,
                            style: {
                                base: {
                                    color: '#1d1d1f',
                                    fontFamily:
                                        '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif',
                                    fontSize: '16px',
                                    '::placeholder': { color: '#9aa6b2' },
                                },
                                invalid: { color: '#d14343' },
                            },
                        })),
                        s || (c.mount('#stripeCardElement'), (s = !0)));
                }
            })(),
            !0)
    );
}
function P(e = {}) {
    const t = e && !0 === e.skipAbandonTrack,
        n = e && 'string' == typeof e.reason ? e.reason : 'modal_close',
        o = d();
    (t || (p('payment_modal_closed'), l('maybeTrackCheckoutAbandon')(n)),
        l('setCheckoutSessionActive')(!1),
        o && o.classList.remove('active'),
        (document.body.style.overflow = ''),
        w());
}
function S() {
    n ||
        ((n = !0),
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="open-payment-policy"]'))
                return (
                    y('booking_policy_opened', { source: 'payment_modal' }),
                    void p('payment_policy_opened', { source: 'payment_modal' })
                );
            const t = e.target.closest(
                '#v5-payment-modal .payment-faq summary, #paymentModal .payment-faq summary'
            );
            if (t) {
                const e = t.closest('details');
                if (!e) return;
                return void window.requestAnimationFrame(() => {
                    e.open &&
                        (y('payment_faq_interacted', {
                            source: 'payment_modal',
                            action: 'open',
                            faq_item:
                                t.getAttribute('data-i18n') ||
                                h(
                                    t.textContent || 'payment_faq_unknown',
                                    'payment_faq_unknown'
                                ),
                        }),
                        p('payment_faq_opened', { source: 'payment_modal' }));
                });
            }
            const n = e.target.closest('.payment-method');
            if (!n) return;
            if (n.classList.contains('disabled'))
                return void f(
                    'Pago con tarjeta no disponible por el momento.',
                    'warning'
                );
            (document
                .querySelectorAll('.payment-method')
                .forEach((e) => e.classList.remove('active')),
                n.classList.add('active'));
            const o = n.dataset.method;
            (v(o),
                w(),
                y('payment_method_selected', {
                    payment_method: o || 'unknown',
                }),
                'card' === o &&
                    E().catch((e) => {
                        g(
                            e?.message ||
                                'No se pudo cargar el formulario de tarjeta'
                        );
                    }));
        }),
        document.addEventListener('change', (e) => {
            e.target &&
                'transferProofFile' === e.target.id &&
                (function () {
                    const e = document.getElementById('transferProofFile'),
                        t = document.getElementById('transferProofFileName');
                    if (!e || !t) return;
                    const n = e.files && e.files[0] ? e.files[0] : null;
                    t.textContent = n ? n.name : '';
                })();
        }));
}
const I = {
    init: function (n) {
        return (
            t ||
                ((e = n || {}),
                (t = !0),
                'loading' === document.readyState
                    ? document.addEventListener('DOMContentLoaded', S, {
                          once: !0,
                      })
                    : S()),
            I
        );
    },
    openPaymentModal: function (e) {
        const t = d();
        if (!t) return;
        e && u(e);
        const n = m() || {},
            o = l('getCheckoutSession')(),
            a = (o && o.entry) || n.checkoutEntry || 'unknown';
        let r = !1;
        ((o && o.active && o.startedAt) ||
            (l('startCheckoutSession')(n, {
                checkoutEntry: 'unknown' === a ? 'web_form' : a,
                step: 'payment_modal_open',
            }),
            (r = !0)),
            r &&
                y('start_checkout', {
                    service: n.service || '',
                    doctor: n.doctor || '',
                    checkout_entry: 'unknown' === a ? 'web_form' : a,
                }),
            p('payment_modal_open', {
                checkoutEntry: 'unknown' === a ? 'web_form' : a,
                service: n.service || '',
                doctor: n.doctor || '',
            }));
        const i =
            document.getElementById('v5-payment-total') ||
            document.getElementById('paymentTotal');
        (i && (i.textContent = n.price || '$0.00'),
            w(),
            (function () {
                const e = document.getElementById('transferReference');
                e && (e.value = '');
                const t = document.getElementById('transferProofFile');
                t && (t.value = '');
                const n = document.getElementById('transferProofFileName');
                n && (n.textContent = '');
            })());
        const s = document.getElementById('cardholderName');
        (s && n.name && (s.value = n.name),
            c && 'function' == typeof c.clear && c.clear(),
            t.classList.add('active'),
            (document.body.style.overflow = 'hidden'),
            v(_()),
            S(),
            E().catch(() => {}));
    },
    closePaymentModal: P,
    getActivePaymentMethod: _,
    processPayment: async function () {
        if (o) return;
        o = !0;
        const e = d(),
            t = e ? e.querySelector('.btn-primary') : null;
        if (!t) return void (o = !1);
        const n = t.innerHTML;
        let a = 'cash';
        ((t.disabled = !0),
            (t.innerHTML =
                '<i class="fas fa-spinner fa-spin"></i> Procesando...'));
        try {
            if (!m())
                return void f(
                    'Primero completa el formulario de cita.',
                    'warning'
                );
            const e = _();
            let t;
            ((a = e),
                w(),
                y('payment_method_selected', {
                    payment_method: e || 'unknown',
                    selection_source: 'submit',
                }),
                p('payment_method_selected', { paymentMethod: e || 'unknown' }),
                p('payment_processing', { paymentMethod: e || 'unknown' }),
                (t =
                    'card' === e
                        ? await (async function () {
                              if (!(await E()))
                                  throw new Error(
                                      'Pago con tarjeta no disponible en este momento.'
                                  );
                              if (!r || !c)
                                  throw new Error(
                                      'No se pudo inicializar el formulario de tarjeta.'
                                  );
                              const e = (
                                  document.getElementById('cardholderName')
                                      ?.value || ''
                              ).trim();
                              if (e.length < 3)
                                  throw new Error(
                                      'Ingresa el nombre del titular de la tarjeta.'
                                  );
                              const t = m(),
                                  n = await l('buildAppointmentPayload')(t),
                                  o = await b('payment_intent'),
                                  a = l('stripTransientAppointmentFields')(t);
                              a.captchaToken = o;
                              const i = await l('createPaymentIntent')(a);
                              if (!i.clientSecret || !i.paymentIntentId)
                                  throw new Error(
                                      'No se pudo iniciar el cobro con tarjeta.'
                                  );
                              const s = await r.confirmCardPayment(
                                  i.clientSecret,
                                  {
                                      payment_method: {
                                          card: c,
                                          billing_details: {
                                              name: e,
                                              email: t?.email || void 0,
                                              phone: t?.phone || void 0,
                                          },
                                      },
                                  }
                              );
                              if (s.error)
                                  throw new Error(
                                      s.error.message ||
                                          'No se pudo completar el pago con tarjeta.'
                                  );
                              const d = s.paymentIntent;
                              if (!d || 'succeeded' !== d.status)
                                  throw new Error(
                                      'El pago no fue confirmado por la pasarela.'
                                  );
                              if (!(await l('verifyPaymentIntent')(d.id)).paid)
                                  throw new Error(
                                      'No pudimos verificar el pago. Intenta nuevamente.'
                                  );
                              y('payment_success', {
                                  payment_method: 'card',
                                  payment_provider: 'stripe',
                                  payment_intent_id: d.id,
                              });
                              const u = await b('appointment_submit'),
                                  p = {
                                      ...n,
                                      paymentMethod: 'card',
                                      paymentStatus: 'paid',
                                      paymentProvider: 'stripe',
                                      paymentIntentId: d.id,
                                      status: 'confirmed',
                                      captchaToken: u,
                                  };
                              return l('createAppointmentRecord')(p, {
                                  allowLocalFallback: !1,
                              });
                          })()
                        : 'transfer' === e
                          ? await (async function () {
                                const e = (
                                    document.getElementById('transferReference')
                                        ?.value || ''
                                ).trim();
                                if (e.length < 3)
                                    throw new Error(
                                        'Ingresa el numero de referencia de la transferencia.'
                                    );
                                const t =
                                        document.getElementById(
                                            'transferProofFile'
                                        ),
                                    n =
                                        t?.files && t.files[0]
                                            ? t.files[0]
                                            : null;
                                if (!n)
                                    throw new Error(
                                        'Adjunta el comprobante de transferencia.'
                                    );
                                if (n.size > 5242880)
                                    throw new Error(
                                        'El comprobante supera el limite de 5 MB.'
                                    );
                                const o = await l('uploadTransferProof')(n, {
                                        retries: 2,
                                    }),
                                    a = await l('buildAppointmentPayload')(m()),
                                    r = await b('appointment_submit'),
                                    i = {
                                        ...a,
                                        paymentMethod: 'transfer',
                                        paymentStatus:
                                            'pending_transfer_review',
                                        transferReference: e,
                                        transferProofPath:
                                            o.transferProofPath || '',
                                        transferProofUrl:
                                            o.transferProofUrl || '',
                                        transferProofName:
                                            o.transferProofName || '',
                                        transferProofMime:
                                            o.transferProofMime || '',
                                        status: 'confirmed',
                                        captchaToken: r,
                                    };
                                return l('createAppointmentRecord')(i, {
                                    allowLocalFallback: !1,
                                });
                            })()
                          : await (async function () {
                                const e = {
                                    ...(await l('buildAppointmentPayload')(
                                        m()
                                    )),
                                    paymentMethod: 'cash',
                                    paymentStatus: 'pending_cash',
                                    status: 'confirmed',
                                    captchaToken: await b('appointment_submit'),
                                };
                                return l('createAppointmentRecord')(e, {
                                    allowLocalFallback: !1,
                                });
                            })()),
                u(t.appointment),
                p('booking_confirmed', { paymentMethod: e || 'unknown' }),
                l('completeCheckoutSession')(e),
                P({ skipAbandonTrack: !0 }),
                l('showSuccessModal')(!0 === t.emailSent),
                f(
                    'card' === e
                        ? 'Pago aprobado y cita registrada.'
                        : 'Cita registrada correctamente.',
                    'success'
                ));
            const n =
                document.getElementById('v5-booking-form') ||
                document.getElementById('appointmentForm');
            n && n.reset();
            const o = document.getElementById('priceSummary');
            o && o.classList.add('is-hidden');
        } catch (e) {
            const t = e?.message || '';
            let n = (function (e) {
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
                        ? 'Hubo un problema tecnico temporal al registrar la cita. Intenta nuevamente.'
                        : t
                    : 'Hubo un problema tecnico temporal al registrar la cita. Intenta nuevamente.';
            })(t);
            ('card' === a &&
                /horario ya fue reservado/i.test(t) &&
                (n =
                    'El pago fue aprobado, pero el horario acaba de ocuparse. Escribenos por WhatsApp para resolverlo de inmediato: 098 245 3672.'),
                y('checkout_error', {
                    stage: 'payment_submit',
                    payment_method: a || _(),
                    error_code: h(e?.code || n, 'payment_failed'),
                }),
                p('payment_error', { paymentMethod: a || _() }),
                g(n),
                f(n, 'error'));
        } finally {
            ((t.disabled = !1), (t.innerHTML = n), (o = !1));
        }
    },
};
((window.Piel = window.Piel || {}),
    (window.Piel.BookingEngine = I),
    (window.PielBookingEngine = I));
export { I as default };
